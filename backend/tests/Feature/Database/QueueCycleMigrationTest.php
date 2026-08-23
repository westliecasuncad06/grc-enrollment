<?php

namespace Tests\Feature\Database;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\Enrollment;
use App\Models\Program;
use App\Models\QueueCycle;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class QueueCycleMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_queue_cycles_table_has_the_expected_columns(): void
    {
        self::assertTrue(Schema::hasColumns('queue_cycles', [
            'id', 'opened_on', 'last_claimed_on', 'last_ticket_sequence',
            'cut_off_at', 'cut_off_service_date', 'cut_off_by', 'closed_at',
            'open_marker', 'created_at', 'updated_at',
        ]));
    }

    public function test_queue_tickets_gained_the_cycle_columns(): void
    {
        self::assertTrue(Schema::hasColumns('queue_tickets', ['queue_cycle_id', 'ticket_sequence']));
    }

    public function test_only_one_open_cycle_is_allowed_at_a_time(): void
    {
        QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 0]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 0]);
    }

    public function test_a_closed_cycle_does_not_collide_with_a_new_open_one(): void
    {
        QueueCycle::create([
            'opened_on' => '2026-08-20', 'last_ticket_sequence' => 5, 'closed_at' => now(),
        ]);

        $secondCycle = QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 0]);

        self::assertNull($secondCycle->closed_at);
        self::assertSame(2, QueueCycle::query()->count());
    }

    public function test_queue_cycle_id_and_ticket_sequence_are_required(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $enrollment = $this->makeEnrollment($curriculum, $term, 'student.required@grc.test', '2026-9001');

        $this->expectException(\Illuminate\Database\QueryException::class);

        \Illuminate\Support\Facades\DB::table('queue_tickets')->insert([
            'enrollment_id' => $enrollment->id, 'ticket_number' => 'QZZZ', 'queue_date' => '2026-08-23',
            'status' => 'waiting', 'priority' => 'regular', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_ticket_sequence_is_unique_within_a_cycle(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $cycle = QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 1]);

        $firstEnrollment = $this->makeEnrollment($curriculum, $term, 'student.seq1@grc.test', '2026-9002');
        \Illuminate\Support\Facades\DB::table('queue_tickets')->insert([
            'enrollment_id' => $firstEnrollment->id, 'queue_cycle_id' => $cycle->id, 'ticket_sequence' => 1,
            'ticket_number' => 'Q001', 'queue_date' => '2026-08-23', 'status' => 'waiting',
            'priority' => 'regular', 'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        $secondEnrollment = $this->makeEnrollment($curriculum, $term, 'student.seq2@grc.test', '2026-9003');
        \Illuminate\Support\Facades\DB::table('queue_tickets')->insert([
            'enrollment_id' => $secondEnrollment->id, 'queue_cycle_id' => $cycle->id, 'ticket_sequence' => 1,
            'ticket_number' => 'Q002', 'queue_date' => '2026-08-23', 'status' => 'waiting',
            'priority' => 'regular', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function makeTerm(): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::SemesterOngoing,
        ]);
    }

    private function makeCurriculum(): Curriculum
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function makeEnrollment(Curriculum $curriculum, AcademicTerm $term, string $email, string $studentNumber): Enrollment
    {
        $user = User::create([
            'name' => 'Test Student', 'email' => $email,
            'password' => 'correct-horse-battery-staple', 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);

        $student = StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => $studentNumber,
            'program_id' => $curriculum->program_id,
            'curriculum_id' => $curriculum->id,
            'year_level' => 1,
            'admission_status' => AdmissionStatus::Admitted,
            'academic_standing' => AcademicStanding::Good,
        ]);

        return Enrollment::create([
            'student_id' => $student->id,
            'academic_term_id' => $term->id,
            'status' => EnrollmentStatus::PendingPayment,
            'total_units' => 3,
            'submitted_at' => now(),
        ]);
    }
}
