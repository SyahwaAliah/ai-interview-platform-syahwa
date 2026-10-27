# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'log parameter filtering' do
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

  it 'filters candidate invite tokens so they never reach the logs' do
    filtered = filter.filter('token' => 'abc', 'invite_token' => 'def', 'assessment_id' => '3')
    expect(filtered).to eq('token' => '[FILTERED]', 'invite_token' => '[FILTERED]', 'assessment_id' => '3')
  end
end
