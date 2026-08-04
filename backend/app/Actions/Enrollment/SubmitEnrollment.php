<?php

namespace App\Actions\Enrollment;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Domain\Enrollment\OverloadEvaluator;
use App\Domain\Enrollment\OverloadVerdict;
use App\Domain\Identity\UserRole;
use App\Domain\Notifications\NotificationType;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use App\Models\EnrollmentSubject;
use App\Models\Notification;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Notifications\NotificationRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * DFD 2.4 "Finalize Subject Selection" (FR-ENR-007–009): atomically records
 * the verified subject selection as a Pending PEF record.
 * `StoreEnrollmentRequest` has already re-validated every submitted section
 * against a freshly built eligible pool before this executes — this action
 * only writes.
 *
 * The queue ticket is deliberately NOT created here — it is issued only once
 * Registrar Staff approves (`TransitionEnrollment`'s `registrar_approve`),
 * so a student sees "waiting for approval" with no queue number until then.
 * See ADR 0011/Phase 6 notes: this moved the Cashier queue ticket from
 * submission-time to approval-time.
 *
 * All writes happen in one transaction (FR-ENR-007's "submit atomically" and
 * its acceptance criterion: exactly one enrollment, the selected enrollment
 * subjects, one audit entry, and the appropriate notification).
 * `enrollments.active_academic_term_id`'s generated-column uniqueness
 * constraint is what actually prevents a duplicate active enrollment at the
 * database layer; the Form Request's pre-check exists only to turn that into
 * a clean 422 instead of a raw QueryException.
 *
 * Seats are re-checked here, inside the transaction, under row locks — the
 * Form Request's pool-based checks are a fast pre-check, not the
 * authoritative one, since a section's remaining seats can change between
 * the pool being built and this write running. A block submission locks
 * every one of its sections together in one deterministic order, so the
 * whole block is all-or-nothing: if any single subject in the block has
 * lost its last seat since the pool was built, nothing in the block is
 * written.
 */
final readonly class SubmitEnrollment
{
    public function __construct(
        private AuditRecorder $auditRecorder,
        private NotificationRecorder $notificationRecorder,
    ) {}

    /**
     * @param  list<int>  $sectionIds
     */
    public function execute(
        StudentProfile $student,
        AcademicTerm $term,
        array $sectionIds,
        User $actor,
        AuditRequestContext $context,
        ?string $blockCode = null,
    ): Enrollment {
        return DB::transaction(function () use ($student, $term, $sectionIds, $actor, $context, $blockCode): Enrollment {
            // `orderBy('id')` gives every concurrent submission the same
            // lock order; without it, two submissions sharing a subject
            // could lock in opposite orders and deadlock instead of one
            // simply waiting for the other.
            $sections = Section::query()
                ->whereIn('id', $sectionIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->with('subject')
                ->get();

            $oversold = $sections->first(fn (Section $section): bool => $section->remainingSeats() < 1);
            if ($oversold !== null) {
                throw ValidationException::withMessages([
                    'sections' => "{$oversold->section_code} ({$oversold->subject->code}) no longer has an open seat. Refresh and try again.",
                ]);
            }

            $totalUnits = (float) $sections->sum(fn (Section $section): float => $section->subject->units);

            // Recomputed from the locked, just-verified sections — not
            // trusted from StoreEnrollmentRequest's own pre-check — the
            // same authoritative-server pattern the oversold check above
            // already follows. A Rejected verdict here would mean the
            // section list changed between validation and this lock (the
            // same narrow race the oversold check guards against); it is
            // surfaced the identical way.
            $overloadVerdict = OverloadEvaluator::evaluate(
                $totalUnits,
                self::numericConfigValue('enrollment.max_regular_units'),
                self::numericConfigValue('enrollment.overload_max_units'),
            );
            if ($overloadVerdict === OverloadVerdict::Rejected) {
                throw ValidationException::withMessages([
                    'sections' => "This selection totals {$totalUnits} units, exceeding the maximum allowed load. Refresh and try again.",
                ]);
            }

            $enrollment = Enrollment::create([
                'student_id' => $student->id,
                'academic_term_id' => $term->id,
                'status' => EnrollmentStatus::PendingRegistrarApproval,
                'total_units' => $totalUnits,
                'requires_overload_approval' => $overloadVerdict === OverloadVerdict::RequiresApproval,
                'submitted_at' => now(),
            ]);

            foreach ($sectionIds as $sectionId) {
                EnrollmentSubject::create([
                    'enrollment_id' => $enrollment->id,
                    'section_id' => $sectionId,
                    'status' => EnrollmentSubjectStatus::Selected,
                ]);
            }

            Section::query()->whereIn('id', $sectionIds)->increment('enrolled_count');

            $this->auditRecorder->record(
                $actor,
                AuditAction::ENROLLMENT_SUBMITTED,
                AuditableType::ENROLLMENT,
                $enrollment->id,
                null,
                [
                    'student_id' => $enrollment->student_id,
                    'academic_term_id' => $enrollment->academic_term_id,
                    'section_ids' => $sectionIds,
                    'block_code' => $blockCode,
                    'total_units' => $enrollment->total_units,
                    'requires_overload_approval' => $enrollment->requires_overload_approval,
                ],
                null,
                $context,
            );

            Notification::create([
                'user_id' => $actor->id,
                'type' => NotificationType::EnrollmentSubmitted,
                'message' => sprintf(
                    'Your enrollment for %s %s has been submitted and is pending registrar approval. A queue number will be issued once it is approved.',
                    $term->school_year,
                    $term->semester,
                ),
            ]);

            $this->notificationRecorder->recordManyForRole(
                UserRole::RegistrarStaff,
                NotificationType::EnrollmentSubmitted,
                sprintf(
                    '%s submitted an enrollment for %s %s and is awaiting approval.',
                    $student->student_number,
                    $term->school_year,
                    $term->semester,
                ),
            );

            return $enrollment->refresh()->load(['student', 'enrollmentSubjects.section.subject', 'queueTicket', 'assessment.items']);
        });
    }

    private static function numericConfigValue(string $key): ?float
    {
        $raw = config($key);

        return is_numeric($raw) ? (float) $raw : null;
    }
}
