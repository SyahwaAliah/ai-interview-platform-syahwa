# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, '#invite_url' do
  subject(:session) { described_class.new(invite_token: 'abc123') }

  around do |example|
    original = ENV['APP_BASE_URL']
    Current.using(tenant_id: 1) { example.run }
  ensure
    original.nil? ? ENV.delete('APP_BASE_URL') : ENV['APP_BASE_URL'] = original
  end

  it 'points at the candidate-facing web app when APP_BASE_URL is set' do
    ENV['APP_BASE_URL'] = 'https://interview.example.com/'
    expect(session.invite_url).to eq('https://interview.example.com/interview/abc123')
  end

  it 'defaults to the web dev server, never the API host, outside production' do
    ENV.delete('APP_BASE_URL')
    expect(session.invite_url).to eq('http://localhost:5173/interview/abc123')
  end

  it 'refuses to build a link in production without APP_BASE_URL' do
    ENV.delete('APP_BASE_URL')
    allow(Rails.env).to receive(:production?).and_return(true)
    expect { session.invite_url }.to raise_error(KeyError, /APP_BASE_URL/)
  end
end
