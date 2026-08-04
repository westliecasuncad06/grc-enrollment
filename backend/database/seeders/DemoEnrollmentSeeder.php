<?php

namespace Database\Seeders;

use App\Actions\Academic\ReclassifyStudentEnrollmentCategory;
use App\Domain\Academic\GradeStatus;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\SectionPlanStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\Curriculum;
use App\Models\FacultyAvailability;
use App\Models\FacultySubjectPreference;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds eight student logins with real locked grade history, so
 * `EnrollmentCategoryClassifier` can derive each one's Regular/Irregular
 * standing for real — never hard-coded — and every year level (plus the
 * irregular audience) is immediately testable end to end: log in, browse
 * the derived prospectus/grade slip, and submit a fresh enrollment against
 * the current `semester_ongoing` term (see AcademicTermSeeder), since none
 * of the eight carry an enrollment of their own yet.
 *
 *   0001  1st year, regular    — 1 completed semester
 *   0002  2nd year, regular    — 3 completed semesters
 *   0003  3rd year, regular    — 5 completed semesters
 *   0004  4th year, regular    — 7 completed semesters
 *   0005  2nd year, irregular  — 3 sems, a 5.00 (Failed) on a required subject
 *   0006  2nd year, irregular  — 3 sems, an INC (Incomplete) on a required subject
 *   0007  3rd year, irregular  — 5 sems, an NC (Not Complete) on a Leadership subject
 *   0008  4th year, irregular  — 7 sems, missing a required subject's grade entirely
 *
 * Each student's completed-semester count follows "BSCS Grade History Demo
 * 2026"'s (see CurriculumSeeder) own ordinal positions exactly — SemesterSlot::
 * ordinal() is `(yearLevel-1)*2 + (1|2)` — so a year-Y student has
 * `(Y-1)*2 + 1` completed ordinals and is about to enroll in their Yth
 * year's 2nd semester, which is exactly the current ongoing term.
 *
 * Grades are recorded against the 7 non-ongoing terms AcademicTermSeeder
 * seeds (2023-2024 1st through 2026-2027 1st), in chronological order,
 * right-aligned so a student's MOST RECENT completed ordinal always lands on
 * the most recent closed term (2026-2027 1st) — a year-4 student's 7
 * ordinals therefore use all 7 terms 1:1, and shorter histories use however
 * many of the most recent terms they need.
 *
 * NONE of this is real student data. Names, student numbers, and grades are
 * invented placeholders, and the emails use the reserved `.test` TLD
 * (RFC 2606) so they can never resolve to a real mailbox.
 *
 * Depends on RoleUserSeeder, ProgramSeeder, SubjectSeeder, CurriculumSeeder,
 * and AcademicTermSeeder.
 */
final class DemoEnrollmentSeeder extends Seeder
{
    private const PASSWORD = 'password';

    /**
     * Every subject at each curriculum ordinal, with the mark a REGULAR
     * student earns there. Ordinal 8 (year 4, 2nd semester) is deliberately
     * absent — that is the current ongoing term every student is left free
     * to enroll into themselves.
     *
     * @var array<int, list<array{subject: string, mark: string}>>
     */
    private const SEMESTER_SUBJECTS = [
        1 => [
            ['subject' => 'CS101', 'mark' => '2.00'],
            ['subject' => 'CS102', 'mark' => '1.75'],
            ['subject' => 'MATH101', 'mark' => '2.25'],
            ['subject' => 'GE101', 'mark' => '1.50'],
            ['subject' => 'PE101', 'mark' => '1.00'],
            ['subject' => 'LEAD 1', 'mark' => 'C'],
        ],
        2 => [
            ['subject' => 'CS201', 'mark' => '2.00'],
            ['subject' => 'MATH102', 'mark' => '2.50'],
            ['subject' => 'GE102', 'mark' => '1.75'],
            ['subject' => 'LEAD 2', 'mark' => 'C'],
        ],
        3 => [
            ['subject' => 'CS202', 'mark' => '2.25'],
            ['subject' => 'LEAD 3', 'mark' => 'C'],
        ],
        4 => [
            ['subject' => 'CS301', 'mark' => '2.00'],
            ['subject' => 'LEAD 4', 'mark' => 'C'],
        ],
        5 => [
            ['subject' => 'CS302', 'mark' => '2.25'],
            ['subject' => 'LEAD 5', 'mark' => 'C'],
        ],
        6 => [
            ['subject' => 'CS303', 'mark' => '2.00'],
            ['subject' => 'LEAD 6', 'mark' => 'C'],
        ],
        7 => [
            ['subject' => 'CS401', 'mark' => '2.50'],
            ['subject' => 'LEAD 7', 'mark' => 'C'],
        ],
    ];

