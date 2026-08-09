<?php

namespace App\Actions\Faculty;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Faculty\SpecializationProficiency;
use App\Models\FacultySpecialization;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;

final class CreateFacultySpecialization
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    /** @param array{subject_id: int, proficiency?: string, notes?: ?string} $validatedData */
    public function execute(User $actor, array $validatedData, AuditRequestContext $context): FacultySpecialization
    {
        return DB::transaction(function () use ($actor, $validatedData, $context): FacultySpecialization {
            $specialization = FacultySpecialization::create([
                'professor_id' => $actor->id,
                'subject_id' => $validatedData['subject_id'],
                'proficiency' => $validatedData['proficiency'] ?? SpecializationProficiency::Secondary,
                'source' => 'declared',
                'notes' => $validatedData['notes'] ?? null,
            ]);
            $specialization->refresh();

            $this->auditRecorder->record(
                $actor,
                AuditAction::FACULTY_SPECIALIZATION_CREATED,
                AuditableType::FACULTY_SPECIALIZATION,
                $specialization->id,
                null,
                self::snapshot($specialization),
                null,
                $context,
            );

            return $specialization;
        });
    }

    /** @return array{professor_id: int, subject_id: int, proficiency: string, source: string, notes: ?string} */
    public static function snapshot(FacultySpecialization $specialization): array
    {
        return [
            'professor_id' => $specialization->professor_id,
            'subject_id' => $specialization->subject_id,
            'proficiency' => $specialization->proficiency->value,
            'source' => $specialization->source,
            'notes' => $specialization->notes,
        ];
    }
}
