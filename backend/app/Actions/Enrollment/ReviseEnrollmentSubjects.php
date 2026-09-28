<?php

namespace App\Actions\Enrollment;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Domain\Enrollment\OverloadEvaluator;
use App\Domain\Enrollment\OverloadVerdict;
use App\Domain\Notifications\NotificationType;
use App\Models\Enrollment;
use App\Models\EnrollmentSubject;
use App\Models\Notification;
use App\Models\Section;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Lets a Program Head add or remove whole subjects from a student's
 * enrollment while it sits at their own review stage (owner-requested
 * feature, 2026-09-28: an overload or irregular student's submission may
 * need a subject swapped for one the student can actually take, decided by
 * the Program Head reviewing the prospectus — see `ProspectusDocument` in
 * the same review dialog).
 *
 * A full replacement list, not an add/remove delta: the caller sends the
 * complete set of section ids the enrollment should end up with, the same
 * shape `SubmitEnrollment` already validates from the student's own
 * submission. This is simpler to reason about than a delta and impossible to
 * apply out of order.
 *
 * Only legal while `pending_program_head_approval` — once the Registrar has
 * even seen it, this stage is over (mirrors `TransitionEnrollment`'s own
 * required-status guard). Seats are re-checked and locked exactly like
 * `SubmitEnrollment`; a subject dropped from the set releases its seat the
 * same way `TransitionEnrollment::releaseSeats` does for a terminal
 * transition. The hard overload ceiling still applies: a Program Head can
 * expand a student's load, but not past the curriculum's own maximum — the
 * same rule `SubmitEnrollment` enforces on the student's own submission.
 */
