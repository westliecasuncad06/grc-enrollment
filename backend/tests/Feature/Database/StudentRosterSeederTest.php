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
use Illuminate\Support\Facades\Hash;
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

        // One faculty member per college so the professor-assignment
        // fallback chain ("any faculty in that college") always resolves.
        $collegeValues = array_unique(array_map(
            static fn (array $definition): string => $definition['college']->value,
            self::PROGRAMS,
        ));
        foreach ($collegeValues as $collegeValue) {
            $college = CollegeCode::from($collegeValue);
            User::create([
                'name' => 'Faculty '.$college->value,
                'email' => 'faculty.'.$college->value.'@grc.test',
                'password' => 'password',
                'role' => UserRole::Faculty,
                'college' => $college,
                'status' => UserStatus::Active,
            ]);
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
        // and in the earliest term at year 1
        $this->assertDatabaseHas('sections', ['academic_term_id' => $earliest->id, 'section_code' => 'IT101']);
        // a 1st-year cohort has no section before it entered
        $this->assertDatabaseMissing('sections', ['academic_term_id' => $earliest->id, 'section_code' => 'IT102']);
    }

    public function test_every_historical_section_has_a_professor(): void
    {
        (new StudentRosterSeeder($this->fixturePath()))->run();

        $this->assertSame(0, Section::whereNull('professor_id')->where('status', 'closed')->count());
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
