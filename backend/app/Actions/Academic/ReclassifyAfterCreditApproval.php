<?php

namespace App\Actions\Academic;

use App\Domain\Audit\AuditRequestContext;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\StudentProfile;
use App\Models\User;

/**
 * Re-derives a student's Regular/Irregular category right after a credit of theirs is
 * approved (ADR 0043, amended 2026-10-05). An approved, mapped credit counts as completed
 * (`ResolveCreditedSubjectIds`), so a block subject whose prerequisite is now credited no
 * longer needs removing and the student may become Regular. Run inside the approval's
 * transaction so the credit and the category change together.
 *
 * With no term in progress there is no block to compare with, so nothing is changed; the
 * existing triggers re-derive the category when a term opens. The change itself, its audit
 * row and the student's notice are `ReclassifyStudentEnrollmentCategory`'s.
 */
final readonly class ReclassifyAfterCreditApproval
{
    public function __construct(private ReclassifyStudentEnrollmentCategory $reclassify) {}

    public function execute(StudentProfile $student, User $actor, AuditRequestContext $context): void
    {
        $term = AcademicTerm::query()->where('status', AcademicTermStatus::SemesterOngoing)->first();

        if ($term === null) {
            return;
        }

        // A fresh row: the category is compared with what is stored now, not with a copy loaded earlier.
        $this->reclassify->execute(StudentProfile::query()->findOrFail($student->id), $term, $actor, $context);
    }
}
