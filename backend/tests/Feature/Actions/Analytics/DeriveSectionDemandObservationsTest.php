<?php

namespace Tests\Feature\Actions\Analytics;

use App\Actions\Analytics\DeriveSectionDemandObservations;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Enrollment;
use App\Models\EnrollmentSubject;
use App\Models\Program;
use App\Models\RoomCatalogEntry;
use App\Models\Section;
use App\Models\SectionDemandObservation;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Database\Seeders\AcademicTermSeeder;
use Database\Seeders\StudentRosterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Mirrors `StudentRosterSeederTest`'s own fixture scaffolding (same three
 * programs, same `students-profile-sample.md` roster) since
 * `DeriveSectionDemandObservations` reads exactly the real
 * enrollment/section/grade history that seeder builds — there is no smaller
 * fixture that would exercise a real, multi-table aggregation query.
 */
final class DeriveSectionDemandObservationsTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, array{code: string, college: CollegeCode}> */
    private const PROGRAMS = [
        'BSBA-FM' => ['code' => 'BSBA-FM', 'college' => CollegeCode::Cbae],
        'BSA' => ['code' => 'BSA', 'college' => CollegeCode::Coa],
        'BSIT' => ['code' => 'BSIT', 'college' => CollegeCode::Ccs],
    ];

    /** @var list<array{program: string, year_level: int, semester: string, subject_code: string}> */
    private const CURRICULUM_SUBJECTS = [
        ['program' => 'BSA', 'year_level' => 1, 'semester' => '1st', 'subject_code' => 'ACC101S'],
        ['program' => 'BSA', 'year_level' => 3, 'semester' => '1st', 'subject_code' => 'ACC301S'],
        ['program' => 'BSBA-FM', 'year_level' => 1, 'semester' => '1st', 'subject_code' => 'FM101S'],
        ['program' => 'BSBA-FM', 'year_level' => 2, 'semester' => '1st', 'subject_code' => 'FM201S'],
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $curricula = [];
        foreach (self::PROGRAMS as $definition) {
            $program = Program::create([
                'code' => $definition['code'],
                'name' => $definition['code'].' Program',
                'college' => $definition['college'],
                'status' => ProgramStatus::Active,
            ]);

            $curricula[$definition['code']] = Curriculum::create([
                'program_id' => $program->id,
                'name' => $definition['code'].' Curriculum 2024-2029',
                'effective_school_year' => '2024-2029',
                'effective_start_year' => 2024,
                'effective_end_year' => 2029,
                'status' => CurriculumStatus::Active,
            ]);
        }

        $this->seed(AcademicTermSeeder::class);

        foreach (self::CURRICULUM_SUBJECTS as $definition) {
            $college = self::PROGRAMS[$definition['program']]['college'];
            $subject = Subject::create([
                'code' => $definition['subject_code'],
                'college' => $college,
                'title' => $definition['subject_code'].' title',
                'units' => 3,
                'status' => SubjectStatus::Active,
            ]);
            CurriculumSubject::create([
                'curriculum_id' => $curricula[$definition['program']]->id,
                'subject_id' => $subject->id,
                'year_level' => $definition['year_level'],
                'semester' => $definition['semester'],
                'is_required' => true,
            ]);
        }

        $collegeValues = array_unique(array_map(
            static fn (array $definition): string => $definition['college']->value,
            self::PROGRAMS,
        ));
        foreach ($collegeValues as $collegeValue) {
            $college = CollegeCode::from($collegeValue);
            for ($i = 1; $i <= 20; $i++) {
                User::create([
                    'name' => "Faculty {$college->value} {$i}",
                    'email' => "faculty.{$college->value}.{$i}@grc.test",
                    'password' => 'password',
                    'role' => UserRole::Faculty,
                    'college' => $college,
                    'status' => UserStatus::Active,
                ]);
            }
            RoomCatalogEntry::create([
                'name' => 'Room '.strtoupper($college->value).'-1',
                'college' => $college,
                'capacity' => 40,
                'room_type' => 'lecture',
            ]);
        }
    }

    public function test_it_aggregates_real_enrollments_into_demand_observations(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $count = app(DeriveSectionDemandObservations::class)->execute();

        $this->assertGreaterThan(0, $count);
        $observation = SectionDemandObservation::where('source', 'derived_from_enrollments')->first();
        $this->assertNotNull($observation);
        $this->assertSame(
            EnrollmentSubject::whereHas('section', fn ($q) => $q
                ->where('academic_term_id', $observation->academic_term_id)
                ->where('subject_id', $observation->subject_id))->count(),
            $observation->enrolled_count,
        );
    }

    /**
     * A synthetic row seeded at the exact key real BSA/ACC301S history
     * resolves to (program BSA, its curriculum, subject ACC301S, the
     * student's current year_level 3, and the one term that cohort's
     * `ACC301` block actually exists in) must be replaced by the derived
     * row, not left alone or duplicated. `updateOrCreate` is used (rather
     * than `create`) because `StudentRosterSeeder::run()` itself already
     * calls `DeriveSectionDemandObservations` as its own last step — by the
     * time this test seeds its synthetic row, a `derived_from_enrollments`
     * row already occupies this exact unique key, and this test is
     * deliberately overwriting it back to synthetic to prove the second,
     * explicit `execute()` call below restores the derived values.
     */
    public function test_it_overwrites_synthetic_observations_for_the_same_key(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $program = Program::query()->where('code', 'BSA')->sole();
        $curriculum = Curriculum::query()->where('program_id', $program->id)->sole();
        $subject = Subject::query()->where('code', 'ACC301S')->sole();
        $termId = $this->termIdForStudentSubject('2024-06-01451', 'ACC301S');

        $key = [
            'academic_term_id' => $termId,
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'subject_id' => $subject->id,
            'year_level' => 3,
        ];

        SectionDemandObservation::updateOrCreate($key, [
            'college' => CollegeCode::Coa,
            'cohort_size' => 999,
            'enrolled_count' => 999,
            'section_count' => 999,
            'offered_capacity' => 999,
            'source' => 'local_synthetic_aggregate',
        ]);

        app(DeriveSectionDemandObservations::class)->execute();

        $observation = SectionDemandObservation::where($key)->sole();
        $this->assertSame('derived_from_enrollments', $observation->source);
        $this->assertNotSame(999, $observation->enrolled_count);
        $this->assertGreaterThan(0, $observation->enrolled_count);
    }

    /**
     * A synthetic row keyed to a (term, subject) pairing real history never
     * produces — the real BSA/year-3 student's ACC301S section lives in
     * their "today" term (elapsed 0 academic years), while ACC101S is their
     * OWN historical year-1 term (elapsed 2 academic years) — is untouched
     * fallback data, not an orphan to clean up. `execute()` only ever
     * upserts keys its own aggregation query actually produces.
     */
    public function test_it_does_not_touch_synthetic_observations_without_matching_real_data(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $program = Program::query()->where('code', 'BSA')->sole();
        $curriculum = Curriculum::query()->where('program_id', $program->id)->sole();
        $acc301TermId = $this->termIdForStudentSubject('2024-06-01451', 'ACC301S');
        $acc101SubjectId = Subject::query()->where('code', 'ACC101S')->value('id');

        // ACC101S paired with the "today" term (where only ACC301S really
        // has a section) never has any real backing.
        $key = [
            'academic_term_id' => $acc301TermId,
            'program_id' => $program->id,
            'curriculum_id' => $curriculum->id,
            'subject_id' => $acc101SubjectId,
            'year_level' => 3,
        ];

        SectionDemandObservation::updateOrCreate($key, [
            'college' => CollegeCode::Coa,
            'cohort_size' => 50,
            'enrolled_count' => 45,
            'section_count' => 2,
            'offered_capacity' => 80,
            'source' => 'local_synthetic_aggregate',
        ]);

        app(DeriveSectionDemandObservations::class)->execute();

        $observation = SectionDemandObservation::where($key)->sole();
        $this->assertSame('local_synthetic_aggregate', $observation->source);
        $this->assertSame(45, $observation->enrolled_count);
    }

    public function test_it_only_upserts_observations_for_the_given_term_when_one_is_passed(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();
        SectionDemandObservation::query()->delete();

        $acc301TermId = $this->termIdForStudentSubject('2024-06-01451', 'ACC301S');
        $acc101TermId = $this->termIdForStudentSubject('2024-06-01451', 'ACC101S');
        $this->assertNotSame($acc301TermId, $acc101TermId);

        $count = app(DeriveSectionDemandObservations::class)->execute(AcademicTerm::findOrFail($acc301TermId));

        $this->assertGreaterThan(0, $count);
        $this->assertSame(0, SectionDemandObservation::where('academic_term_id', $acc101TermId)->count());
        $this->assertGreaterThan(0, SectionDemandObservation::where('academic_term_id', $acc301TermId)->count());
    }

    public function test_running_it_twice_does_not_change_the_row_count(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        app(DeriveSectionDemandObservations::class)->execute();
        $before = SectionDemandObservation::where('source', 'derived_from_enrollments')->count();

        app(DeriveSectionDemandObservations::class)->execute();
        $after = SectionDemandObservation::where('source', 'derived_from_enrollments')->count();

        $this->assertSame($before, $after);
    }

    /**
     * The academic_term_id of the real section a specific real fixture
     * student (by student_number) actually took a specific subject (by
     * code) in — unambiguous even though the same subject code can have
     * sections in more than one term across different cohorts (e.g. every
     * BSA cohort walking through a projected year level 3 in semester 1
     * gets its own ACC301S section), because this resolves through the
     * student's own `enrollment_subjects` row rather than guessing at the
     * `sections` table directly.
     */
    private function termIdForStudentSubject(string $studentNumber, string $subjectCode): int
    {
        $student = StudentProfile::query()->where('student_number', $studentNumber)->sole();
        $subjectId = Subject::query()->where('code', $subjectCode)->value('id');
        $enrollmentIds = Enrollment::query()->where('student_id', $student->id)->pluck('id');

        $section = Section::query()
            ->where('subject_id', $subjectId)
            ->whereHas('enrollmentSubjects', fn ($q) => $q->whereIn('enrollment_id', $enrollmentIds))
            ->firstOrFail();

        return $section->academic_term_id;
    }

    private function fixturePath(): string
    {
        return __DIR__.'/../../../fixtures/students-profile-sample.md';
    }
}
