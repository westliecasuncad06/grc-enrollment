<?php

namespace Tests\Feature\Actions\ItControl;

use App\Actions\ItControl\ManagesAutomationRun;
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
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Enrollment;
use App\Models\EnrollmentDocument;
use App\Models\FacultyAvailability;
use App\Models\FacultyCurriculumSubjectPreference;
use App\Models\ItControlAutomationRun;
use App\Models\Program;
use App\Models\RoomCatalogEntry;
use App\Models\Section;
use App\Models\SectionDemandObservation;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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

    public function test_student_automation_does_not_skip_lower_ids_after_curriculum_ordering(): void
    {
        $this->makeTermAndItAdmin();
        $this->makeSelectableStudentsWithNonMonotonicCurriculumIds();

        $run = $this->runStep(AutomationStep::StudentsAutoEnroll);

        $this->assertSame(400, $run->processed_count);
        $this->assertSame(0, $run->failed_count);
        $this->assertSame(400, Enrollment::where('academic_term_id', $this->term->id)->count());
    }

    public function test_a_classification_failure_is_recorded_and_later_students_continue(): void
    {
        $this->makeTermAndItAdmin();
        $students = $this->makeSelectableStudents(2);
        $throwOnce = true;
        AuditLog::creating(static function () use (&$throwOnce): void {
            if ($throwOnce) {
                $throwOnce = false;
                throw new \RuntimeException('classification audit failed');
            }
        });

        try {
            $run = $this->runStep(AutomationStep::StudentsAutoEnroll);
        } finally {
            AuditLog::flushEventListeners();
            AuditLog::clearBootedModels();
        }

        $this->assertSame(AutomationRunStatus::Partial, $run->status);
        $this->assertSame(1, $run->failed_count);
        $this->assertSame(1, $run->processed_count);
        $this->assertStringContainsString($students[0]->student_number, implode(' ', $run->warnings ?? []));
        $this->assertDatabaseHas('enrollments', ['student_id' => $students[1]->id, 'academic_term_id' => $this->term->id]);
    }

    public function test_generation_warnings_are_preserved_on_the_durable_automation_run(): void
    {
        $this->makeTermAndItAdmin();
        $this->makeProgramChairs();
        Http::fake(fn () => Http::response(['data' => ['service' => 'grc-prediction-service', 'status' => 'ok', 'schema_version' => 'v1']], 200));

        $run = $this->runStep(AutomationStep::ChairGenerateSections);

        $this->assertSame(AutomationRunStatus::Partial, $run->status);
        $this->assertStringContainsString('No current-term curriculum subjects were found', implode(' ', $run->warnings ?? []));
    }

    public function test_throughput_is_logged_at_every_five_hundred_processed_records(): void
    {
        $this->makeTermAndItAdmin();
        Log::spy();
        $counter = new class
        {
            use ManagesAutomationRun;

            public function record(ItControlAutomationRun $run): void
            {
                $this->processed($run);
            }
        };
        $run = ItControlAutomationRun::create([
            'step' => AutomationStep::StudentsAutoEnroll,
            'academic_term_id' => $this->term->id,
            'status' => AutomationRunStatus::Running,
            'initiated_by' => $this->itAdmin->id,
        ]);

        foreach (range(1, 500) as $_) {
            $counter->record($run);
        }

        Log::shouldHaveReceived('info')->once()->with('IT-control automation throughput', [
            'automation_run_id' => $run->id,
            'step' => AutomationStep::StudentsAutoEnroll->value,
            'processed_count' => 500,
        ]);
    }

    public function test_durable_warning_strings_are_bounded(): void
    {
        $this->makeTermAndItAdmin();
        $writer = new class
        {
            use ManagesAutomationRun;

            public function write(ItControlAutomationRun $run, string $message): void
            {
                $this->warning($run, $message);
            }
        };
        $run = ItControlAutomationRun::create([
            'step' => AutomationStep::StudentsAutoEnroll,
            'academic_term_id' => $this->term->id,
            'status' => AutomationRunStatus::Running,
            'initiated_by' => $this->itAdmin->id,
        ]);

        $writer->write($run, str_repeat('x', 1001));

        $this->assertLessThanOrEqual(500, mb_strlen($run->fresh()->warnings[0]));
    }

    public function test_a_fake_contract_safe_scheduler_response_reaches_a_terminal_run(): void
    {
        $this->makeTermAndItAdmin();
        $this->makeProgramChairs();
        [$curriculum, $subject] = $this->makePredictableCcsCurriculum();
        $key = "{$curriculum->id}:{$subject->id}:1";
        Http::fake(function (Request $request) use ($key) {
            if ($request->method() === 'GET') {
                return Http::response(['data' => ['service' => 'grc-prediction-service', 'status' => 'ok', 'schema_version' => 'v1']], 200);
            }

            return Http::response(['data' => [
                'model_version' => 'section-demand-rf-v1', 'feature_schema_version' => 'v1', 'strategy' => 'deterministic_test',
                'forecasts' => [[
                    'key' => $key, 'predicted_demand' => 40, 'confidence_lower' => 35, 'confidence_upper' => 45, 'suggested_section_count' => 1,
                ]],
            ]], 200);
        });

        $run = $this->runStep(AutomationStep::ChairGenerateSections);

        $this->assertContains($run->status, [AutomationRunStatus::Succeeded, AutomationRunStatus::Partial], $run->error_summary ?? '');
        Http::assertSent(fn (Request $request): bool => $request->method() === 'POST'
            && $request->url() === 'http://127.0.0.1:8100/internal/v1/section-demand/predict'
            && $request['data']['targets'][0]['key'] === $key);
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

    /** @return list<StudentProfile> */
    private function makeSelectableStudents(int $count): array
    {
        $this->makeRegistrar();
        $program = Program::create(['code' => 'SEL', 'name' => 'Selectable Program', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'Selectable Curriculum',
            'effective_school_year' => '2027-2028', 'status' => CurriculumStatus::Active,
        ]);
        $this->makeSelectableSection($curriculum, 'SEL101', $count + 1);

        return array_map(fn (int $number): StudentProfile => $this->makeStudent($program, $curriculum, "SEL-{$number}", "selectable-{$number}@student.grc.test"), range(1, $count));
    }

    private function makeSelectableStudentsWithNonMonotonicCurriculumIds(): void
    {
        $this->makeRegistrar();
        $firstProgram = Program::create(['code' => 'ONE', 'name' => 'First Program', 'status' => ProgramStatus::Active]);
        $firstCurriculum = Curriculum::create(['program_id' => $firstProgram->id, 'name' => 'First Curriculum', 'effective_school_year' => '2027-2028', 'status' => CurriculumStatus::Active]);
        $secondProgram = Program::create(['code' => 'TWO', 'name' => 'Second Program', 'status' => ProgramStatus::Active]);
        $secondCurriculum = Curriculum::create(['program_id' => $secondProgram->id, 'name' => 'Second Curriculum', 'effective_school_year' => '2027-2028', 'status' => CurriculumStatus::Active]);
        $this->makeSelectableSection($firstCurriculum, 'ONE101', 250);
        $this->makeSelectableSection($secondCurriculum, 'TWO101', 250);

        foreach (range(1, 200) as $number) {
            $this->makeStudent($secondProgram, $secondCurriculum, "TWO-{$number}", "two-{$number}@student.grc.test");
        }
        foreach (range(1, 200) as $number) {
            $this->makeStudent($firstProgram, $firstCurriculum, "ONE-{$number}", "one-{$number}@student.grc.test");
        }
    }

    private function makeRegistrar(): void
    {
        User::firstOrCreate(['email' => 'registrar@grc.test'], [
            'name' => 'Registrar', 'password' => 'password', 'role' => UserRole::RegistrarStaff, 'status' => UserStatus::Active,
        ]);
    }

    private function makeSelectableSection(Curriculum $curriculum, string $code, int $capacity): void
    {
        $subject = Subject::create(['code' => $code, 'title' => $code, 'units' => 3, 'status' => SubjectStatus::Active]);
        CurriculumSubject::create(['curriculum_id' => $curriculum->id, 'subject_id' => $subject->id, 'year_level' => 1, 'semester' => '2nd', 'is_required' => true]);
        $plan = AcademicTermSectionPlan::create([
            'academic_term_id' => $this->term->id, 'curriculum_id' => $curriculum->id,
            'college' => 'ccs', 'year_level' => 1, 'section_count' => 1, 'students_per_block' => $capacity, 'status' => 'submitted',
        ]);
        Section::create([
            'academic_term_id' => $this->term->id, 'section_plan_id' => $plan->id, 'subject_id' => $subject->id,
            'section_code' => $code, 'capacity' => $capacity, 'enrolled_count' => 0, 'is_block_exclusive' => true, 'status' => SectionStatus::Published,
            'schedule_days' => 'M', 'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00', 'room' => 'R-101',
        ]);
    }

    private function makeStudent(Program $program, Curriculum $curriculum, string $number, string $email): StudentProfile
    {
        $user = User::create(['name' => $number, 'email' => $email, 'password' => 'password', 'role' => UserRole::Student, 'status' => UserStatus::Active]);

        return StudentProfile::create([
            'user_id' => $user->id, 'student_number' => $number, 'program_id' => $program->id, 'curriculum_id' => $curriculum->id,
            'year_level' => 1, 'admission_status' => AdmissionStatus::Admitted, 'academic_standing' => AcademicStanding::Good,
        ]);
    }

    private function makeProgramChairs(): void
    {
        foreach (['ccs', 'coe', 'coa', 'cbae'] as $college) {
            User::create(['name' => strtoupper($college).' Chair', 'email' => "{$college}.chair@grc.test", 'password' => 'password', 'role' => UserRole::ProgramChair, 'college' => $college, 'status' => UserStatus::Active]);
        }
    }

    /** @return array{Curriculum, Subject} */
    private function makePredictableCcsCurriculum(): array
    {
        $program = Program::create(['code' => 'PRD', 'college' => 'ccs', 'name' => 'Predictable Program', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create(['program_id' => $program->id, 'name' => 'Predictable Curriculum', 'effective_school_year' => '2027-2028', 'status' => CurriculumStatus::Active]);
        $subject = Subject::create(['code' => 'PRD101', 'college' => 'ccs', 'title' => 'Predictable Subject', 'units' => 3, 'room_requirement' => 'lecture', 'status' => SubjectStatus::Active]);
        CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id, 'year_level' => 1, 'semester' => '2nd', 'is_required' => true,
            'reference_day' => 'M', 'reference_start_time' => '08:00:00', 'reference_end_time' => '09:00:00', 'reference_modality' => 'f2f',
        ]);
        $history = AcademicTerm::create(['school_year' => '2027-2028', 'semester' => '1st', 'status' => AcademicTermStatus::Archived]);
        SectionDemandObservation::create([
            'academic_term_id' => $history->id, 'program_id' => $program->id, 'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'college' => 'ccs', 'year_level' => 1, 'cohort_size' => 40, 'enrolled_count' => 40, 'section_count' => 1, 'offered_capacity' => 40,
            'source' => 'test',
        ]);
        $faculty = User::create(['name' => 'Predictable Faculty', 'email' => 'predictable.faculty@grc.test', 'password' => 'password', 'role' => UserRole::Faculty, 'college' => 'ccs', 'status' => UserStatus::Active]);
        FacultyCurriculumSubjectPreference::create(['professor_id' => $faculty->id, 'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id, 'semester' => '2nd', 'rank' => 1, 'origin' => 'test']);
        FacultyAvailability::create(['professor_id' => $faculty->id, 'day_of_week' => 1, 'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00', 'origin' => 'test']);
        RoomCatalogEntry::create(['name' => 'R-101', 'college' => 'ccs', 'capacity' => 40, 'room_type' => 'lecture']);

        return [$curriculum, $subject];
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
