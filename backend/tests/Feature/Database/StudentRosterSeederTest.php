<?php

namespace Tests\Feature\Database;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\RoomCatalogEntry;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Database\Seeders\AcademicTermSeeder;
use Database\Seeders\StudentRosterSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

final class StudentRosterSeederTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<string, array{code: string, college: CollegeCode}> */
    private const PROGRAMS = [
        'BSBA-FM' => ['code' => 'BSBA-FM', 'college' => CollegeCode::Cbae],
        'BSA' => ['code' => 'BSA', 'college' => CollegeCode::Coa],
        'BSIT' => ['code' => 'BSIT', 'college' => CollegeCode::Ccs],
    ];

    /**
     * (curriculum code) => list of {year_level, semester, subject_code}
     * needed for `sections`/`academic_term_section_plans` generation to have
     * something to attach to. BSIT covers all four year levels (1st
     * semester) so the cohort walked back from year 4 to year 1 has a real
     * subject at every stop; BSA/BSBA-FM only need the year level their
     * fixture roster row actually uses.
     *
     * @var list<array{program: string, year_level: int, semester: string, subject_code: string}>
     */
    private const CURRICULUM_SUBJECTS = [
        ['program' => 'BSIT', 'year_level' => 1, 'semester' => '1st', 'subject_code' => 'IT101S'],
        ['program' => 'BSIT', 'year_level' => 2, 'semester' => '1st', 'subject_code' => 'IT201S'],
        ['program' => 'BSIT', 'year_level' => 3, 'semester' => '1st', 'subject_code' => 'IT301S'],
        ['program' => 'BSIT', 'year_level' => 4, 'semester' => '1st', 'subject_code' => 'IT401S'],
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
        $this->seedSectionHistoryFixtures($curricula);
    }

    /** @param array<string, Curriculum> $curricula */
    private function seedSectionHistoryFixtures(array $curricula): void
    {
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

        // Several faculty members per college — not just one — so the
        // professor-assignment fallback chain ("any faculty in that
        // college") has enough candidates to avoid exhausting all
        // `SLOT_COUNT` (24) day/time slots now that historical blocks scale
        // with cohort headcount (Task 2 fix brief item 1): CCS/BSIT's own
        // current term alone needs professors for 31 sections (9 + 8 + 7 + 7
        // blocks across its four cohorts), well past what a single
        // candidate's 24 slots could ever cover.
        $collegeValues = array_unique(array_map(
            static fn (array $definition): string => $definition['college']->value,
            self::PROGRAMS,
        ));
        foreach ($collegeValues as $collegeValue) {
            $college = CollegeCode::from($collegeValue);
            for ($i = 1; $i <= 6; $i++) {
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

    public function test_it_creates_accounts_from_the_roster_file(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $this->assertDatabaseHas('users', ['email' => 's2401455@grc.test', 'role' => 'student', 'status' => 'active']);
        $this->assertDatabaseHas('student_profiles', [
            'student_number' => '2024-06-01455', 'year_level' => 3, 'entry_year' => 2024, 'enrollment_category' => null,
        ]);

        $user = User::query()->where('email', 's2401455@grc.test')->sole();
        $this->assertTrue(Hash::check('password', $user->password));

        $profile = StudentProfile::query()->where('student_number', '2024-06-01455')->sole();
        $program = Program::query()->where('code', 'BSA')->sole();
        $curriculum = Curriculum::query()->where('program_id', $program->id)->sole();
        $this->assertSame($program->id, $profile->program_id);
        $this->assertSame($curriculum->id, $profile->curriculum_id);
        $this->assertSame(AdmissionStatus::Admitted, $profile->admission_status);
        $this->assertSame(AcademicStanding::Good, $profile->academic_standing);
        $this->assertSame(UserRole::Student, $user->role);
        $this->assertSame(UserStatus::Active, $user->status);
    }

    public function test_running_twice_does_not_duplicate_accounts(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();
        $before = User::where('role', 'student')->count();
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $this->assertSame($before, User::where('role', 'student')->count());
        $this->assertSame($before, StudentProfile::query()->count());
    }

    public function test_it_builds_a_section_history_that_walks_each_cohort_backwards(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $current = AcademicTerm::where('school_year', '2026-2027')->where('semester', '1st')->sole();
        $earliest = AcademicTerm::where('school_year', '2023-2024')->where('semester', '1st')->sole();

        // a 4th-year student's block exists in the current term at year 4
        $this->assertDatabaseHas('sections', ['academic_term_id' => $current->id, 'section_code' => 'IT401']);
        // and in the earliest term at year 1 — the year-4 cohort's own
        // freshman year, scaled to its real headcount (StudentRosterMap's
        // CCS/BSIT year-4 cohort is 7 x 30-seat blocks = 210 students, so
        // ceil(210 / 40) = 6 blocks: IT101-IT106)
        $this->assertDatabaseHas('sections', ['academic_term_id' => $earliest->id, 'section_code' => 'IT101']);
        // a 7th block isn't needed for 210 students at 40 seats/block — this
        // is what proves the block count is computed from the cohort's real
        // headcount, not copied verbatim from today's real 7-block shape
        $this->assertDatabaseMissing('sections', ['academic_term_id' => $earliest->id, 'section_code' => 'IT107']);
    }

    public function test_historical_block_count_scales_with_cohort_headcount(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $earliest = AcademicTerm::where('school_year', '2023-2024')->where('semester', '1st')->sole();

        // Only the CCS/BSIT year-4 cohort's own year-1 projection contributes
        // "IT10x"-coded sections to this term (every other BSIT cohort's own
        // entry year is later). Its real headcount (StudentRosterMap:
        // IT401-IT407, 7 x 30 = 210 students) must produce exactly
        // ceil(210 / 40) = 6 distinct blocks.
        $blockCount = Section::query()
            ->where('academic_term_id', $earliest->id)
            ->where('section_code', 'like', 'IT10%')
            ->distinct()
            ->count('section_code');

        $this->assertSame(6, $blockCount);
    }

    public function test_every_historical_section_has_a_professor(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $this->assertSame(0, Section::whereNull('professor_id')->where('status', 'closed')->count());
    }

    public function test_no_professor_is_double_booked_in_the_same_term_day_and_time(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $collisions = Section::query()
            ->where('status', 'closed')
            ->whereNotNull('professor_id')
            ->select(['academic_term_id', 'professor_id', 'schedule_days', 'starts_at_time'])
            ->groupBy('academic_term_id', 'professor_id', 'schedule_days', 'starts_at_time')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        $this->assertCount(0, $collisions);
    }

    public function test_it_throws_when_a_college_has_no_eligible_professor(): void
    {
        // The fixture seeds exactly one Faculty user per used college.
        // Removing CCS's leaves BSIT's sections with zero eligible
        // candidates across all three fallback tiers.
        User::where('college', CollegeCode::Ccs)->delete();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches("/no eligible professor for college 'ccs'/");

        (new StudentRosterSeeder($this->fixturePath()))->run();
    }

    public function test_tier_two_preference_fallback_is_scoped_to_the_sections_college(): void
    {
        $curriculum = Curriculum::query()->whereHas('program', fn ($query) => $query->where('code', 'BSIT'))->sole();
        $subject = Subject::query()->where('code', 'IT101S')->sole();

        // A faculty preference row for a professor in a DIFFERENT college
        // than BSIT's (CCS), ranked first — if tier 2 isn't college-scoped,
        // this outsider would be preferred over CCS's own faculty for every
        // IT101S section.
        $outsider = User::create([
            'name' => 'Outsider Professor',
            'email' => 'outsider@grc.test',
            'password' => 'password',
            'role' => UserRole::Faculty,
            'college' => CollegeCode::Coa,
            'status' => UserStatus::Active,
        ]);

        DB::table('faculty_curriculum_subject_preferences')->insert([
            'professor_id' => $outsider->id,
            'curriculum_id' => $curriculum->id,
            'subject_id' => $subject->id,
            'semester' => '1st',
            'rank' => 1,
            'origin' => 'declared',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        (new StudentRosterSeeder($this->fixturePath()))->run();

        $this->assertSame(
            0,
            Section::query()->where('subject_id', $subject->id)->where('professor_id', $outsider->id)->count(),
        );
    }

    public function test_plan_rows_are_not_written_when_no_curriculum_subjects_match(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $curriculum = Curriculum::query()->whereHas('program', fn ($query) => $query->where('code', 'BSA'))->sole();
        $current = AcademicTerm::where('school_year', '2026-2027')->where('semester', '1st')->sole();

        // The fixture's BSA curriculum only registers subjects at year
        // levels 1 and 3 (see CURRICULUM_SUBJECTS above), but StudentRosterMap
        // has real BSA cohorts at every year level 1-4 — the year-2/year-4
        // cohort-terms must not get a plan row with nothing behind it.
        $this->assertDatabaseMissing('academic_term_section_plans', [
            'academic_term_id' => $current->id, 'curriculum_id' => $curriculum->id, 'year_level' => 2,
        ]);
        $this->assertDatabaseMissing('academic_term_section_plans', [
            'academic_term_id' => $current->id, 'curriculum_id' => $curriculum->id, 'year_level' => 4,
        ]);

        // and every plan row that DOES exist has a section_count matching the
        // real number of distinct blocks generated under it — never overstated.
        AcademicTermSectionPlan::query()->get()->each(function (AcademicTermSectionPlan $plan): void {
            $actualBlocks = Section::query()->where('section_plan_id', $plan->id)->distinct()->count('section_code');
            $this->assertSame($actualBlocks, $plan->section_count, "plan {$plan->id} section_count mismatch");
        });
    }

    public function test_running_the_section_history_twice_does_not_duplicate_sections(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();
        $before = Section::query()->count();
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $this->assertSame($before, Section::query()->count());
    }

    private function fixturePath(): string
    {
        return __DIR__.'/../../fixtures/students-profile-sample.md';
    }
}
