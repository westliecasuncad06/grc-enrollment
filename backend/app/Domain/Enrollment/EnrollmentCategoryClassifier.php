<?php

namespace App\Domain\Enrollment;

use App\Domain\Academic\GradeMark;

/**
 * Derives a student's Regular/Irregular standing from their locked grade
 * history — per user direction (2026-08-04): a student with no failing,
 * incomplete, not-complete, or dropped mark, and no missing required
 * subject, in any semester they have already completed, is Regular. Any one
 * of those in a completed semester makes them Irregular. There is no manual
 * override — this is the entire rule.
 *
 * Pure and DB-free: the caller (`ReclassifyStudentEnrollmentCategory`)
 * resolves the student's latest locked mark per subject and their
 * curriculum's placements before calling `classify()`.
 */
final class EnrollmentCategoryClassifier
{
    /**
     * @param  array<int, GradeMark>  $latestLockedMarksBySubjectId  Only subjects with an on-scale locked mark are present; a missing key means no usable locked grade exists.
     * @param  list<CurriculumPlacementSlot>  $placements
     * @param  int  $currentOrdinal  Placements at or after this ordinal are the student's current or future semesters — not yet "completed," so they never count against standing.
     */
    public static function classify(array $latestLockedMarksBySubjectId, array $placements, int $currentOrdinal): ClassificationVerdict
    {
        $reasons = [];

        foreach ($placements as $placement) {
            if ($placement->ordinal() >= $currentOrdinal) {
                continue;
            }

            $mark = $latestLockedMarksBySubjectId[$placement->subjectId] ?? null;

            if ($mark === null) {
                if ($placement->isRequired) {
                    $reasons[] = [
                        'code' => 'missing_required_subject',
                        'message' => "{$placement->subjectCode} has not been completed.",
                    ];
                }

                continue;
            }

            if (! $mark->blocksRegularStanding()) {
                continue;
            }

            $reasons[] = match ($mark) {
                GradeMark::Failed => ['code' => 'failing_grade', 'message' => "{$placement->subjectCode} was failed."],
                GradeMark::Incomplete => ['code' => 'incomplete_mark', 'message' => "{$placement->subjectCode} is marked Incomplete."],
                GradeMark::NotComplete => ['code' => 'not_complete_mark', 'message' => "{$placement->subjectCode} was marked Not Complete."],
                GradeMark::Dropped => ['code' => 'dropped_subject', 'message' => "{$placement->subjectCode} was dropped."],
                default => ['code' => 'irregular_mark', 'message' => "{$placement->subjectCode} carries a mark that requires review."],
            };
        }

        return $reasons === []
            ? ClassificationVerdict::regular()
            : ClassificationVerdict::irregular($reasons);
    }
}
