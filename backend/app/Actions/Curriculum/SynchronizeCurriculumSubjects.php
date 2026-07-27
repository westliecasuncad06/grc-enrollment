<?php

namespace App\Actions\Curriculum;

use App\Models\Curriculum;
use App\Models\SubjectPrerequisite;
use Illuminate\Support\Facades\DB;

/**
 * Replaces a curriculum's entire subject-placement and prerequisite graph
 * with the submitted one. The cycle check (StoreCurriculumRequest /
 * UpdateCurriculumRequest) already ran against this exact payload before
 * this class is invoked, so no further validation happens here.
 */
final class SynchronizeCurriculumSubjects
{
    /**
     * @param  list<array{subject_id: int, year_level: int, semester: string, is_required: bool, prerequisites: list<array{prerequisite_subject_id: int, minimum_grade: string}>}>  $subjects
     */
    public function execute(Curriculum $curriculum, array $subjects): void
    {
        DB::transaction(function () use ($curriculum, $subjects): void {
            // The subject_prerequisites FK cascades on delete, so this also
            // removes every prerequisite row owned by the placements below.
            $curriculum->subjectPlacements()->delete();

            $placementIdBySubjectId = [];

            foreach ($subjects as $subject) {
                $placement = $curriculum->subjectPlacements()->create([
                    'subject_id' => $subject['subject_id'],
                    'year_level' => $subject['year_level'],
                    'semester' => $subject['semester'],
                    'is_required' => $subject['is_required'],
                ]);

                $placementIdBySubjectId[$subject['subject_id']] = $placement->id;
            }

            foreach ($subjects as $subject) {
                $placementId = $placementIdBySubjectId[$subject['subject_id']];

                foreach ($subject['prerequisites'] as $prerequisite) {
                    SubjectPrerequisite::create([
                        'curriculum_subject_id' => $placementId,
                        'prerequisite_subject_id' => $prerequisite['prerequisite_subject_id'],
                        'minimum_grade' => $prerequisite['minimum_grade'],
                    ]);
                }
            }
        });
    }
}
