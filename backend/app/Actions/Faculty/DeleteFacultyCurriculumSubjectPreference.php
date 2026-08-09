<?php

namespace App\Actions\Faculty;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Models\FacultyCurriculumSubjectPreference;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;

final class DeleteFacultyCurriculumSubjectPreference
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    public function execute(User $actor, FacultyCurriculumSubjectPreference $preference, AuditRequestContext $context): void
    {
        DB::transaction(function () use ($actor, $preference, $context): void {
            $beforeValues = CreateFacultyCurriculumSubjectPreference::snapshot($preference);
            $preference->delete();
            $this->auditRecorder->record(
                $actor,
                AuditAction::FACULTY_CURRICULUM_SUBJECT_PREFERENCE_DELETED,
                AuditableType::FACULTY_CURRICULUM_SUBJECT_PREFERENCE,
                $preference->id,
                $beforeValues,
                null,
                null,
                $context,
            );
        });
    }
}
