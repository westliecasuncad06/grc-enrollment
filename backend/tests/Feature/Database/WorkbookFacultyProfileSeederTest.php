<?php

namespace Tests\Feature\Database;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\FacultyCurriculumSubjectPreference;
use App\Models\FacultyTeachingHistory;
use App\Models\Program;
use App\Models\Subject;
use App\Models\User;
use Database\Seeders\WorkbookFacultyProfileSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class WorkbookFacultyProfileSeederTest extends TestCase
{
    use RefreshDatabase;

    private const FIXTURE_CSV = <<<'CSV'
college,program_code,year_level,semester,subject_code,day,start_time,end_time,room,modality,professor_name,sched_id,notes
ccs,BSIT,1,1st,IT101,M,08:00,10:00,3A,F2F,MR. H. CORRALES,101,
ccs,BSIT,1,2nd,IT201,T,13:00,15:00,3B,F2F,Henry N. Corrales,102,
CSV;

    public function test_it_creates_full_name_local_profiles_with_reusable_preferences_history_and_source_availability(): void
    {
        $this->seedReferenceCatalog();
        User::create([
            'name' => 'CORRALES',
            'email' => 'faculty.ccs.corrales@grc.test',
            'password' => 'password',
            'role' => UserRole::Faculty,
            'college' => CollegeCode::Ccs,
            'status' => UserStatus::Active,
        ]);
        $fixturePath = $this->writeFixture();

        try {
            (new WorkbookFacultyProfileSeeder($fixturePath))->run();

            $professor = User::query()->where('name', 'Henry N. Corrales')->sole();
            $this->assertTrue(Hash::check('password', $professor->password));
            $this->assertSame(UserStatus::Disabled, User::query()->where('email', 'faculty.ccs.corrales@grc.test')->sole()->status);
            $this->assertSame(2, FacultyCurriculumSubjectPreference::query()->where('professor_id', $professor->id)->count());
            $this->assertSame(2, FacultyTeachingHistory::query()->where('professor_id', $professor->id)->count());
            $this->assertDatabaseHas('faculty_availabilities', [
                'professor_id' => $professor->id,
                'academic_term_id' => AcademicTerm::query()->where('semester', '2nd')->sole()->id,
                'day_of_week' => 2,
                'starts_at_time' => '13:00:00',
                'ends_at_time' => '15:00:00',
                'origin' => 'workbook_seeded',
            ]);

            (new WorkbookFacultyProfileSeeder($fixturePath))->run();
            $this->assertSame(1, User::query()->where('email', $professor->email)->count());
            $this->assertSame(2, FacultyTeachingHistory::query()->where('professor_id', $professor->id)->count());
        } finally {
            unlink($fixturePath);
        }
    }

    private function seedReferenceCatalog(): void
    {
        $program = Program::create([
            'code' => 'BSIT',
            'name' => 'BS Information Technology',
            'college' => CollegeCode::Ccs,
            'status' => ProgramStatus::Active,
        ]);
        $curriculum = Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSIT Curriculum 2024-2029',
            'effective_school_year' => '2024-2029',
            'effective_start_year' => 2024,
            'effective_end_year' => 2029,
            'status' => CurriculumStatus::Active,
        ]);
        foreach ([['IT101', '1st'], ['IT201', '2nd']] as [$code, $semester]) {
            $subject = Subject::create([
                'code' => $code,
                'college' => CollegeCode::Ccs,
                'title' => $code.' title',
                'units' => 3,
                'status' => SubjectStatus::Active,
            ]);
            CurriculumSubject::create([
                'curriculum_id' => $curriculum->id,
                'subject_id' => $subject->id,
                'year_level' => 1,
                'semester' => $semester,
                'is_required' => true,
            ]);
        }
        foreach (['1st', '2nd'] as $semester) {
            AcademicTerm::create([
                'school_year' => '2027-2028',
                'semester' => $semester,
                'status' => AcademicTermStatus::Draft,
            ]);
        }
    }

    private function writeFixture(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'grc_workbook_faculty_').'.csv';
        file_put_contents($path, self::FIXTURE_CSV);

        return $path;
    }
}
