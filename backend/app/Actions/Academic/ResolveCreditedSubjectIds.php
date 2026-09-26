<?php

namespace App\Actions\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Models\CurriculumMigrationCredit;
use App\Models\TransfereeCredit;

/**
 * Which subjects a student is already credited with, without a GRC grade
 * (ADR 0026). Two sources, kept separate so a caller can say where a credit
 * came from and merged when it only needs "is it credited?":
 *
 *   - `CurriculumMigrationCredit`: an old-curriculum subject the Program Chair
 *     carried over to the student's current curriculum.
 *   - An `approved` `TransfereeCredit` mapped to a subject: a subject taken at
 *     another school that the Program Chair endorsed and Registrar Staff
 *     approved. A credit that is only `pending`, `endorsed`, `rejected`, or
 *     has no mapped subject credits nothing.
 *
 * A credited subject carries no grade, so PRD §17's cross-institution grade
 * equivalence stays open and no credit can ever feed a GWA.
 */
final readonly class ResolveCreditedSubjectIds
{
    /**
     * @param  list<int>  $studentIds
     * @return array<int, array<int, true>> student id => subject ids
     */
    public function fromCurriculumMigrations(array $studentIds, int $curriculumId): array
    {
        if ($studentIds === []) {
            return [];
        }

        $credits = CurriculumMigrationCredit::query()
            ->whereHas('migration', fn ($query) => $query
                ->whereIn('student_id', $studentIds)
                ->where('target_curriculum_id', $curriculumId))
            ->with('migration:id,student_id,target_curriculum_id')
            ->get(['id', 'curriculum_migration_id', 'target_subject_id']);

        $byStudent = [];
        foreach ($credits as $credit) {
            // whereHas('migration', ...) above already guarantees a match
            // exists at the DB level, but the eager-loaded relation is still
            // nullable to PHPStan's static analysis.
            if ($credit->migration === null) {
                continue;
            }

            $byStudent[$credit->migration->student_id][$credit->target_subject_id] = true;
        }

        return $byStudent;
    }

    /**
     * @param  list<int>  $studentIds
     * @return array<int, array<int, true>> student id => subject ids
     */
    public function fromApprovedTransfereeCredits(array $studentIds): array
    {
        if ($studentIds === []) {
            return [];
        }

        $credits = TransfereeCredit::query()
            ->whereIn('student_id', $studentIds)
            ->where('status', TransfereeCreditStatus::Approved->value)
            ->whereNotNull('subject_id')
            ->get(['student_id', 'subject_id']);

        $byStudent = [];
        foreach ($credits as $credit) {
            if ($credit->subject_id === null) {
                continue;
            }

            $byStudent[$credit->student_id][$credit->subject_id] = true;
        }

        return $byStudent;
    }

    /**
     * Both sources merged.
     *
     * @param  list<int>  $studentIds
     * @return array<int, array<int, true>> student id => subject ids
     */
    public function forStudents(array $studentIds, int $curriculumId): array
    {
        $merged = $this->fromCurriculumMigrations($studentIds, $curriculumId);

        foreach ($this->fromApprovedTransfereeCredits($studentIds) as $studentId => $subjectIds) {
            $merged[$studentId] = ($merged[$studentId] ?? []) + $subjectIds;
        }

        return $merged;
    }
}
