<?php

namespace Tests\Feature\Actions\ItControl;

use App\Actions\ItControl\ManagesAutomationRun;
use App\Domain\Audit\AuditAction;
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
use App\Domain\Organization\SectionPlanStatus;
use App\Domain\Scheduling\SectionConflictDetector;
use App\Domain\Scheduling\SectionModality;
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
use Illuminate\Events\Dispatcher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
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
        $this->assertSame(1, $run->processed_count, implode(' ', $run->warnings ?? []));
        $this->assertStringContainsString($students[0]->student_number, implode(' ', $run->warnings ?? []));
        $this->assertDatabaseHas('enrollments', ['student_id' => $students[1]->id, 'academic_term_id' => $this->term->id]);
    }

    public function test_regular_auto_enrollment_preserves_the_selected_block_code_in_the_audit(): void
    {
        $this->makeTermAndItAdmin();
        $this->makeSelectableStudents(1);

        $run = $this->runStep(AutomationStep::StudentsAutoEnroll);

        $this->assertSame(AutomationRunStatus::Succeeded, $run->status);
        $submission = AuditLog::query()->where('action', AuditAction::ENROLLMENT_SUBMITTED)->sole();
        $this->assertSame('SEL101', $submission->after_values['block_code'] ?? null);
    }

    public function test_irregular_auto_enrollment_skips_pairwise_conflicts_before_a_com_is_created(): void
    {
        $this->makeTermAndItAdmin();
        [$student, $firstFixtureSection, $secondFixtureSection] = $this->makeIrregularStudentWithConflictingSections();
        $this->assertTrue(app(SectionConflictDetector::class)->hasConflict(
            [
                'schedule_days' => $secondFixtureSection->schedule_days,
                'starts_at_time' => $secondFixtureSection->starts_at_time,
                'ends_at_time' => $secondFixtureSection->ends_at_time,
            ],
            [[
                'schedule_days' => $firstFixtureSection->schedule_days,
                'starts_at_time' => $firstFixtureSection->starts_at_time,
                'ends_at_time' => $firstFixtureSection->ends_at_time,
            ]],
        ));

        $this->assertSame(AutomationRunStatus::Succeeded, $this->runStep(AutomationStep::StudentsAutoEnroll)->status);
        $this->assertSame(AutomationRunStatus::Succeeded, $this->runStep(AutomationStep::RegistrarApproveAll)->status);
        $this->assertSame(AutomationRunStatus::Succeeded, $this->runStep(AutomationStep::CashierConfirmAll)->status);

        $enrollment = Enrollment::query()
            ->where('student_id', $student->id)
            ->where('academic_term_id', $this->term->id)
            ->with('enrollmentSubjects')
            ->sole();

        $this->assertCount(1, $enrollment->enrollmentSubjects);
        $this->assertDatabaseHas('enrollment_documents', [
            'enrollment_id' => $enrollment->id,
            'document_type' => 'com',
        ]);
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
        [$curriculum, $subjects] = $this->makePredictableCcsCurriculum();
        $keys = array_map(fn (Subject $subject, int $yearLevel): string => "{$curriculum->id}:{$subject->id}:{$yearLevel}", $subjects, range(1, 4));
        Http::fake(function (Request $request) use ($keys) {
            if ($request->method() === 'GET') {
                return Http::response(['data' => ['service' => 'grc-prediction-service', 'status' => 'ok', 'schema_version' => 'v1']], 200);
            }

            return Http::response(['data' => [
                'model_version' => 'section-demand-rf-v1', 'feature_schema_version' => 'v1', 'strategy' => 'deterministic_test',
                'forecasts' => array_map(fn (string $key): array => [
                    'key' => $key, 'predicted_demand' => 40, 'confidence_lower' => 35, 'confidence_upper' => 45, 'suggested_section_count' => 1,
                ], $keys),
            ]], 200);
        });

        $run = $this->runStep(AutomationStep::ChairGenerateSections);

        $this->assertContains($run->status, [AutomationRunStatus::Succeeded, AutomationRunStatus::Partial], $run->error_summary ?? '');
        $this->assertSame(1, $run->processed_count, implode(' ', $run->warnings ?? []));
        $this->assertDatabaseHas('schedule_proposals', [
            'academic_term_id' => $this->term->id,
            'college' => 'ccs',
            'submitted_by' => User::where('email', 'ccs.chair@grc.test')->sole()->id,
            'status' => 'draft',
        ]);
        $this->assertSame(4, AcademicTermSectionPlan::query()->where('academic_term_id', $this->term->id)->where('curriculum_id', $curriculum->id)->where('status', 'submitted')->count());
        $this->assertDatabaseHas('sections', [
            'academic_term_id' => $this->term->id,
            'subject_id' => $subjects[0]->id,
            'status' => 'planned',
        ]);
        Http::assertSent(fn (Request $request): bool => $request->method() === 'POST'
            && $request->url() === 'http://127.0.0.1:8100/internal/v1/section-demand/predict'
            && $request['data']['targets'][0]['key'] === $keys[0]);
    }

    public function test_section_plan_submissions_stream_more_than_two_hundred_curricula_in_bounded_batches(): void
    {
        $this->makeTermAndItAdmin();
        $this->makeProgramChairs();
        $this->makeViableCcsPlans(201);
        foreach (['coe', 'coa', 'cbae'] as $college) {
            $this->makeViablePlanForCollege($college);
        }
        Http::fake(fn () => Http::response(['data' => ['service' => 'grc-prediction-service', 'status' => 'ok', 'schema_version' => 'v1']], 200));

        $connection = DB::connection();
        $eventDispatcher = $connection->getEventDispatcher();
        $connection->setEventDispatcher(new Dispatcher(app()));
        DB::listen(static function ($query): void {
            if (str_contains($query->sql, 'select `curriculum_id` from `academic_term_section_plans`')
                && ! str_contains($query->sql, 'limit 200')) {
                throw new \RuntimeException('Unbounded curriculum submission query.');
            }
        });

        try {
            $run = $this->runStep(AutomationStep::ChairGenerateSections);
        } finally {
            $connection->setEventDispatcher($eventDispatcher);
        }

        $this->assertContains($run->status, [AutomationRunStatus::Succeeded, AutomationRunStatus::Partial]);
        $this->assertSame(204, $run->processed_count, implode(' ', $run->warnings ?? []));
        $this->assertSame(0, $run->failed_count, implode(' ', $run->warnings ?? []));
        $this->assertDatabaseHas('schedule_proposals', [
            'academic_term_id' => $this->term->id,
            'college' => 'ccs',
            'submitted_by' => User::where('email', 'ccs.chair@grc.test')->sole()->id,
            'status' => 'draft',
        ]);
        $this->assertSame(804, AcademicTermSectionPlan::query()->where('academic_term_id', $this->term->id)->where('college', 'ccs')->where('status', SectionPlanStatus::Submitted->value)->count());
        $this->assertDatabaseHas('academic_term_section_plans', ['academic_term_id' => $this->term->id, 'curriculum_id' => 200, 'status' => SectionPlanStatus::Submitted->value]);
        $this->assertDatabaseHas('academic_term_section_plans', ['academic_term_id' => $this->term->id, 'curriculum_id' => 201, 'status' => SectionPlanStatus::Submitted->value]);
        $this->assertDatabaseHas('sections', ['academic_term_id' => $this->term->id, 'section_plan_id' => 800, 'status' => SectionStatus::Planned->value]);
        $this->assertDatabaseHas('sections', ['academic_term_id' => $this->term->id, 'section_plan_id' => 804, 'status' => SectionStatus::Planned->value]);
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

    /** @return array{StudentProfile, Section, Section} */
    private function makeIrregularStudentWithConflictingSections(): array
    {
        $this->makeRegistrar();
        User::create([
            'name' => 'Accounting',
            'email' => 'accounting@grc.test',
            'password' => 'password',
            'role' => UserRole::AccountingStaff,
            'status' => UserStatus::Active,
        ]);
        $program = Program::create(['code' => 'IRR', 'name' => 'Irregular Program', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id,
            'name' => 'Irregular Curriculum',
            'effective_school_year' => '2027-2028',
            'status' => CurriculumStatus::Active,
        ]);
        $missing = Subject::create(['code' => 'IRR101', 'title' => 'Missing prior subject', 'units' => 3, 'status' => SubjectStatus::Active]);
        CurriculumSubject::create([
            'curriculum_id' => $curriculum->id,
            'subject_id' => $missing->id,
            'year_level' => 1,
            'semester' => '1st',
            'is_required' => true,
        ]);
        $plan = AcademicTermSectionPlan::create([
            'academic_term_id' => $this->term->id,
            'curriculum_id' => $curriculum->id,
            'college' => 'ccs',
            'year_level' => 2,
            'section_count' => 1,
            'students_per_block' => 40,
            'status' => SectionPlanStatus::Submitted,
        ]);

        $createSection = function (string $code) use ($curriculum, $plan): Section {
            $subject = Subject::create(['code' => $code, 'title' => $code, 'units' => 3, 'status' => SubjectStatus::Active]);
            CurriculumSubject::create([
                'curriculum_id' => $curriculum->id,
                'subject_id' => $subject->id,
                'year_level' => 2,
                'semester' => '2nd',
                'is_required' => true,
            ]);

            return Section::create([
                'academic_term_id' => $this->term->id,
                'section_plan_id' => $plan->id,
                'subject_id' => $subject->id,
                'section_code' => $code,
                'schedule_days' => 'M',
                'starts_at_time' => '08:00:00',
                'ends_at_time' => '09:00:00',
                'capacity' => 40,
                'enrolled_count' => 0,
                'is_block_exclusive' => false,
                'status' => SectionStatus::Published,
            ]);
        };
        $firstSection = $createSection('IRR201');
        $secondSection = $createSection('IRR202');

        $student = $this->makeStudent($program, $curriculum, 'IRR-001', 'irregular@student.grc.test');
        $student->update(['year_level' => 2]);

        return [$student, $firstSection, $secondSection];
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

    /** @return array{Curriculum, list<Subject>} */
    private function makePredictableCcsCurriculum(): array
    {
        $program = Program::create(['code' => 'PRD', 'college' => 'ccs', 'name' => 'Predictable Program', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create(['program_id' => $program->id, 'name' => 'Predictable Curriculum', 'effective_school_year' => '2027-2028', 'status' => CurriculumStatus::Active]);
        $history = AcademicTerm::create(['school_year' => '2027-2028', 'semester' => '1st', 'status' => AcademicTermStatus::Archived]);
        RoomCatalogEntry::create(['name' => 'R-101', 'college' => 'ccs', 'capacity' => 40, 'room_type' => 'lecture']);

        $subjects = [];
        foreach ([1 => ['08:00:00', '09:00:00'], 2 => ['10:00:00', '11:00:00'], 3 => ['13:00:00', '14:00:00'], 4 => ['15:00:00', '16:00:00']] as $yearLevel => [$start, $end]) {
            $subject = Subject::create(['code' => "PRD{$yearLevel}01", 'college' => 'ccs', 'title' => "Predictable {$yearLevel}", 'units' => 3, 'room_requirement' => 'lecture', 'status' => SubjectStatus::Active]);
            $subjects[] = $subject;
            CurriculumSubject::create([
                'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id, 'year_level' => $yearLevel, 'semester' => '2nd', 'is_required' => true,
                'reference_day' => 'M', 'reference_start_time' => $start, 'reference_end_time' => $end, 'reference_modality' => 'f2f',
            ]);
            SectionDemandObservation::create([
                'academic_term_id' => $history->id, 'program_id' => $program->id, 'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
                'college' => 'ccs', 'year_level' => $yearLevel, 'cohort_size' => 40, 'enrolled_count' => 40, 'section_count' => 1, 'offered_capacity' => 40,
                'source' => 'test',
            ]);
            $faculty = User::create(['name' => "Predictable Faculty {$yearLevel}", 'email' => "predictable.faculty.{$yearLevel}@grc.test", 'password' => 'password', 'role' => UserRole::Faculty, 'college' => 'ccs', 'status' => UserStatus::Active]);
            FacultyCurriculumSubjectPreference::create(['professor_id' => $faculty->id, 'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id, 'semester' => '2nd', 'rank' => 1, 'origin' => 'test']);
            FacultyAvailability::create(['professor_id' => $faculty->id, 'day_of_week' => 1, 'starts_at_time' => $start, 'ends_at_time' => $end, 'origin' => 'test']);
        }

        return [$curriculum, $subjects];
    }

    private function makeViableCcsPlans(int $count): void
    {
        $subject = Subject::create(['code' => 'VPLN101', 'title' => 'Viable plan subject', 'units' => 3, 'status' => SubjectStatus::Active]);
        $faculty = User::create(['name' => 'Viable Plan Faculty', 'email' => 'viable.plan.faculty@grc.test', 'password' => 'password', 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);

        foreach (range(1, $count) as $number) {
            $program = Program::create([
                'code' => sprintf('C%03d', $number),
                'college' => 'ccs',
                'name' => "Chunk {$number}",
                'status' => ProgramStatus::Active,
            ]);
            $curriculum = Curriculum::create([
                'program_id' => $program->id,
                'name' => "Chunk {$number} Curriculum",
                'effective_school_year' => '2027-2028',
                'status' => CurriculumStatus::Active,
            ]);
            foreach (range(1, 4) as $yearLevel) {
                $plan = AcademicTermSectionPlan::create([
                    'academic_term_id' => $this->term->id,
                    'curriculum_id' => $curriculum->id,
                    'college' => 'ccs',
                    'year_level' => $yearLevel,
                    'section_count' => 1,
                    'students_per_block' => 40,
                    'status' => SectionPlanStatus::Draft,
                ]);
                Section::create([
                    'academic_term_id' => $this->term->id,
                    'section_plan_id' => $plan->id,
                    'subject_id' => $subject->id,
                    'section_code' => "V{$number}-{$yearLevel}",
                    'professor_id' => $faculty->id,
                    'schedule_days' => 'M',
                    'starts_at_time' => '08:00:00',
                    'ends_at_time' => '09:00:00',
                    'room' => 'V-101',
                    'modality' => SectionModality::FaceToFace,
                    'capacity' => 40,
                    'enrolled_count' => 0,
                    'is_block_exclusive' => true,
                    'status' => SectionStatus::Planned,
                ]);
            }
        }
    }

    private function makeViablePlanForCollege(string $college): void
    {
        $subject = Subject::query()->where('code', 'VPLN101')->sole();
        $faculty = User::query()->where('email', 'viable.plan.faculty@grc.test')->sole();
        $program = Program::create(['code' => strtoupper($college), 'college' => $college, 'name' => strtoupper($college).' viable program', 'status' => ProgramStatus::Active]);
        $curriculum = Curriculum::create(['program_id' => $program->id, 'name' => strtoupper($college).' viable curriculum', 'effective_school_year' => '2027-2028', 'status' => CurriculumStatus::Active]);

        foreach (range(1, 4) as $yearLevel) {
            $plan = AcademicTermSectionPlan::create([
                'academic_term_id' => $this->term->id,
                'curriculum_id' => $curriculum->id,
                'college' => $college,
                'year_level' => $yearLevel,
                'section_count' => 1,
                'students_per_block' => 40,
                'status' => SectionPlanStatus::Draft,
            ]);
            Section::create([
                'academic_term_id' => $this->term->id,
                'section_plan_id' => $plan->id,
                'subject_id' => $subject->id,
                'section_code' => strtoupper($college)."-{$yearLevel}",
                'professor_id' => $faculty->id,
                'schedule_days' => 'M',
                'starts_at_time' => '08:00:00',
                'ends_at_time' => '09:00:00',
                'room' => 'V-101',
                'modality' => SectionModality::FaceToFace,
                'capacity' => 40,
                'enrolled_count' => 0,
                'is_block_exclusive' => true,
                'status' => SectionStatus::Planned,
            ]);
        }
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