    /**
     * The current ongoing term's own subjects (ordinal 8's year-2 slot is
     * absent — see `SEMESTER_SUBJECTS`), one entry per year level 1–4 — what
     * a REGULAR student in that year is actually about to enrol into. Every
     * block for that year level (see `BLOCK_CODES_BY_YEAR`) offers the same
     * subject list, just on a different schedule; `SectionSeeder` already
     * publishes an ordinary (non-block) section for every one of these same
     * subject codes, so irregular students on the same curriculum can still
     * enrol per subject.
     *
     * @var array<int, list<string>>
     */
    private const BLOCK_SUBJECTS_BY_YEAR = [
        1 => ['CS201', 'MATH102', 'GE102', 'LEAD 2'],
        2 => ['CS301', 'LEAD 4'],
        3 => ['CS303', 'LEAD 6'],
        4 => ['CS402', 'LEAD8'],
    ];

    /**
     * Year levels 1–3 offer a real choice — three block sections, so a
     * regular student picks among them instead of being handed the only
     * option. Year 4 keeps a single block: PRD scope only asked for a real
     * choice at years 1–3. Codes follow the school's own convention —
     * program prefix, year level, two-digit section number — not a "DEMO"
     * placeholder, so the enrollment screen shows exactly what a student
     * would see in production (e.g. "BSCS101", not "Block DEMO1A").
     *
     * @var array<int, list<string>>
     */
    private const BLOCK_CODES_BY_YEAR = [
        1 => ['BSCS101', 'BSCS102', 'BSCS103'],
        2 => ['BSCS201', 'BSCS202', 'BSCS203'],
        3 => ['BSCS301', 'BSCS302', 'BSCS303'],
        4 => ['BSCS401'],
    ];

    /**
     * One distinct weekly schedule per block letter (A/B/C), so the three
     * blocks in a year level are a meaningfully different choice — not the
     * same slot copy-pasted under three codes. Indexed positionally against
     * `BLOCK_CODES_BY_YEAR`'s inner arrays.
     *
     * @var list<array{days: string, start_hour: int, room: string}>
     */
    private const BLOCK_SCHEDULES = [
        ['days' => 'MWF', 'start_hour' => 8, 'room' => 'RM-401'],
        ['days' => 'TTh', 'start_hour' => 8, 'room' => 'RM-402'],
        ['days' => 'MWF', 'start_hour' => 13, 'room' => 'RM-403'],
    ];

    /**
     * One real professor per `BLOCK_SUBJECTS_BY_YEAR` subject — a perfect
     * 1:1 mapping across all 10 distinct subjects those four year levels
     * offer. Each professor owns every block's section of their own subject
     * (see `seedRegularBlocks`), exactly like a real department: one
     * instructor, many sections of the same course. Replaces the single
     * `faculty.seed@grc.test` account that previously owned all 448 demo
     * sections. Names are invented placeholders; emails use the reserved
     * `.test` TLD (RFC 2606).
     *
     * @var array<string, array{name: string, email_local: string}>
     */
    private const PROFESSORS = [
        'CS201' => ['name' => 'Ramon Bautista', 'email_local' => 'bautista'],
        'MATH102' => ['name' => 'Teresa Villanueva', 'email_local' => 'villanueva'],
        'GE102' => ['name' => 'Christian Dela Cruz', 'email_local' => 'dela-cruz'],
        'LEAD 2' => ['name' => 'Angelica Reyes', 'email_local' => 'reyes'],
        'CS301' => ['name' => 'Michael Santos', 'email_local' => 'santos'],
        'LEAD 4' => ['name' => 'Josephine Mendoza', 'email_local' => 'mendoza'],
        'CS303' => ['name' => 'Ferdinand Aquino', 'email_local' => 'aquino'],
        'LEAD 6' => ['name' => 'Grace Manalo', 'email_local' => 'manalo'],
        'CS402' => ['name' => 'Rafael Torres', 'email_local' => 'torres'],
        'LEAD8' => ['name' => 'Cecilia Fernandez', 'email_local' => 'fernandez'],
    ];

