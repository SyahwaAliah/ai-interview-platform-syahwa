# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, 'skill uniqueness' do
  around { |example| Current.using(tenant_id: 1) { example.run } }

  def skill(label, order)
    { skill_label: label, display_order: order,
      l1_anchor: 'a', l2_anchor: 'b', l3_anchor: 'c', l4_anchor: 'd', l5_anchor: 'e' }
  end

  def validated(skills)
    assessment = described_class.new(name: 'Backend', time_limit_min: 30, assessment_skills_attributes: skills)
    assessment.valid?
    assessment
  end

  it 'accepts distinct skills' do
    assessment = validated([skill('System Design', 0), skill('RESTful API Design', 1)])
    expect(assessment.errors[:base]).to be_empty
  end

  it 'rejects the same skill listed twice and names it' do
    assessment = validated([skill('Data-Driven Decision Making', 0), skill('Data-Driven Decision Making', 1)])
    expect(assessment.errors[:base].join).to include('Data-Driven Decision Making')
  end

  it 'treats differences in case and surrounding spaces as the same skill' do
    assessment = validated([skill('Communication', 0), skill('  communication ', 1)])
    expect(assessment.errors[:base]).not_to be_empty
  end

  it 'does not complain when two different skills merely look similar' do
    assessment = validated([skill('Communication', 0), skill('Communication Skills', 1)])
    expect(assessment.errors[:base]).to be_empty
  end
end
