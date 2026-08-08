<?php

namespace App\Actions\Curriculum;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Subject;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Audit\CurriculumAuditSnapshot;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AddCurriculumSubjectPlacement
{
    private const RESOURCE_RELATIONS = [
        'subjectPlacements.subject',
        'subjectPlacements.prerequisites.prerequisiteSubject',
    ];

    public function __construct(
        private readonly ResolveCurrentCurriculumSubjectSource $sourceResolver,
        private readonly CurriculumAuditSnapshot $snapshot,
        private readonly AuditRecorder $auditRecorder,
    ) {}

    /**
     * @param  array{source: 'new'|'existing', year_level: int, semester: string, subject_id?: int, code?: string, title?: string, units?: float}  $validatedData
     */
    public function execute(User $actor, Curriculum $curriculum, array $validatedData, AuditRequestContext $context): Curriculum
    {
        return DB::transaction(function () use ($actor, $curriculum, $validatedData, $context): Curriculum {
            $curriculum = Curriculum::query()
                ->with('program')
                ->whereKey($curriculum->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($actor->college === null || $curriculum->program->college !== $actor->college) {
                throw new AuthorizationException;
            }

            if ($curriculum->status !== CurriculumStatus::Draft) {
                throw ValidationException::withMessages([
                    'status' => 'Only a Draft curriculum can be edited.',
                ]);
            }

            $beforeValues = $this->snapshot->capture($curriculum);
            $subject = $validatedData['source'] === 'new'
                ? $this->createSubject($actor, $validatedData, $context)
                : $this->eligibleExistingSubject($curriculum, $validatedData);

            if (CurriculumSubject::query()
                ->where('curriculum_id', $curriculum->id)
                ->where('subject_id', $subject->id)
                ->exists()) {
                throw ValidationException::withMessages([
                    'subject_id' => 'The selected subject is already placed in this Draft curriculum.',
                ]);
            }

            CurriculumSubject::create([
                'curriculum_id' => $curriculum->id,
                'subject_id' => $subject->id,
                'year_level' => $validatedData['year_level'],
                'semester' => $validatedData['semester'],
                'is_required' => true,
            ]);

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

    /**
     * @param  array{code?: string, title?: string, units?: float}  $validatedData
     */
    private function createSubject(User $actor, array $validatedData, AuditRequestContext $context): Subject
    {
        $subject = Subject::create([
            'college' => $actor->college,
            'code' => $validatedData['code'],
            'title' => $validatedData['title'],
            'units' => $validatedData['units'],
            'status' => SubjectStatus::Active,
        ]);

        $this->auditRecorder->record(
            $actor,
            AuditAction::SUBJECT_CREATED,
            AuditableType::SUBJECT,
            $subject->id,
            null,
            [
                'id' => $subject->id,
                'college' => $subject->college?->value,
                'code' => $subject->code,
                'title' => $subject->title,
                'units' => $subject->units,
                'status' => $subject->status->value,
            ],
            null,
            $context,
        );

        return $subject;
    }

    /**
     * @param  array{subject_id?: int}  $validatedData
     */
    private function eligibleExistingSubject(Curriculum $curriculum, array $validatedData): Subject
    {
        $source = $this->sourceResolver->execute($curriculum->program);
        $subject = $source?->subjectPlacements
            ->pluck('subject')
            ->firstWhere('id', $validatedData['subject_id']);

        if (! $subject instanceof Subject) {
            throw ValidationException::withMessages([
                'subject_id' => 'The selected subject is not in this program\'s current curriculum source.',
            ]);
        }

        return $subject;
    }
}
