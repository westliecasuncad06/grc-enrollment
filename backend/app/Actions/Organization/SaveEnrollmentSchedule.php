<?php

namespace App\Actions\Organization;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Models\AcademicTerm;
use App\Models\AcademicTermEnrollmentWindow;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;

final class SaveEnrollmentSchedule
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    /**
     * @param  array{
     *     enrollment_opens_at: string,
     *     enrollment_closes_at: string,
     *     windows: list<array{audience: string, opens_at: ?string, closes_at: ?string}>
     * }  $validatedData
     */
    public function execute(
        AcademicTerm $term,
        array $validatedData,
        User $actor,
        AuditRequestContext $context,
    ): AcademicTerm {
        return DB::transaction(function () use ($term, $validatedData, $actor, $context): AcademicTerm {
            $lockedTerm = AcademicTerm::query()->whereKey($term->id)->lockForUpdate()->firstOrFail();
            $before = self::snapshot($lockedTerm);

            $lockedTerm->update([
                'enrollment_opens_at' => $validatedData['enrollment_opens_at'],
                'enrollment_closes_at' => $validatedData['enrollment_closes_at'],
            ]);
            $lockedTerm->refresh();

            foreach ($validatedData['windows'] as $window) {
                AcademicTermEnrollmentWindow::query()->updateOrCreate(
                    ['academic_term_id' => $lockedTerm->id, 'audience' => $window['audience']],
                    ['opens_at' => $window['opens_at'] ?? null, 'closes_at' => $window['closes_at'] ?? null],
                );
            }

            $this->auditRecorder->record(
                $actor,
                AuditAction::ACADEMIC_TERM_ENROLLMENT_SCHEDULE_UPDATED,
                AuditableType::ACADEMIC_TERM,
                $lockedTerm->id,
                $before,
                self::snapshot($lockedTerm),
                null,
                $context,
            );

            return $lockedTerm;
        });
    }

    /**
     * @return array{enrollment_opens_at: ?string, enrollment_closes_at: ?string}
     */
    private static function snapshot(AcademicTerm $term): array
    {
        return [
            'enrollment_opens_at' => $term->enrollment_opens_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'enrollment_closes_at' => $term->enrollment_closes_at?->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
