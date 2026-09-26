<?php

namespace App\Actions\Academic;

use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Notifications\NotificationType;
use App\Models\StudentProfile;
use App\Models\TransfereeCredit;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use App\Support\Notifications\NotificationRecorder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Records one credit request: asked for by the Student for themselves, or
 * recorded by a Program Chair for a student in their college (ADR 0026). It
 * always starts `pending` — recording grants nothing; the Program Chair maps
 * and endorses it and Registrar Staff approve it (`UpdateTransfereeCredit`).
 *
 * Who the credit is for is decided here, not by the payload: a Student's
 * `student_id` is pinned to their own profile and anything they send is
 * ignored, and a Program Chair may only name a student in their own college.
 * `subject_id` is never guessed — the mapping is the Program Chair's decision
 * (`SuggestCreditSubjects` only advises).
 *
 * Asking twice is safe: an identical request (same student, school, subject
 * title and code) that is still open returns the existing row instead of a
 * duplicate.
 */
final readonly class CreateTransfereeCredit
{
    public function __construct(
        private AuditRecorder $auditRecorder,
        private NotificationRecorder $notificationRecorder,
    ) {}

    /**
     * @param  array<string, mixed>  $validated
     *
     * @throws AuthorizationException
     */
    public function execute(array $validated, User $actor, AuditRequestContext $context): TransfereeCredit
    {
        $student = $this->resolveStudent($validated, $actor);

        $institution = trim((string) $validated['source_institution']);
        $title = trim((string) $validated['source_subject_title']);
        $code = trim((string) ($validated['source_subject_code'] ?? ''));

        return DB::transaction(function () use ($validated, $actor, $context, $student, $institution, $title, $code): TransfereeCredit {
            $existing = TransfereeCredit::query()
                ->where('student_id', $student->id)
                ->whereIn('status', [TransfereeCreditStatus::Pending->value, TransfereeCreditStatus::Endorsed->value])
                ->whereRaw('LOWER(TRIM(source_institution)) = ?', [mb_strtolower($institution)])
                ->whereRaw('LOWER(TRIM(source_subject_title)) = ?', [mb_strtolower($title)])
                ->whereRaw('LOWER(TRIM(source_subject_code)) = ?', [mb_strtolower($code)])
                ->lockForUpdate()
                ->first();

            if ($existing !== null) {
                return $existing->load(['student.user', 'subject']);
            }

            $credit = TransfereeCredit::create([
                'student_id' => $student->id,
                'source_institution' => $institution,
                'source_subject_code' => $code,
                'source_subject_title' => $title,
                'source_grade' => $validated['source_grade'] ?? null,
                'credited_units' => $validated['credited_units'],
                'source_school_year' => $validated['source_school_year'] ?? null,
                'source_semester' => $validated['source_semester'] ?? null,
                'subject_id' => $actor->role === UserRole::Student ? null : ($validated['subject_id'] ?? null),
                'requested_by' => $actor->id,
                'status' => TransfereeCreditStatus::Pending,
            ]);

            $this->auditRecorder->record(
                $actor,
                AuditAction::TRANSFEREE_CREDIT_CREATED,
                AuditableType::TRANSFEREE_CREDIT,
                $credit->id,
                null,
                [
                    'student_id' => $credit->student_id,
                    'subject_id' => $credit->subject_id,
                    'credited_units' => $credit->credited_units,
                    'status' => $credit->status->value,
                ],
                null,
                $context,
            );

            if ($actor->role === UserRole::Student) {
                $this->notifyProgramChairs($student, $credit);
            }

            return $credit->refresh()->load(['student.user', 'subject']);
        });
    }

    /**
     * @param  array<string, mixed>  $validated
     *
     * @throws AuthorizationException
     */
    private function resolveStudent(array $validated, User $actor): StudentProfile
    {
        if ($actor->role === UserRole::Student) {
            $profile = StudentProfile::query()->with('program')->where('user_id', $actor->id)->first();

            if ($profile === null) {
                throw ValidationException::withMessages(['student_id' => 'Your student record could not be found.']);
            }

            return $profile;
        }

        $studentId = $validated['student_id'] ?? null;
        if ($studentId === null) {
            throw ValidationException::withMessages(['student_id' => 'Choose the student this credit is for.']);
        }

        $student = StudentProfile::query()->with('program')->findOrFail((int) $studentId);

        if (
            $actor->role === UserRole::ProgramChair
            && $actor->college !== null
            && $student->program->college !== $actor->college
        ) {
            throw new AuthorizationException('This student is not in your college.');
        }

        return $student;
    }

    /**
     * The Program Chairs who can see this credit: those of the student's
     * college, and any chair without an assigned college (who is unscoped).
     */
    private function notifyProgramChairs(StudentProfile $student, TransfereeCredit $credit): void
    {
        $college = $student->program->college;

        $chairIds = User::query()
            ->where('role', UserRole::ProgramChair->value)
            ->where('status', UserStatus::Active->value)
            ->where(function (Builder $query) use ($college): void {
                $query->whereNull('college');

                if ($college !== null) {
                    $query->orWhere('college', $college->value);
                }
            })
            ->pluck('id')
            ->map(static fn (mixed $id): int => (int) $id)
            ->all();

        $this->notificationRecorder->recordMany(
            array_values($chairIds),
            NotificationType::TransfereeCreditRequested,
            "Student {$student->student_number} asked for a credit mapping: ".
            "{$credit->source_subject_title} from {$credit->source_institution}.",
        );
    }
}
