<?php

namespace App\Actions\Curriculum;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Models\Curriculum;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Audit\CurriculumAuditSnapshot;
use Illuminate\Support\Facades\DB;

final class UpdateCurriculum
{
    private const RESOURCE_RELATIONS = [
        'subjectPlacements.subject',
        'subjectPlacements.prerequisites.prerequisiteSubject',
    ];

    public function __construct(
        private readonly SynchronizeCurriculumSubjects $synchronizer,
        private readonly CurriculumAuditSnapshot $snapshot,
        private readonly AuditRecorder $auditRecorder,
    ) {}

    /**
     * @param  array{name: string, effective_school_year: string, status: string}  $validatedData
     * @param  list<array{subject_id: int, year_level: int, semester: string, is_required: bool, prerequisites: list<array{prerequisite_subject_id: int, minimum_grade: string}>}>  $subjects
     */
    public function execute(
        User $actor,
        array $validatedData,
        array $subjects,
        Curriculum $curriculum,
        AuditRequestContext $context,
    ): Curriculum {
        return DB::transaction(function () use ($actor, $validatedData, $subjects, $curriculum, $context): Curriculum {
            $beforeValues = $this->snapshot->capture($curriculum);

            $curriculum->update([
                'name' => $validatedData['name'],
                'effective_school_year' => $validatedData['effective_school_year'],
                'status' => $validatedData['status'],
            ]);
            $this->synchronizer->execute($curriculum, $subjects);
            $curriculum->refresh();
            $afterValues = $this->snapshot->capture($curriculum);

            $this->auditRecorder->record(
                $actor,
                AuditAction::CURRICULUM_UPDATED,
                AuditableType::CURRICULUM,
                $curriculum->id,
                $beforeValues,
                $afterValues,
                null,
                $context,
            );

            return $curriculum->load(self::RESOURCE_RELATIONS);
        });
    }
}
