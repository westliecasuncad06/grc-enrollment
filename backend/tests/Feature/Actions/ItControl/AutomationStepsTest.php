<?php

namespace Tests\Feature\Actions\ItControl;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\ItControl\AutomationRunStatus;
use App\Domain\ItControl\AutomationStep;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Jobs\RunItControlAutomationStep;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Enrollment;
use App\Models\EnrollmentDocument;
use App\Models\ItControlAutomationRun;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

final class AutomationStepsTest extends TestCase
{
    use RefreshDatabase;

    private AcademicTerm $term;

    private User $itAdmin;

    public function test_the_six_steps_carry_the_whole_cohort_from_planning_to_enrolled(): void
    {
        $this->openEnrollmentTerm();

        foreach (AutomationStep::cases() as $step) {
            $run = $this->runStep($step);
            $this->assertContains($run->fresh()->status, [AutomationRunStatus::Succeeded, AutomationRunStatus::Partial]);
        }

        $this->assertSame(0, Enrollment::where('academic_term_id', $this->term->id)
            ->whereIn('status', ['draft', 'pending_registrar_approval', 'pending_payment'])->count());
        $this->assertGreaterThan(0, EnrollmentDocument::where('document_type', 'com')->count());
        $this->assertSame(
            StudentProfile::count(),
            Enrollment::where('academic_term_id', $this->term->id)->where('status', 'enrolled')->count(),
        );
    }

    public function test_a_step_records_a_warning_instead_of_failing_the_whole_run(): void
    {
        $this->makeTermAndItAdmin();
        $this->makeUnsatisfiableStudentScenario();

        $run = $this->runStep(AutomationStep::StudentsAutoEnroll);

        $this->assertSame(AutomationRunStatus::Partial, $run->fresh()->status);
        $this->assertSame(1, $run->failed_count);
        $this->assertNotEmpty($run->warnings);
    }

    public function test_step_one_fails_cleanly_when_the_prediction_service_is_unreachable(): void
    {
        $this->makeTermAndItAdmin();
        Http::fake(fn () => Http::response(null, 503));

        $run = $this->runStep(AutomationStep::ChairGenerateSections);

        $this->assertSame(AutomationRunStatus::Failed, $run->fresh()->status);
        $this->assertStringContainsString('prediction service', $run->fresh()->error_summary);
    }

    private function openEnrollmentTerm(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->makeTermAndItAdmin();
    }

    private function makeTermAndItAdmin(): void
    {
        $this->term = AcademicTerm::create([
            'school_year' => '2027-2028',
            'semester' => '2nd',
            'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        $this->itAdmin = User::create([
            'name' => 'IT Control',
            'email' => 'it-control@grc.test',
            'password' => 'password',
            'role' => UserRole::ItAdmin,
            'status' => UserStatus::Active,
        ]);
    }

    private function makeUnsatisfiableStudentScenario(): void
    {
        User::create([
            'name' => 'Registrar', 'email' => 'registrar@grc.test', 'password' => 'password',
            'role' => UserRole::RegistrarStaff, 'status' => UserStatus::Active,
        ]);
        $program = Program::create(['code' => 'TST', 'name' => 'Test Program', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'Test Curriculum',
            'effective_school_year' => '2027-2028', 'status' => CurriculumStatus::Active,
        ]);
        $studentUser = User::create([
            'name' => 'Blocked Student', 'email' => 'blocked@student.grc.test', 'password' => 'password',
            'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);
        StudentProfile::create([
            'user_id' => $studentUser->id, 'student_number' => 'TST-001', 'program_id' => $program->id,
            'curriculum_id' => $curriculum->id, 'year_level' => 1,
            'admission_status' => AdmissionStatus::Admitted, 'academic_standing' => AcademicStanding::Good,
        ]);
        $required = Subject::create(['code' => 'TST101', 'title' => 'Required', 'units' => 3, 'status' => SubjectStatus::Active]);
        CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $required->id,
            'year_level' => 1, 'semester' => '2nd', 'is_required' => true,
        ]);

        $otherProgram = Program::create(['code' => 'OTH', 'name' => 'Other Program', 'status' => ProgramStatus::Active]);
        $otherCurriculum = Curriculum::create([
            'program_id' => $otherProgram->id, 'name' => 'Other Curriculum',
            'effective_school_year' => '2027-2028', 'status' => CurriculumStatus::Active,
        ]);
        $otherSubject = Subject::create(['code' => 'OTH101', 'title' => 'Other', 'units' => 3, 'status' => SubjectStatus::Active]);
        $plan = AcademicTermSectionPlan::create([
            'academic_term_id' => $this->term->id, 'curriculum_id' => $otherCurriculum->id,
            'college' => 'ccs', 'year_level' => 1, 'section_count' => 1,
            'students_per_block' => 40, 'status' => 'submitted',
        ]);
        Section::create([
            'academic_term_id' => $this->term->id, 'section_plan_id' => $plan->id,
            'subject_id' => $otherSubject->id, 'section_code' => 'OTH101', 'capacity' => 40,
            'enrolled_count' => 0, 'is_block_exclusive' => true, 'status' => SectionStatus::Published,
        ]);
    }

    private function runStep(AutomationStep $step): ItControlAutomationRun
    {
        $run = ItControlAutomationRun::create([
            'step' => $step,
            'academic_term_id' => $this->term->id,
            'status' => AutomationRunStatus::Queued,
            'initiated_by' => $this->itAdmin->id,
        ]);

        try {
            (new RunItControlAutomationStep($run->id))->handle();
        } catch (\Throwable) {
            // Queue workers retry after the durable failure state is written.
        }

        return $run->fresh();
    }
}