    /**
     * The 7 non-ongoing terms, oldest first — a completed ordinal always
     * maps onto the tail end of this list (see class docblock).
     *
     * @var list<array{school_year: string, semester: string}>
     */
    private const CHRONOLOGICAL_TERMS = [
        ['school_year' => '2023-2024', 'semester' => '1st'],
        ['school_year' => '2023-2024', 'semester' => '2nd'],
        ['school_year' => '2024-2025', 'semester' => '1st'],
        ['school_year' => '2024-2025', 'semester' => '2nd'],
        ['school_year' => '2025-2026', 'semester' => '1st'],
        ['school_year' => '2025-2026', 'semester' => '2nd'],
        ['school_year' => '2026-2027', 'semester' => '1st'],
    ];

    /**
     * `overrides` replaces a subject's regular mark for that one student;
     * `omit` skips recording a mark for that subject entirely (a genuinely
     * missing required grade, not a special mark).
     *
     * @var list<array{
     *     number: string, email: string, name: string, yearLevel: int,
     *     completedOrdinals: int, overrides: array<string, string>, omit: list<string>
     * }>
     */
    private const STUDENTS = [
        ['number' => 'STU-2026-0001', 'email' => 'student.seed@grc.test', 'name' => 'Seed Student', 'yearLevel' => 1, 'completedOrdinals' => 1, 'overrides' => [], 'omit' => []],
        ['number' => 'STU-2026-0002', 'email' => 'student2.seed@grc.test', 'name' => 'Seed Student Two', 'yearLevel' => 2, 'completedOrdinals' => 3, 'overrides' => [], 'omit' => []],
        ['number' => 'STU-2026-0003', 'email' => 'student3.seed@grc.test', 'name' => 'Seed Student Three', 'yearLevel' => 3, 'completedOrdinals' => 5, 'overrides' => [], 'omit' => []],
        ['number' => 'STU-2026-0004', 'email' => 'student4.seed@grc.test', 'name' => 'Seed Student Four', 'yearLevel' => 4, 'completedOrdinals' => 7, 'overrides' => [], 'omit' => []],
        ['number' => 'STU-2026-0005', 'email' => 'student5.seed@grc.test', 'name' => 'Seed Student Five', 'yearLevel' => 2, 'completedOrdinals' => 3, 'overrides' => ['MATH101' => '5.00'], 'omit' => []],
        ['number' => 'STU-2026-0006', 'email' => 'student6.seed@grc.test', 'name' => 'Seed Student Six', 'yearLevel' => 2, 'completedOrdinals' => 3, 'overrides' => ['CS201' => 'INC'], 'omit' => []],
        ['number' => 'STU-2026-0007', 'email' => 'student7.seed@grc.test', 'name' => 'Seed Student Seven', 'yearLevel' => 3, 'completedOrdinals' => 5, 'overrides' => ['LEAD 3' => 'NC'], 'omit' => []],
        ['number' => 'STU-2026-0008', 'email' => 'student8.seed@grc.test', 'name' => 'Seed Student Eight', 'yearLevel' => 4, 'completedOrdinals' => 7, 'overrides' => [], 'omit' => ['CS401']],
    ];

    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            $program = $this->program();
            $curriculum = $this->curriculum();
            $encoder = $this->userWithRole(UserRole::Faculty);

            $profiles = new Collection;

            foreach (self::STUDENTS as $definition) {
                $profile = $this->studentProfile($definition, $program, $curriculum);
                $this->seedGradeHistory($profile, $definition, $encoder);
                $profiles->push($profile);
            }

