<?php

namespace App\Actions\Curriculum;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Curriculum\CurriculumStatus;
use App\Models\Curriculum;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Audit\CurriculumAuditSnapshot;
use Illuminate\Support\Facades\DB;

final class CreateCurriculum
{
    private const RESOURCE_RELATIONS = [
        'subjectPlacements.subject',
        'subjectPlacements.prerequisites.prerequisiteSubject',
    ];

    public function __construct(
        private readonly SynchronizeCurriculumSubjects $synchronizer,
        private readonly ResolveCurriculumEffectiveSchoolYear $effectiveSchoolYearResolver,
        private readonly CurriculumAuditSnapshot $snapshot,
        private readonly AuditRecorder $auditRecorder,
    ) {}

    /**
     * @param  array{program_id: int, name: string}  $validatedData
     * @param  list<array{subject_id: int, year_level: int, semester: string, is_required: bool, prerequisites: list<array{prerequisite_subject_id: int, minimum_grade: string}>}>  $subjects
     */
    public function execute(
        User $actor,
        array $validatedData,
        array $subjects,
        AuditRequestContext $context,
    ): Curriculum {
        return DB::transaction(function () use ($actor, $validatedData, $subjects, $context): Curriculum {
            $curriculum = Curriculum::create([
                'program_id' => $validatedData['program_id'],
                'name' => $validatedData['name'],
                'effective_school_year' => $this->effectiveSchoolYearResolver->execute(),
                'status' => CurriculumStatus::Draft,
            ]);

            $this->synchronizer->execute($curriculum, $subjects);
            $curriculum->refresh();
            $afterValues = $this->snapshot->capture($curriculum);

            $this->auditRecorder->record(
                $actor,
                AuditAction::CURRICULUM_CREATED,
                AuditableType::CURRICULUM,
                $curriculum->id,
                null,
                $afterValues,
                null,
                $context,
            );

            return $curriculum->load(self::RESOURCE_RELATIONS);
        });
    }
}
