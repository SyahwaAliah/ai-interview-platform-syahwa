# frozen_string_literal: true

class Assessment < ApplicationRecord
  include TenantScoped

  has_many :assessment_skills, dependent: :destroy, inverse_of: :assessment
  has_many :sessions, dependent: :restrict_with_error

  SUPPORTED_LANGUAGES = { 'en' => 'English', 'id' => 'Bahasa Indonesia' }.freeze

  validates :name, presence: true
  validates :time_limit_min, presence: true,
                              inclusion: { in: [10, 30, 45, 60, 90] }
  validates :language, inclusion: { in: SUPPORTED_LANGUAGES.keys }, allow_nil: true

  accepts_nested_attributes_for :assessment_skills,
                                 allow_destroy: true,
                                 reject_if: :all_blank

  validate :skill_labels_must_be_unique

  private

  # Skills arrive nested in the same request as the assessment, so a duplicate has no
  # database row to collide with yet; it would otherwise only surface when a session
  # starts and the coverage maps are created. Case and surrounding spaces are ignored.
  def skill_labels_must_be_unique
    seen = {}
    duplicates = []
    assessment_skills.reject(&:marked_for_destruction?).each do |skill|
      label = skill.skill_label.to_s.strip
      next if label.empty?

      key = label.downcase
      duplicates << label if seen[key] && duplicates.none? { |d| d.downcase == key }
      seen[key] = true
    end
    return if duplicates.empty?

    errors.add(:base, "Each skill can only be added once: #{duplicates.join(', ')}")
  end
end