            $this->reclassify($profiles);
            $this->seedRegularBlocks($curriculum, $encoder);
        });
    }

    /**
     * Generated blocks for year levels 1–4 on the current ongoing term, so
     * `BuildEnrollmentBlockPool` has something real to offer the four
     * REGULAR seeded students (0001–0004) — otherwise "Select your section"
     * renders "No sections were generated" and none of them can actually
     * complete a fresh enrollment, defeating the entire point of this
     * roster. Years 1–3 get three blocks (a real choice); year 4 gets one —
     * see `BLOCK_CODES_BY_YEAR`. `college` is a required column on
     * `academic_term_section_plans` but is never read by the block-pool
     * lookup itself (which matches on `year_level`/`curriculum_id` only) —
     * `'demo'` is a harmless placeholder, not a real `CollegeCode`.
     */
    private function seedRegularBlocks(Curriculum $curriculum, User $encoder): void
    {
        $currentTerm = AcademicTerm::query()
            ->where('status', AcademicTermStatus::SemesterOngoing)
            ->first();

        if ($currentTerm === null) {
            return;
        }

        $professorsBySubject = $this->seedProfessors($currentTerm);

        foreach (self::BLOCK_SUBJECTS_BY_YEAR as $yearLevel => $subjectCodes) {
            $blockCodes = self::BLOCK_CODES_BY_YEAR[$yearLevel];

            $plan = AcademicTermSectionPlan::updateOrCreate(
                [
                    'academic_term_id' => $currentTerm->id,
                    'curriculum_id' => $curriculum->id,
                    'college' => 'demo',
                    'year_level' => $yearLevel,
                ],
                [
                    'section_count' => count($blockCodes),
                    'students_per_block' => 40,
                    'status' => SectionPlanStatus::Submitted,
                    'submitted_by' => $encoder->id,
                    'submitted_at' => now(),
                ],
            );

            foreach ($blockCodes as $blockIndex => $blockCode) {
                $schedule = self::BLOCK_SCHEDULES[$blockIndex];

                foreach ($subjectCodes as $subjectIndex => $subjectCode) {
                    $subject = $this->subject($subjectCode);
                    $startHour = $schedule['start_hour'] + $subjectIndex;

                    Section::updateOrCreate(
                        [
                            'academic_term_id' => $currentTerm->id,
                            'subject_id' => $subject->id,
                            'section_code' => $blockCode,
                        ],
                        [
                            'section_plan_id' => $plan->id,
                            'professor_id' => $this->professorFor($professorsBySubject, $subjectCode)->id,
                            'schedule_days' => $schedule['days'],
                            'starts_at_time' => sprintf('%02d:00:00', $startHour),
                            'ends_at_time' => sprintf('%02d:00:00', $startHour + 1),
                            'room' => $schedule['room'],
                            'capacity' => 40,
                            'capacity_source' => 'plan',
                            'is_block_exclusive' => true,
                            'status' => SectionStatus::Published,
                        ],
                    );
                }
            }
        }
    }

    /**
     * One `User` (role Faculty, college CCS) per `PROFESSORS` entry, each
     * with a declared weekday 08:00–17:00 availability (covering every
     * `BLOCK_SCHEDULES` slot their sections actually meet at) and a rank-1
     * `FacultySubjectPreference` for their own subject — real Faculty Input
     * rows, not just a `professor_id` pointer, so `faculty.<name>@grc.test`
     * has a genuine Teaching Schedule/Class Roster/Grade Submission story.
     *
     * @return array<string, User> subject code => the professor who owns it
     */
    private function seedProfessors(AcademicTerm $currentTerm): array
    {
        $professorsBySubject = [];

        foreach (self::PROFESSORS as $subjectCode => $definition) {
            $professor = User::updateOrCreate(
                ['email' => "prof.{$definition['email_local']}@grc.test"],
                [
                    'name' => $definition['name'],
                    'password' => self::PASSWORD,
                    'role' => UserRole::Faculty,
                    'college' => CollegeCode::Ccs,
                    'status' => UserStatus::Active,
                ],
            );

            foreach ([1, 2, 3, 4, 5] as $dayOfWeek) {
                FacultyAvailability::updateOrCreate(
                    [
                        'professor_id' => $professor->id,
                        'academic_term_id' => $currentTerm->id,
                        'day_of_week' => $dayOfWeek,
                        'starts_at_time' => '08:00:00',
                    ],
                    ['ends_at_time' => '17:00:00'],
                );
            }

            FacultySubjectPreference::updateOrCreate(
                [
                    'professor_id' => $professor->id,
                    'academic_term_id' => $currentTerm->id,
                    'subject_id' => $this->subject($subjectCode)->id,
                ],
                ['rank' => 1],
            );

            $professorsBySubject[$subjectCode] = $professor;
        }

        return $professorsBySubject;
    }

    /**
     * @param  array<string, User>  $professorsBySubject
     */
    private function professorFor(array $professorsBySubject, string $subjectCode): User
    {
        return $professorsBySubject[$subjectCode]
            ?? throw new RuntimeException("No professor mapped for subject '{$subjectCode}'.");
    }

    /**
     * @param  array{number: string, email: string, name: string, yearLevel: int, completedOrdinals: int, overrides: array<string, string>, omit: list<string>}  $definition
     */
    private function studentProfile(array $definition, Program $program, Curriculum $curriculum): StudentProfile
    {
        $user = User::updateOrCreate(
            ['email' => $definition['email']],
            [
                'name' => $definition['name'],
                'password' => self::PASSWORD,
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
                'year_level' => $definition['yearLevel'],
                // Left unset here on purpose — ReclassifyStudentEnrollmentCategory
                // derives the real value from the grade history seeded just
                // below, for every student, every seed run.
                'enrollment_category' => null,
                'enrollment_category_derived_at' => null,
                'admission_status' => AdmissionStatus::Admitted,
                'academic_standing' => AcademicStanding::Good,
            ],
        );
    }

    /**
     * @param  array{number: string, email: string, name: string, yearLevel: int, completedOrdinals: int, overrides: array<string, string>, omit: list<string>}  $definition
     */
    private function seedGradeHistory(StudentProfile $profile, array $definition, User $encoder): void
    {
        for ($ordinal = 1; $ordinal <= $definition['completedOrdinals']; $ordinal++) {
            $term = $this->termForOrdinal($ordinal, $definition['completedOrdinals']);

            foreach (self::SEMESTER_SUBJECTS[$ordinal] as $row) {
                if (in_array($row['subject'], $definition['omit'], true)) {
                    continue;
                }

                $mark = $definition['overrides'][$row['subject']] ?? $row['mark'];
                $subject = $this->subject($row['subject']);
                $numeric = is_numeric($mark);

                AcademicGrade::updateOrCreate(
                    [
                        'student_id' => $profile->id,
                        'subject_id' => $subject->id,
                        'academic_term_id' => $term->id,
                    ],
                    [
                        // Nullable and intentionally null: this historical
                        // result is carried without an owning section, the
                        // same precedent past demo grades have always used.
                        'section_id' => null,
                        'mark' => $mark,
                        'final_grade' => $numeric ? $mark : null,
                        'remarks' => null,
                        'status' => GradeStatus::Locked,
                        'encoded_by' => $encoder->id,
                        'submitted_at' => now(),
                        'locked_at' => now(),
                    ],
                );
            }
        }
    }

    /**
     * A completed ordinal is always right-aligned to the most recent closed
     * term — see the class docblock.
     */
    private function termForOrdinal(int $ordinal, int $completedOrdinals): AcademicTerm
    {
        $index = (7 - $completedOrdinals) + $ordinal - 1;
        $reference = self::CHRONOLOGICAL_TERMS[$index]
            ?? throw new RuntimeException("No chronological term mapped for ordinal {$ordinal}.");

        return AcademicTerm::query()
            ->where('school_year', $reference['school_year'])
            ->where('semester', $reference['semester'])
            ->firstOrFail();
    }

    /**
     * Runs the real classifier against every seeded student's newly-written
     * grade history, against the current `semester_ongoing` term — the
     * seeder proves its own correctness this way, per the approved design:
     * `enrollment_category` is never hard-coded here.
     *
     * @param  Collection<int, StudentProfile>  $profiles
     */
    private function reclassify(Collection $profiles): void
    {
        $currentTerm = AcademicTerm::query()
            ->where('status', AcademicTermStatus::SemesterOngoing)
            ->first();

        if ($currentTerm === null) {
            return;
        }

        app(ReclassifyStudentEnrollmentCategory::class)->executeMany(
            $profiles,
            $currentTerm,
            $this->userWithRole(UserRole::RegistrarHead),
            new AuditRequestContext('demo-enrollment-seed', null),
        );
    }

    private function subject(string $code): Subject
    {
        $subject = Subject::query()->where('code', $code)->first();

        if ($subject === null) {
            throw new RuntimeException("Subject '{$code}' is missing. Run SubjectSeeder first.");
        }

        return $subject;
    }

    private function curriculum(): Curriculum
    {
        $curriculum = Curriculum::query()
            ->where('name', 'BSCS Grade History Demo 2026')
            ->first();

        if ($curriculum === null) {
            throw new RuntimeException(
                'DemoEnrollmentSeeder requires the seeded BSCS-DEMO curriculum. Run CurriculumSeeder first.',
            );
        }

        return $curriculum;
    }

    private function program(): Program
    {
        $program = Program::query()->where('code', 'BSCS-DEMO')->first();

        if ($program === null) {
            throw new RuntimeException(
                'DemoEnrollmentSeeder requires the seeded BSCS program. Run ProgramSeeder first.',
            );
        }

        return $program;
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
