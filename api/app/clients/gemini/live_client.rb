# frozen_string_literal: true

require 'faye/websocket'
require 'json'
require 'base64'

module Gemini
  # Manages a persistent WebSocket connection to Gemini Live API.
  class LiveClient
    GEMINI_WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent'

    INACTIVITY_TIMEOUT = 30 # reconnect if Gemini produces no meaningful response
    GATE_OPEN_DELAY    = 0.8 # delay opening mic gate so frontend audio buffer drains and avoids echo loop

    # Silence pump: synthetic silent PCM frames sent during browser silence so Gemini's VAD detects end-of-speech.
    SILENCE_PUMP_DELAY    = 1
    SILENCE_PUMP_INTERVAL = 0.03
    SILENCE_FRAME_SAMPLES = 640
    SILENCE_FRAME = ("\x00" * (SILENCE_FRAME_SAMPLES * 2)).freeze

    attr_reader :resumption_token, :connected, :connected_at, :inactivity_close

    def initialize(
      system_prompt:,
      api_key: nil,
      model: nil,
      voice: 'Puck',
      on_audio: nil,
      on_input_transcription: nil,
      on_output_transcription: nil,
      on_model_turn_complete: nil,
      on_go_away: nil,
      on_close: nil,
      on_error: nil,
      on_ready: nil,
      on_resumption_token_update: nil
    )
      @system_prompt = system_prompt
      @api_key = api_key || ENV.fetch('GEMINI_API_KEY')
      @model = 'gemini-2.0-flash-exp'
      @voice = voice
      @resumption_token = nil
      @connected = false
      @ws = nil
      @input_text_buffer  = +''
      @output_text_buffer = +''
      @last_activity_at = nil
      @inactivity_timer = nil
      @last_audio_forwarded_at = nil
      @silence_pump_timer = nil

      @on_audio = on_audio
      @on_input_transcription = on_input_transcription
      @on_output_transcription = on_output_transcription
      @on_model_turn_complete = on_model_turn_complete
      @on_go_away = on_go_away
      @on_close = on_close
      @on_error = on_error
      @on_ready = on_ready
      @on_resumption_token_update = on_resumption_token_update
    end

    # Opens the WebSocket and sends setup; resumes a prior session if a handle is provided.
    def connect(resumption_handle: nil)
      @setup_complete = false
      @ws = Faye::WebSocket::Client.new(
        GEMINI_WS_URL,
        nil,
        headers: { 'x-goog-api-key' => @api_key }
      )

      @ws.on :open do |_event|
        puts '[Gemini::LiveClient] WebSocket opened — awaiting setupComplete'
        send_setup_payload(resumption_handle: resumption_handle)
      end

      @ws.on :message do |event|
        handle_message(event.data)
      end

      @ws.on :close do |event|
        @connected = false
        puts "[Gemini::LiveClient] Connection closed: code=#{event.code} reason=#{event.reason}"
        @on_close&.call(event.code, event.reason)
      end

      @ws.on :error do |event|
        puts "[Gemini::LiveClient] WebSocket error: #{event.message}"
        @on_error&.call(event.message)
      end
    end

    def send_audio(pcm_data)
      return unless @connected && @ws

      base64_audio = Base64.strict_encode64(pcm_data)
      msg = {
        realtime_input: {
          media_chunks: [
            {
              mime_type: 'audio/pcm',
              data: base64_audio
            }
          ]
        }
      }
      @ws.send(msg.to_json)
    end

    def close
      @ws&.close
    end

    private

    def send_setup_payload(resumption_handle: nil)
      setup_msg = {
        setup: {
          model: "models/#{@model.sub(/^models\//, '')}",
          generation_config: {
            response_modalities: ['AUDIO'],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: {
                  voice_name: @voice || 'Puck'
                }
              }
            }
          },
          system_instruction: {
            parts: [
              { text: @system_prompt }
            ]
          }
        }
      }

      setup_msg[:setup][:session_resumption] = { handle: resumption_handle } if resumption_handle
      @ws.send(setup_msg.to_json)
    end

    def handle_message(data)
      json = JSON.parse(data) rescue nil
      return unless json

      if json['setupComplete']
        @connected = true
        @setup_complete = true
        puts '[Gemini::LiveClient] Connected & setupComplete received!'
        @on_ready&.call
        return
      end

      server_content = json['serverContent']
      return unless server_content

      model_turn = server_content['modelTurn']
      if model_turn && model_turn['parts']
        model_turn['parts'].each do |part|
          if part['inlineData'] && part['inlineData']['mimeType']&.start_with?('audio/')
            raw_pcm = Base64.decode64(part['inlineData']['data'])
            @on_audio&.call(raw_pcm)
          elsif part['text']
            @on_output_transcription&.call(part['text'])
          end
        end
      end

      if server_content['turnComplete']
        @on_model_turn_complete&.call
      end
    end
  end
end