<?php

namespace Database\Seeders;

use App\Domain\Academic\GradeStatus;
use App\Domain\Academic\TransfereeCreditStatus;
use App\Domain\Enrollment\EnrollmentDocumentType;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Enrollment\EnrollmentSubjectStatus;
use App\Domain\Enrollment\QueueTicketStatus;
use App\Domain\Enrollment\WithdrawalStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\EnrollmentDocument;
use App\Models\EnrollmentSubject;
use App\Models\Payment;
use App\Models\Program;
use App\Models\QueueTicket;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\TransfereeCredit;
use App\Models\User;
use App\Models\WithdrawalRequest;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds a synthetic end-to-end enrollment dataset so every role portal has
 * realistic content to render.
 *
 * Four students deliberately sit at different points of the PRD §4.2
 * lifecycle, which between them exercise every §10.3 table and both halves of
 * the unique-active-enrollment rule:
 *
 *   0001  enrolled                     → queue ticket, payment, COM, past grades
 *   0002  pending_registrar_approval   → Registrar approval queue
 *   0003  pending_payment              → Accounting queue, plus transferee credit
 *   0004  withdrawn (terminal)         → withdrawal request; seat slot released
 *
 * NONE of this is real student data. Names, student numbers, grades, and the
 * payment reference are invented placeholders, and the emails use the reserved
 * `.test` TLD (RFC 2606) so they can never resolve to a real mailbox.
 *
 * Depends on RoleUserSeeder, ProgramSeeder, SubjectSeeder, CurriculumSeeder,
 * AcademicTermSeeder, and SectionSeeder.
 */
final class DemoEnrollmentSeeder extends Seeder
{
    /**
     * @var list<array{
     *     email: string, name: string, number: string,
     *     status: EnrollmentStatus, sections: list<array{subject: string, code: string}>
     * }>
     */
    private const STUDENTS = [
        [
            'email' => 'student.seed@grc.test',
            'name' => 'Seed Student',
            'number' => 'STU-2026-0001',
            'status' => EnrollmentStatus::Enrolled,
            'sections' => [
                ['subject' => 'CS102', 'code' => 'A'],
                ['subject' => 'PE101', 'code' => 'A'],
            ],
        ],
        [
            'email' => 'student2.seed@grc.test',
            'name' => 'Seed Student Two',
            'number' => 'STU-2026-0002',
            'status' => EnrollmentStatus::PendingRegistrarApproval,
            'sections' => [
                ['subject' => 'CS101', 'code' => 'A'],
                ['subject' => 'GE101', 'code' => 'A'],
            ],
        ],
        [
            'email' => 'student3.seed@grc.test',
            'name' => 'Seed Student Three',
            'number' => 'STU-2026-0003',
            'status' => EnrollmentStatus::PendingPayment,
            'sections' => [
                ['subject' => 'CS102', 'code' => 'B'],
                ['subject' => 'MATH101', 'code' => 'A'],
            ],
        ],
        [
            'email' => 'student4.seed@grc.test',
            'name' => 'Seed Student Four',
            'number' => 'STU-2026-0004',
            'status' => EnrollmentStatus::Withdrawn,
            'sections' => [
                ['subject' => 'GE101', 'code' => 'A'],
            ],
        ],
    ];

    /**
     * Past-term results for student 0001, which satisfy the CS102 → CS201 and
     * MATH101 → MATH102 prerequisite chains seeded by CurriculumSeeder.
     * Grades are placeholders; PRD §17 leaves the grading scale unconfirmed.
     *
     * @var list<array{subject: string, grade: string}>
     */
    private const PAST_GRADES = [
        ['subject' => 'CS101', 'grade' => '2.00'],
        ['subject' => 'MATH101', 'grade' => '2.50'],
        ['subject' => 'GE101', 'grade' => '1.75'],
    ];

    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            $activeTerm = $this->term(AcademicTermStatus::Active);
            $closedTerm = $this->term(AcademicTermStatus::Closed);
            $curriculum = $this->curriculum();
            $program = $curriculum->program;

            foreach (self::STUDENTS as $definition) {
                $profile = $this->studentProfile($definition, $program, $curriculum);
                $enrollment = $this->enrollment($profile, $activeTerm, $definition);

                $this->attachSections($enrollment, $activeTerm, $definition['sections']);
                $this->attachLifecycleRecords($enrollment, $definition['status']);
            }

