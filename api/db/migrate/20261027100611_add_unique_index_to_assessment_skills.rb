# frozen_string_literal: true

# An assessment could list the same skill twice, which made starting a session fail:
# the coverage_maps unique index rejected the second row. This removes existing
# duplicates (keeping the lowest id per assessment_id + skill_label) and then
# enforces uniqueness. `down` only drops the index; deleted rows cannot be restored.
class AddUniqueIndexToAssessmentSkills < ActiveRecord::Migration[7.0]
  INDEX_NAME = 'index_assessment_skills_on_assessment_id_and_skill_label'

  def up
    removed = execute(<<~SQL).cmd_tuples
      DELETE FROM assessment_skills AS a
      USING assessment_skills AS b
      WHERE a.assessment_id = b.assessment_id
        AND a.skill_label = b.skill_label
        AND a.id > b.id
    SQL
    say "Removed #{removed} duplicate assessment skill row(s)"
    add_index :assessment_skills, %i[assessment_id skill_label], unique: true, name: INDEX_NAME
  end

  def down
    remove_index :assessment_skills, name: INDEX_NAME
  end
end
