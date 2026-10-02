<?php

namespace App\Actions\Academic;

use App\Domain\Academic\CreditMappingStatusResult;
use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Identity\StudentType;
use App\Models\CurriculumMigration;
use App\Models\StudentProfile;
use App\Models\TransfereeCredit;

final readonly class EvaluateCreditMappingStatus
{
    public function execute(StudentProfile $student): CreditMappingStatusResult
    {
        $studentType = $student->student_type instanceof StudentType
            ? $student->student_type
            : StudentType::tryFrom((string) $student->student_type);

        if ($studentType === null || $studentType === StudentType::Freshman) {
            return new CreditMappingStatusResult(
                isCompleted: true,
                requiresCreditMapping: false,
                reason: null,
            );
        }

        $credits = TransfereeCredit::query()
            ->where('student_id', $student->id)
            ->get();

        $totalCredits = $credits->count();
        $pendingCredits = $credits->where('status', TransfereeCreditStatus::Pending)->count();
        $endorsedCredits = $credits->where('status', TransfereeCreditStatus::Endorsed)->count();
        $approvedCredits = $credits->where('status', TransfereeCreditStatus::Approved)->count();
        $rejectedCredits = $credits->where('status', TransfereeCreditStatus::Rejected)->count();

        $hasCurriculumMigration = CurriculumMigration::query()
            ->where('student_id', $student->id)
            ->exists();

        if ($studentType === StudentType::Transferee) {
            if ($totalCredits === 0) {
                return new CreditMappingStatusResult(
                    isCompleted: false,
                    requiresCreditMapping: true,
                    reason: 'Credit mapping has not been submitted or completed yet. Please wait for the Program Head / Registrar to evaluate your credits from your previous school.',
                    totalCredits: 0,
                    pendingCredits: 0,
                    endorsedCredits: 0,
                    approvedCredits: 0,
                    rejectedCredits: 0,
                    hasCurriculumMigration: $hasCurriculumMigration,
                );
            }

            if ($pendingCredits > 0 || $endorsedCredits > 0) {
                return new CreditMappingStatusResult(
                    isCompleted: false,
                    requiresCreditMapping: true,
                    reason: 'Credit mapping is currently in progress. Please wait for the Program Head and Registrar to finalize your credit evaluation.',
                    totalCredits: $totalCredits,
                    pendingCredits: $pendingCredits,
                    endorsedCredits: $endorsedCredits,
                    approvedCredits: $approvedCredits,
                    rejectedCredits: $rejectedCredits,
                    hasCurriculumMigration: $hasCurriculumMigration,
                );
            }

            return new CreditMappingStatusResult(
                isCompleted: true,
                requiresCreditMapping: true,
                reason: null,
                totalCredits: $totalCredits,
                pendingCredits: $pendingCredits,
                endorsedCredits: $endorsedCredits,
                approvedCredits: $approvedCredits,
                rejectedCredits: $rejectedCredits,
                hasCurriculumMigration: $hasCurriculumMigration,
            );
        }

        // Returnee logic (remaining case)
        if ($pendingCredits > 0 || $endorsedCredits > 0) {
            return new CreditMappingStatusResult(
                isCompleted: false,
                requiresCreditMapping: true,
                reason: 'Credit mapping is currently in progress. Please wait for the evaluation to be finalized.',
                totalCredits: $totalCredits,
                pendingCredits: $pendingCredits,
                endorsedCredits: $endorsedCredits,
                approvedCredits: $approvedCredits,
                rejectedCredits: $rejectedCredits,
                hasCurriculumMigration: $hasCurriculumMigration,
            );
        }

        if ($hasCurriculumMigration || $approvedCredits > 0) {
            return new CreditMappingStatusResult(
                isCompleted: true,
                requiresCreditMapping: true,
                reason: null,
                totalCredits: $totalCredits,
                pendingCredits: $pendingCredits,
                endorsedCredits: $endorsedCredits,
                approvedCredits: $approvedCredits,
                rejectedCredits: $rejectedCredits,
                hasCurriculumMigration: $hasCurriculumMigration,
            );
        }

        return new CreditMappingStatusResult(
            isCompleted: false,
            requiresCreditMapping: true,
            reason: 'Your credit mapping or curriculum migration has not been completed yet. Please contact your Program Head or Registrar before enrolling.',
            totalCredits: $totalCredits,
            pendingCredits: $pendingCredits,
            endorsedCredits: $endorsedCredits,
            approvedCredits: $approvedCredits,
            rejectedCredits: $rejectedCredits,
            hasCurriculumMigration: false,
        );
    }
}