            $this->seedPastGrades($closedTerm);
            $this->seedTransfereeCredit();
            $this->refreshSectionCounts();
        });
    }

    /**
     * @param  array{email: string, name: string, number: string, status: EnrollmentStatus, sections: list<array{subject: string, code: string}>}  $definition
     */
    private function studentProfile(array $definition, Program $program, Curriculum $curriculum): StudentProfile
    {
        $user = User::updateOrCreate(
            ['email' => $definition['email']],
            [
                'name' => $definition['name'],
                'password' => $this->seedPassword(),
                'role' => UserRole::Student,
                'status' => UserStatus::Active,
            ],
        );

        return StudentProfile::updateOrCreate(
            ['user_id' => $user->id],
            [
                'student_number' => $definition['number'],
                'program_id' => $program->id,
                'curriculum_id' => $curriculum->id,
                'year_level' => 1,
                'admission_status' => $definition['status'] === EnrollmentStatus::Enrolled
                    ? AdmissionStatus::Enrolled
                    : AdmissionStatus::Admitted,
                'academic_standing' => AcademicStanding::Good,
            ],
        );
    }

    /**
     * @param  array{email: string, name: string, number: string, status: EnrollmentStatus, sections: list<array{subject: string, code: string}>}  $definition
     */
    private function enrollment(
        StudentProfile $profile,
        AcademicTerm $term,
        array $definition,
    ): Enrollment {
        $status = $definition['status'];
        $units = $this->totalUnits($term, $definition['sections']);

        return Enrollment::updateOrCreate(
            ['student_id' => $profile->id, 'academic_term_id' => $term->id],
            [
                'status' => $status,
                'total_units' => $units,
                'submitted_at' => $status === EnrollmentStatus::Draft ? null : now(),
                'registrar_decided_at' => in_array($status, [
                    EnrollmentStatus::PendingPayment,
                    EnrollmentStatus::Enrolled,
                    EnrollmentStatus::Withdrawn,
                ], true) ? now() : null,
                'payment_confirmed_at' => $status === EnrollmentStatus::Enrolled ? now() : null,
                'enrolled_at' => $status === EnrollmentStatus::Enrolled ? now() : null,
            ],
        );
    }

    /**
     * @param  list<array{subject: string, code: string}>  $sections
     */
    private function attachSections(Enrollment $enrollment, AcademicTerm $term, array $sections): void
    {
        foreach ($sections as $reference) {
            $section = $this->section($term, $reference['subject'], $reference['code']);

            EnrollmentSubject::updateOrCreate(
                ['enrollment_id' => $enrollment->id, 'section_id' => $section->id],
                [
                    'status' => $enrollment->status === EnrollmentStatus::Withdrawn
                        ? EnrollmentSubjectStatus::Dropped
                        : EnrollmentSubjectStatus::Enrolled,
                ],
            );
        }
    }

    private function attachLifecycleRecords(Enrollment $enrollment, EnrollmentStatus $status): void
    {
        // A queue ticket exists from Registrar approval onward: PRD §4.2 rule 3
        // reserves it at submission, but payment only becomes actionable after
        // approval.
        if (in_array($status, [EnrollmentStatus::PendingPayment, EnrollmentStatus::Enrolled], true)) {
            QueueTicket::updateOrCreate(
                ['enrollment_id' => $enrollment->id],
                [
                    'ticket_number' => 'Q-2026-'.str_pad((string) $enrollment->id, 4, '0', STR_PAD_LEFT),
                    'queue_date' => now()->toDateString(),
                    'status' => $status === EnrollmentStatus::Enrolled
                        ? QueueTicketStatus::Served
                        : QueueTicketStatus::Waiting,
                    'served_at' => $status === EnrollmentStatus::Enrolled ? now() : null,
                ],
            );
        }

        if ($status === EnrollmentStatus::Enrolled) {
            Payment::updateOrCreate(
                ['enrollment_id' => $enrollment->id],
                [
                    'confirmed_by' => $this->userWithRole(UserRole::AccountingStaff)->id,
                    'external_reference' => 'OR-2026-'.str_pad((string) $enrollment->id, 6, '0', STR_PAD_LEFT),
                    'amount' => null,
                    'confirmed_at' => now(),
                ],
            );

            EnrollmentDocument::updateOrCreate(
                [
                    'enrollment_id' => $enrollment->id,
                    'document_type' => EnrollmentDocumentType::Com,
                ],
                [
                    'document_number' => 'COM-2026-'.str_pad((string) $enrollment->id, 6, '0', STR_PAD_LEFT),
                    'storage_path' => null,
                    'content_hash' => null,
                    'generated_at' => now(),
                ],
            );
        }

        if ($status === EnrollmentStatus::Withdrawn) {
            WithdrawalRequest::updateOrCreate(
                ['enrollment_id' => $enrollment->id],
                [
                    'reason' => 'Synthetic demo withdrawal: relocated to another institution.',
                    'status' => WithdrawalStatus::Approved,
                    'processed_by' => $this->userWithRole(UserRole::RegistrarHead)->id,
                    'processed_at' => now(),
                ],
            );
        }
    }

    private function seedPastGrades(AcademicTerm $closedTerm): void
    {
        $profile = StudentProfile::query()
            ->where('student_number', 'STU-2026-0001')
            ->firstOrFail();
        $encoder = $this->userWithRole(UserRole::Faculty);

        foreach (self::PAST_GRADES as $result) {
            $subject = Subject::query()->where('code', $result['subject'])->firstOrFail();

            AcademicGrade::updateOrCreate(
                [
                    'student_id' => $profile->id,
                    'subject_id' => $subject->id,
                    'academic_term_id' => $closedTerm->id,
                ],
                [
                    // Null section: these are historical results carried
                    // without an owning section, which is exactly the case
                    // PRD §10.3 makes `section_id` nullable for.
                    'section_id' => null,
                    'final_grade' => $result['grade'],
                    'remarks' => null,
                    'status' => GradeStatus::Locked,
                    'encoded_by' => $encoder->id,
                    'submitted_at' => now(),
                    'locked_at' => now(),
                ],
            );
        }
    }

    private function seedTransfereeCredit(): void
    {
        $profile = StudentProfile::query()
            ->where('student_number', 'STU-2026-0003')
            ->firstOrFail();

        TransfereeCredit::updateOrCreate(
            [
                'student_id' => $profile->id,
                'source_subject_code' => 'ITE-101',
            ],
            [
                'source_institution' => 'Synthetic Partner College',
                'source_subject_title' => 'Introduction to Information Technology',
                'source_grade' => '2.25',
                'credited_units' => 3,
                'subject_id' => Subject::query()->where('code', 'CS101')->value('id'),
                'status' => TransfereeCreditStatus::Approved,
                'processed_by' => $this->userWithRole(UserRole::RegistrarStaff)->id,
                'processed_at' => now(),
            ],
        );
    }

    /**
     * Recomputes each section's cached seat counter from the rows that actually
     * occupy a seat, rather than incrementing as we go. PRD §5.3 requires that
     * a withdrawal never decrement a section more than once — deriving the
     * count makes repeated seeding inherently idempotent.
     */
    private function refreshSectionCounts(): void
    {
        $occupied = EnrollmentSubject::query()
            ->whereNot('status', EnrollmentSubjectStatus::Dropped)
            ->selectRaw('section_id, COUNT(*) as seats')
            ->groupBy('section_id')
            ->pluck('seats', 'section_id');

        foreach (Section::query()->get() as $section) {
            $section->update([
                'enrolled_count' => (int) ($occupied[$section->id] ?? 0),
            ]);
        }
    }

    /**
     * @param  list<array{subject: string, code: string}>  $sections
     */
    private function totalUnits(AcademicTerm $term, array $sections): int
    {
        $units = 0;

        foreach ($sections as $reference) {
            $units += (int) $this->section($term, $reference['subject'], $reference['code'])
                ->subject
                ->units;
        }

        return $units;
    }

    private function section(AcademicTerm $term, string $subjectCode, string $sectionCode): Section
    {
        $subject = Subject::query()->where('code', $subjectCode)->firstOrFail();

        $section = Section::query()
            ->where('academic_term_id', $term->id)
            ->where('subject_id', $subject->id)
            ->where('section_code', $sectionCode)
            ->first();

        if ($section === null) {
            throw new RuntimeException(
                "Section {$subjectCode}-{$sectionCode} is missing. Run SectionSeeder first.",
            );
        }

        return $section;
    }

    private function term(AcademicTermStatus $status): AcademicTerm
    {
        $term = AcademicTerm::query()->where('status', $status)->first();

        if ($term === null) {
            throw new RuntimeException(
                "DemoEnrollmentSeeder requires a '{$status->value}' academic term. "
                .'Run AcademicTermSeeder first.',
            );
        }

        return $term;
    }

    private function curriculum(): Curriculum
    {
        $curriculum = Curriculum::query()
            ->where('name', 'BSCS Curriculum 2026')
            ->first();

        if ($curriculum === null) {
            throw new RuntimeException(
                'DemoEnrollmentSeeder requires the seeded BSCS curriculum. Run CurriculumSeeder first.',
            );
        }

        return $curriculum;
    }

    private function userWithRole(UserRole $role): User
    {
        $user = User::query()->where('role', $role)->first();

        if ($user === null) {
            throw new RuntimeException(
                "DemoEnrollmentSeeder requires a '{$role->value}' user. Run RoleUserSeeder first.",
            );
        }

        return $user;
    }

    /**
     * Fails closed, exactly as RoleUserSeeder does: an absent password must
     * stop the seeder rather than silently create accounts with an empty secret.
     */
    private function seedPassword(): string
    {
        $password = getenv('GRC_SEED_PASSWORD');

        if (! is_string($password) || trim($password) === '') {
            throw new RuntimeException(
                'GRC_SEED_PASSWORD is not set. Set it to a local development '
                .'secret before seeding; it is never committed or logged.',
            );
        }

        return $password;
    }

    /**
     * Synthetic student records must never reach a production-like environment.
     */
    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'DemoEnrollmentSeeder may only run in the local or testing environment. '
                .'Refusing to seed synthetic student data into "'.app()->environment().'".',
            );
        }
    }
}
