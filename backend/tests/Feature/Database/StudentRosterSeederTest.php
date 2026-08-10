<?php

namespace Tests\Feature\Database;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Models\Curriculum;
use App\Models\Program;
use App\Models\StudentProfile;
use App\Models\User;
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

    protected function setUp(): void
    {
        parent::setUp();

        foreach (self::PROGRAMS as $definition) {
            $program = Program::create([
                'code' => $definition['code'],
                'name' => $definition['code'].' Program',
                'college' => $definition['college'],
                'status' => ProgramStatus::Active,
            ]);

            Curriculum::create([
                'program_id' => $program->id,
                'name' => $definition['code'].' Curriculum 2024-2029',
                'effective_school_year' => '2024-2029',
                'effective_start_year' => 2024,
                'effective_end_year' => 2029,
                'status' => CurriculumStatus::Active,
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

    private function fixturePath(): string
    {
        return __DIR__.'/../../fixtures/students-profile-sample.md';
    }
}