final readonly class ReviseEnrollmentSubjects
{
    public function __construct(
        private AuditRecorder $auditRecorder,
    ) {}

    /**
     * @param  list<int>  $sectionIds
     */
    public function execute(
        Enrollment $enrollment,
        array $sectionIds,
        User $actor,
        AuditRequestContext $context,
    ): Enrollment {
        return DB::transaction(function () use ($enrollment, $sectionIds, $actor, $context): Enrollment {
            $lockedEnrollment = Enrollment::query()
                ->whereKey($enrollment->id)
                ->lockForUpdate()
                ->with('student.curriculum')
                ->firstOrFail();

            if ($lockedEnrollment->status !== EnrollmentStatus::PendingProgramHeadApproval) {
                throw ValidationException::withMessages([
                    'section_ids' => "This enrollment must be 'pending_program_head_approval' to revise its subjects; it is currently '{$lockedEnrollment->status->value}'.",
                ]);
            }

            $beforeTotalUnits = (float) $lockedEnrollment->total_units;

            $existingSubjects = EnrollmentSubject::query()
                ->where('enrollment_id', $lockedEnrollment->id)
                ->lockForUpdate()
                ->with('section.subject')
                ->get();
            // Only a currently seat-occupying row counts as "already there" —
            // a subject dropped by an earlier revision (or by the original
            // submission) still has a row (the table's unique
            // (enrollment_id, section_id) pair), so re-adding it must revive
            // that row rather than insert a second one.
            $activeExistingSectionIds = $existingSubjects
                ->filter(fn (EnrollmentSubject $s): bool => $s->status->occupiesSeat())
                ->pluck('section_id')
                ->all();

            $keptIds = array_values(array_intersect($activeExistingSectionIds, $sectionIds));
            $addedIds = array_values(array_diff($sectionIds, $activeExistingSectionIds));
            $removedIds = array_values(array_diff($activeExistingSectionIds, $sectionIds));

            // Every section this revision touches, locked in one deterministic
            // order — the same lock-order discipline `SubmitEnrollment` follows,
            // so two concurrent revisions can never deadlock against each other.
            $touchedSectionIds = array_values(array_unique([...$addedIds, ...$removedIds]));
            $sections = Section::query()
                ->whereIn('id', $touchedSectionIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->with('subject')
                ->get()
                ->keyBy('id');

            foreach ($addedIds as $sectionId) {
                $section = $sections->get($sectionId);
                if ($section === null) {
                    throw ValidationException::withMessages([
                        'section_ids' => "Section {$sectionId} does not exist.",
                    ]);
                }
                if ($section->academic_term_id !== $lockedEnrollment->academic_term_id) {
                    throw ValidationException::withMessages([
                        'section_ids' => "{$section->section_code} is not offered in this enrollment's term.",
                    ]);
                }
                if ($section->remainingSeats() < 1) {
                    throw ValidationException::withMessages([
                        'section_ids' => "{$section->section_code} ({$section->subject->code}) no longer has an open seat.",
                    ]);
                }
            }

            $beforeSubjectCodes = $existingSubjects
                ->filter(fn (EnrollmentSubject $s): bool => $s->status->occupiesSeat())
                ->map(fn (EnrollmentSubject $s): string => $s->section->subject->code ?? (string) $s->section_id)
                ->all();

            foreach ($removedIds as $sectionId) {
                $subject = $existingSubjects->first(fn (EnrollmentSubject $s): bool => $s->section_id === $sectionId);
                if ($subject !== null && $subject->status->occupiesSeat()) {
                    $subject->update(['status' => EnrollmentSubjectStatus::Dropped]);
                    Section::query()->whereKey($sectionId)->where('enrolled_count', '>', 0)->decrement('enrolled_count');
                }
            }

            foreach ($addedIds as $sectionId) {
                // Revive a row dropped by an earlier revision/submission
                // rather than insert a second one — the unique
                // (enrollment_id, section_id) pair forbids a duplicate.
                $dropped = $existingSubjects->first(fn (EnrollmentSubject $s): bool => $s->section_id === $sectionId);
                if ($dropped !== null) {
                    $dropped->update(['status' => EnrollmentSubjectStatus::Selected]);
                } else {
                    EnrollmentSubject::create([
                        'enrollment_id' => $lockedEnrollment->id,
                        'section_id' => $sectionId,
                        'status' => EnrollmentSubjectStatus::Selected,
                    ]);
                }
                Section::query()->whereKey($sectionId)->increment('enrolled_count');
            }

            $finalSections = Section::query()
                ->whereIn('id', [...$keptIds, ...$addedIds])
                ->with('subject')
                ->get();
            $totalUnits = (float) $finalSections->sum(fn (Section $section): float => $section->subject->units);

            $student = $lockedEnrollment->student;
            $maxRegularUnits = $student->curriculum?->effectiveRegularUnits()
                ?? self::numericConfigValue('enrollment.max_regular_units');
            $overloadMaxUnits = $student->curriculum?->effectiveMaxUnits()
                ?? self::numericConfigValue('enrollment.overload_max_units');
            $verdict = OverloadEvaluator::evaluate($totalUnits, $maxRegularUnits, $overloadMaxUnits);

            if ($verdict === OverloadVerdict::Rejected) {
                throw ValidationException::withMessages([
                    'section_ids' => "This revision totals {$totalUnits} units, exceeding the maximum allowed load.",
                ]);
            }

            $lockedEnrollment->update([
                'total_units' => $totalUnits,
                'requires_overload_approval' => $verdict === OverloadVerdict::RequiresApproval,
            ]);
            $lockedEnrollment->refresh();

            $afterSubjectCodes = Section::query()->whereIn('id', [...$keptIds, ...$addedIds])->with('subject')->get()
                ->map(fn (Section $s): string => $s->subject->code ?? (string) $s->id)->all();

            $this->auditRecorder->record(
                $actor,
                AuditAction::ENROLLMENT_PROGRAM_HEAD_SUBJECTS_REVISED,
                AuditableType::ENROLLMENT,
                $lockedEnrollment->id,
                ['subjects' => $beforeSubjectCodes, 'total_units' => $beforeTotalUnits],
                ['subjects' => $afterSubjectCodes, 'total_units' => $totalUnits],
                null,
                $context,
            );

            if ($addedIds !== [] || $removedIds !== []) {
                Notification::create([
                    'user_id' => $student->user_id,
                    'type' => NotificationType::EnrollmentProgramHeadSubjectsRevised,
                    'message' => 'Your Program Head made changes to your enrollment\'s subjects while reviewing it. Please check your Enrollment page for the updated schedule.',
                ]);
            }

            return $lockedEnrollment->refresh()->load([
                'student', 'enrollmentSubjects.section.subject', 'enrollmentSubjects.section.professor', 'queueTicket', 'assessment.items',
            ]);
        });
    }

    private static function numericConfigValue(string $key): ?float
    {
        $raw = config($key);

        return is_numeric($raw) ? (float) $raw : null;
    }
}
