<?php

namespace App\Actions\Faculty;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Models\FacultyAvailability;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;

final class CreateFacultyAvailability
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    /**
     * @param  array{academic_term_id: int, day_of_week: int, starts_at_time: string, ends_at_time: string}  $validatedData
     */
    public function execute(User $actor, array $validatedData, AuditRequestContext $context): FacultyAvailability
    {
        return DB::transaction(function () use ($actor, $validatedData, $context): FacultyAvailability {
            $availability = FacultyAvailability::create([
                'professor_id' => $actor->id,
                'academic_term_id' => $validatedData['academic_term_id'],
                'day_of_week' => $validatedData['day_of_week'],
                'starts_at_time' => $validatedData['starts_at_time'],
                'ends_at_time' => $validatedData['ends_at_time'],
            ]);
            $availability->refresh();

            $this->auditRecorder->record(
                $actor,
                AuditAction::FACULTY_AVAILABILITY_CREATED,
                AuditableType::FACULTY_AVAILABILITY,
                $availability->id,
                null,
                self::snapshot($availability),
                null,
                $context,
            );

            return $availability;
        });
    }

    /** @return array{professor_id: int, academic_term_id: int, day_of_week: int, starts_at_time: string, ends_at_time: string} */
    private static function snapshot(FacultyAvailability $availability): array
    {
        return [
            'professor_id' => $availability->professor_id,
            'academic_term_id' => $availability->academic_term_id,
            'day_of_week' => $availability->day_of_week,
            'starts_at_time' => $availability->starts_at_time,
            'ends_at_time' => $availability->ends_at_time,
        ];
    }
}
