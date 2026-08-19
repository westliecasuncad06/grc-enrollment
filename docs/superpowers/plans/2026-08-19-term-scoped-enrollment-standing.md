# Term-Scoped Enrollment Standing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cumulative-lifetime Regular/Irregular classifier with a term-scoped one, so a student's standing reflects whether they can take exactly the block the Program Chair set for their year level *this term* — fixing the real bug where a student (Socorro Y. Amurao) stays Irregular forever because of an unresolved backlog subject that isn't even offered this term.

**Architecture:** A new DB-backed Action, `App\Actions\Academic\ClassifyEnrollmentStanding`, replaces the pure `App\Domain\Enrollment\EnrollmentCategoryClassifier`. `App\Actions\Academic\ReclassifyStudentEnrollmentCategory` delegates to it (grouped by curriculum+year level for batching) instead of its old grades+placements+ordinal pipeline. `App\Actions\Enrollment\BuildEnrollmentAccessContext` uses the live-computed verdict for this request's routing decision and best-effort persists it.

**Tech Stack:** Laravel 12, PHP, PHPUnit (`RefreshDatabase`), MariaDB.

**Spec:** `docs/superpowers/specs/2026-08-19-term-scoped-enrollment-standing-design.md`

## Global Constraints

- Working directory is `C:/xampp/htdocs/GRC-ENROLLMENT/backend` for every PHP/artisan command below unless stated otherwise. Work directly on `main` — no worktree.
- `ClassifyEnrollmentStanding::classify()`/`classifyMany()` return `?ClassificationVerdict` — `null` means undetermined (no block published yet for that year level this term); never coerce this to Irregular.
- `classifyMany()` requires every student in the collection to share the same `curriculum_id` and `year_level` — callers group first.
- Never throw from a self-heal path a student's own page load can trigger — a missing `registrar_head` actor for the best-effort persist is a skip, not an error.
- Run `vendor/bin/phpunit --filter <TestClass>` (or the project's configured `php artisan test --filter <TestClass>`) after every task; run the full suite at the end of Task 6.
- Every git commit message is scoped to the one task it closes; use `git add <specific files>`, never `git add -A`.

---

### Task 1: `ClassifyEnrollmentStanding` — the new term-scoped rule

**Files:**
- Create: `app/Actions/Academic/ClassifyEnrollmentStanding.php`
- Test: `tests/Feature/Actions/Academic/ClassifyEnrollmentStandingTest.php`

**Interfaces:**
- Produces: `App\Actions\Academic\ClassifyEnrollmentStanding::classify(StudentProfile $student, AcademicTerm $term): ?ClassificationVerdict` and `::classifyMany(Collection $students, AcademicTerm $term): array<int, ?ClassificationVerdict>` (keyed by `student->id`). Consumed by Task 2 and Task 3.
- Consumes: existing `App\Domain\Academic\PrerequisiteEvaluator` (constructor-injected, already container-bound — see `App\Actions\Enrollment\BuildEnrollmentBlockPool`), existing models `App\Models\{StudentProfile,AcademicTerm,Section,CurriculumSubject,CurriculumMigrationCredit,AcademicGrade}`, existing `App\Domain\Enrollment\ClassificationVerdict` (unchanged — `ClassificationVerdict::regular()` / `::irregular(array $reasons)`), existing `App\Domain\Scheduling\SectionStatus::Published`, `App\Domain\Academic\GradeStatus::Locked`.

- [ ] **Step 1: Write the failing feature test (rule matrix)**

Create `tests/Feature/Actions/Academic/ClassifyEnrollmentStandingTest.php`:

```php
<?php

namespace Tests\Feature\Actions\Academic;

use App\Actions\Academic\ClassifyEnrollmentStanding;
use App\Domain\Academic\GradeStatus;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\Curriculum;
use App\Models\CurriculumMigration;
use App\Models\CurriculumMigrationCredit;
use App\Models\CurriculumSubject;
use App\Models\CurriculumSubjectEquivalency;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\SubjectPrerequisite;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ClassifyEnrollmentStandingTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeTerm(string $semester = '2nd'): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => $semester,
            'status' => AcademicTermStatus::SemesterOngoing,
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

    private function makeSubject(string $code): Subject
    {
        return Subject::create(['code' => $code, 'title' => $code.' Title', 'units' => 3.0, 'status' => SubjectStatus::Active]);
    }

    private function placeSubject(Curriculum $curriculum, Subject $subject, int $yearLevel, string $semester = '2nd'): CurriculumSubject
    {
        return CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => $yearLevel, 'semester' => $semester, 'is_required' => true,
        ]);
    }

    private function makeStudent(Curriculum $curriculum, string $email, int $yearLevel = 2): StudentProfile
    {
        $user = User::create([
            'name' => 'Test Student', 'email' => $email,
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);

        return StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => 'STU-'.$user->id,
            'program_id' => $curriculum->program_id,
            'curriculum_id' => $curriculum->id,
            'year_level' => $yearLevel,
            'admission_status' => AdmissionStatus::Admitted,
            'academic_standing' => AcademicStanding::Good,
        ]);
    }

    private function makePlan(AcademicTerm $term, Curriculum $curriculum, int $yearLevel): AcademicTermSectionPlan
    {
        return AcademicTermSectionPlan::create([
            'academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id,
            'college' => 'ccs', 'year_level' => $yearLevel, 'section_count' => 1,
            'students_per_block' => 40, 'status' => 'submitted',
        ]);
    }

    private function makeBlockSection(AcademicTerm $term, AcademicTermSectionPlan $plan, Subject $subject, string $blockCode = 'IT201'): Section
    {
        return Section::create([
            'academic_term_id' => $term->id, 'section_plan_id' => $plan->id, 'subject_id' => $subject->id,
            'section_code' => $blockCode, 'schedule_days' => 'MWF', 'starts_at_time' => '08:00:00',
            'ends_at_time' => '09:00:00', 'capacity' => 40, 'is_block_exclusive' => true,
            'status' => SectionStatus::Published,
        ]);
    }

    private function makePlainSection(AcademicTerm $term, Subject $subject, array $overrides = []): Section
    {
        return Section::create(array_merge([
            'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'section_code' => 'A',
            'capacity' => 40, 'is_block_exclusive' => false, 'status' => SectionStatus::Published,
        ], $overrides));
    }

    private function lockGrade(StudentProfile $student, Subject $subject, AcademicTerm $term, string $mark): AcademicGrade
    {
        $encoder = User::create([
            'name' => 'Encoder', 'email' => 'encoder.'.uniqid().'@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::RegistrarHead, 'status' => UserStatus::Active,
        ]);

        return AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $subject->id, 'academic_term_id' => $term->id,
            'mark' => $mark, 'status' => GradeStatus::Locked, 'encoded_by' => $encoder->id,
        ]);
    }

    public function test_a_student_who_fits_the_standard_block_exactly_is_regular(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $subject = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $subject, 2);
        $this->makeBlockSection($term, $plan, $subject);
        $student = $this->makeStudent($curriculum, 'fits@grc.test');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertTrue($verdict->isRegular());
    }

    public function test_a_backlog_subject_with_an_open_section_this_term_makes_the_student_irregular(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        $backlog = $this->makeSubject('ITC');
        $this->placeSubject($curriculum, $backlog, 1, '1st');
        $this->makePlainSection($term, $backlog);
        $student = $this->makeStudent($curriculum, 'backlog-open@grc.test');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertFalse($verdict->isRegular());
        self::assertSame('needs_adding_backlog', $verdict->reasons[0]['code']);
        self::assertStringContainsString('ITC', $verdict->reasons[0]['message']);
    }

    public function test_a_backlog_subject_with_no_section_this_term_does_not_affect_standing(): void
    {
        // The exact Socorro Y. Amurao case: a backlog subject exists, but
        // it isn't offered this (2nd semester) term, so there is nothing
        // actionable for it right now.
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        $backlog = $this->makeSubject('ITC');
        $this->placeSubject($curriculum, $backlog, 1, '1st');
        // No section created for ITC this term at all.
        $student = $this->makeStudent($curriculum, 'backlog-closed@grc.test');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertTrue($verdict->isRegular());
    }

    public function test_a_standard_subject_already_passed_early_makes_the_student_irregular(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $subject = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $subject, 2);
        $this->makeBlockSection($term, $plan, $subject);
        $student = $this->makeStudent($curriculum, 'early-pass@grc.test');
        $this->lockGrade($student, $subject, $term, '2.00');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertFalse($verdict->isRegular());
        self::assertSame('needs_removing_completed', $verdict->reasons[0]['code']);
    }

    public function test_a_standard_subject_blocked_by_an_unmet_prerequisite_makes_the_student_irregular(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $prereq = $this->makeSubject('CS101');
        $this->placeSubject($curriculum, $prereq, 1, '1st');
        $advanced = $this->makeSubject('CS201');
        $placement = $this->placeSubject($curriculum, $advanced, 2);
        SubjectPrerequisite::create([
            'curriculum_subject_id' => $placement->id, 'prerequisite_subject_id' => $prereq->id, 'minimum_grade' => '3.00',
        ]);
        $this->makeBlockSection($term, $plan, $advanced);
        $student = $this->makeStudent($curriculum, 'unmet-prereq@grc.test');
        // CS101 never taken.

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertFalse($verdict->isRegular());
        self::assertSame('needs_removing_prerequisite', $verdict->reasons[0]['code']);
    }

    public function test_no_block_published_yet_for_the_year_level_is_undetermined(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        // No plan, no block section at all for year level 2 this term.
        $student = $this->makeStudent($curriculum, 'no-block@grc.test');

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNull($verdict);
    }

    public function test_a_migration_credit_on_a_backlog_subject_is_not_counted_as_needing_addition(): void
    {
        $term = $this->makeTerm();
        $target = $this->makeCurriculum();
        $source = Curriculum::create([
            'program_id' => $target->program_id, 'name' => 'BSCS Previous Curriculum',
            'effective_school_year' => '2023-2024', 'status' => CurriculumStatus::Archived,
        ]);
        $plan = $this->makePlan($term, $target, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($target, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        $oldSubject = $this->makeSubject('CS-OLD');
        $newSubject = $this->makeSubject('CS-NEW');
        $this->placeSubject($source, $oldSubject, 1, '1st');
        $this->placeSubject($target, $newSubject, 1, '1st');
        $this->makePlainSection($term, $newSubject);
        $student = $this->makeStudent($target, 'credited-backlog@grc.test');
        $registrar = User::create([
            'name' => 'Registrar', 'email' => 'registrar.credit@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::RegistrarHead, 'status' => UserStatus::Active,
        ]);
        $grade = $this->lockGrade($student, $oldSubject, $term, '2.00');
        $equivalency = CurriculumSubjectEquivalency::create([
            'source_curriculum_id' => $source->id, 'target_curriculum_id' => $target->id,
            'source_subject_id' => $oldSubject->id, 'target_subject_id' => $newSubject->id,
        ]);
        $migration = CurriculumMigration::create([
            'student_id' => $student->id, 'source_curriculum_id' => $source->id,
            'target_curriculum_id' => $target->id, 'processed_by' => $registrar->id, 'migrated_at' => now(),
        ]);
        CurriculumMigrationCredit::create([
            'curriculum_migration_id' => $migration->id, 'curriculum_subject_equivalency_id' => $equivalency->id,
            'source_academic_grade_id' => $grade->id, 'target_subject_id' => $newSubject->id,
        ]);

        $verdict = app(ClassifyEnrollmentStanding::class)->classify($student, $term);

        self::assertNotNull($verdict);
        self::assertTrue($verdict->isRegular());
    }

    public function test_classify_many_batches_across_students_sharing_curriculum_and_year_level(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $subject = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $subject, 2);
        $this->makeBlockSection($term, $plan, $subject);
        $fits = $this->makeStudent($curriculum, 'many-fits@grc.test');
        $early = $this->makeStudent($curriculum, 'many-early@grc.test');
        $this->lockGrade($early, $subject, $term, '2.00');

        $verdicts = app(ClassifyEnrollmentStanding::class)->classifyMany(
            new Collection([$fits, $early]),
            $term,
        );

        self::assertTrue($verdicts[$fits->id]->isRegular());
        self::assertFalse($verdicts[$early->id]->isRegular());
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `php artisan test --filter=ClassifyEnrollmentStandingTest`
Expected: FAIL — `Class "App\Actions\Academic\ClassifyEnrollmentStanding" not found`.

- [ ] **Step 3: Write `ClassifyEnrollmentStanding`**

Create `app/Actions/Academic/ClassifyEnrollmentStanding.php`:

```php
<?php

namespace App\Actions\Academic;

use App\Domain\Academic\GradeMark;
use App\Domain\Academic\GradeStatus;
use App\Domain\Academic\PrerequisiteEvaluator;
use App\Domain\Enrollment\ClassificationVerdict;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\CurriculumMigrationCredit;
use App\Models\CurriculumSubject;
use App\Models\Section;
use App\Models\StudentProfile;
use Illuminate\Database\Eloquent\Collection;

/**
 * Term-scoped Regular/Irregular standing (spec
 * docs/superpowers/specs/2026-08-19-term-scoped-enrollment-standing-design.md),
 * superseding the 2026-08-04 cumulative-lifetime rule that used to live in
 * the now-deleted `App\Domain\Enrollment\EnrollmentCategoryClassifier`. A
 * student is Regular for a term when they can take exactly the standard
 * block subject set the Program Chair published for their year level —
 * nothing needs adding (an offered backlog subject outside the block) and
 * nothing needs removing (a block subject already passed, or blocked by an
 * unmet prerequisite).
 *
 * `classifyMany()` is the batch entry point — every student passed in MUST
 * share the same `(curriculum_id, year_level)`; the caller
 * (`ReclassifyStudentEnrollmentCategory`) groups students by that pair
 * before calling, so the standard-set/placement/backlog queries run once
 * per group, not once per student. `classify()` is a thin single-student
 * wrapper for callers with exactly one student in hand.
 *
 * `null` means undetermined (no block published yet for that year level
 * this term) — never coerce this to Irregular. Forcing Irregular here would
 * eagerly flip every student in that year level the instant they open
 * their enrollment page, purely because setup isn't finished yet.
 */
final readonly class ClassifyEnrollmentStanding
{
    public function __construct(private PrerequisiteEvaluator $evaluator) {}

    public function classify(StudentProfile $student, AcademicTerm $term): ?ClassificationVerdict
    {
        return $this->classifyMany(new Collection([$student]), $term)[$student->id];
    }

    /**
     * @param  Collection<int, StudentProfile>  $students  Every student must share the same curriculum_id and year_level.
     * @return array<int, ?ClassificationVerdict>
     */
    public function classifyMany(Collection $students, AcademicTerm $term): array
    {
        if ($students->isEmpty()) {
            return [];
        }

        $first = $students->first();
        $curriculumId = $first->curriculum_id;
        $yearLevel = $first->year_level;
        $studentIds = $students->map(fn (StudentProfile $s): int => $s->id)->all();

        $standardSubjectIds = $this->standardBlockSubjectIds($term, $curriculumId, $yearLevel);

        if ($standardSubjectIds === []) {
            return collect($studentIds)->mapWithKeys(fn (int $id): array => [$id => null])->all();
        }

        $placements = CurriculumSubject::query()
            ->where('curriculum_id', $curriculumId)
            ->with(['prerequisites', 'subject:id,code'])
            ->get()
            ->keyBy('subject_id');

        $backlogSubjectIds = $placements->keys()->diff($standardSubjectIds)->values()->all();
        $openBacklogSubjectIds = $this->openNonBlockSectionSubjectIds($term, $backlogSubjectIds);

        $marksByStudent = $this->latestLockedMarksByStudent($studentIds);
        $creditedByStudent = $this->creditedSubjectIdsByStudent($studentIds, $curriculumId);

        $verdicts = [];

        foreach ($students as $student) {
            $marks = $marksByStudent[$student->id] ?? [];
            $credited = $creditedByStudent[$student->id] ?? [];
            $reasons = [];

            foreach ($standardSubjectIds as $subjectId) {
                $placement = $placements->get($subjectId);
                if ($placement === null) {
                    continue;
                }

                if ($this->isCompleted($subjectId, $marks, $credited)) {
                    $reasons[] = [
                        'code' => 'needs_removing_completed',
                        'message' => "{$placement->subject->code} has already been completed and is no longer part of this term's standard load.",
                    ];

                    continue;
                }

                if (! $this->prerequisitesSatisfied($placement, $marks, $credited)) {
                    $reasons[] = [
                        'code' => 'needs_removing_prerequisite',
                        'message' => "{$placement->subject->code} cannot be taken yet — a prerequisite is not met.",
                    ];
                }
            }

            foreach ($openBacklogSubjectIds as $subjectId) {
                $placement = $placements->get($subjectId);
                if ($placement === null || $this->isCompleted($subjectId, $marks, $credited)) {
                    continue;
                }
                if (! $this->prerequisitesSatisfied($placement, $marks, $credited)) {
                    continue;
                }

                $reasons[] = [
                    'code' => 'needs_adding_backlog',
                    'message' => "{$placement->subject->code} has an open section this term and still needs to be taken.",
                ];
            }

            $verdicts[$student->id] = $reasons === []
                ? ClassificationVerdict::regular()
                : ClassificationVerdict::irregular($reasons);
        }

        return $verdicts;
    }

    /**
     * @return list<int>
     */
    private function standardBlockSubjectIds(AcademicTerm $term, int $curriculumId, int $yearLevel): array
    {
        return Section::query()
            ->where('academic_term_id', $term->id)
            ->where('status', SectionStatus::Published)
            ->where('is_block_exclusive', true)
            ->whereHas('sectionPlan', fn ($query) => $query
                ->where('year_level', $yearLevel)
                ->where('curriculum_id', $curriculumId))
            ->distinct()
            ->pluck('subject_id')
            ->all();
    }

    /**
     * @param  list<int>  $candidateSubjectIds
     * @return list<int>
     */
    private function openNonBlockSectionSubjectIds(AcademicTerm $term, array $candidateSubjectIds): array
    {
        if ($candidateSubjectIds === []) {
            return [];
        }

        return Section::query()
            ->where('academic_term_id', $term->id)
            ->where('status', SectionStatus::Published)
            ->where(fn ($query) => $query->where('is_block_exclusive', false)->orWhereNull('is_block_exclusive'))
            ->whereIn('subject_id', $candidateSubjectIds)
            ->get(['id', 'subject_id', 'capacity', 'enrolled_count'])
            ->filter(fn (Section $section): bool => $section->remainingSeats() > 0)
            ->pluck('subject_id')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  list<int>  $studentIds
     * @return array<int, array<int, GradeMark>>
     */
    private function latestLockedMarksByStudent(array $studentIds): array
    {
        $grades = AcademicGrade::query()
            ->whereIn('student_id', $studentIds)
            ->where('status', GradeStatus::Locked)
            ->orderBy('student_id')
            ->orderByDesc('academic_term_id')
            ->orderByDesc('id')
            ->get(['student_id', 'subject_id', 'mark']);

        $marksByStudent = [];
        foreach ($grades as $grade) {
            if ($grade->mark === null) {
                continue;
            }
            $marksByStudent[$grade->student_id] ??= [];
            if (! array_key_exists($grade->subject_id, $marksByStudent[$grade->student_id])) {
                $marksByStudent[$grade->student_id][$grade->subject_id] = $grade->mark;
            }
        }

        return $marksByStudent;
    }

    /**
     * @param  list<int>  $studentIds
     * @return array<int, array<int, true>>
     */
    private function creditedSubjectIdsByStudent(array $studentIds, int $curriculumId): array
    {
        $credits = CurriculumMigrationCredit::query()
            ->whereHas('migration', fn ($query) => $query
                ->whereIn('student_id', $studentIds)
                ->where('target_curriculum_id', $curriculumId))
            ->with('migration:id,student_id,target_curriculum_id')
            ->get(['id', 'curriculum_migration_id', 'target_subject_id']);

        $byStudent = [];
        foreach ($credits as $credit) {
            $studentId = $credit->migration->student_id;
            $byStudent[$studentId] ??= [];
            $byStudent[$studentId][$credit->target_subject_id] = true;
        }

        return $byStudent;
    }

    /**
     * @param  array<int, GradeMark>  $marks
     * @param  array<int, true>  $credited
     */
    private function isCompleted(int $subjectId, array $marks, array $credited): bool
    {
        if (isset($credited[$subjectId])) {
            return true;
        }

        return ($marks[$subjectId] ?? null)?->isPassing() === true;
    }

    /**
     * @param  array<int, GradeMark>  $marks
     * @param  array<int, true>  $credited
     */
    private function prerequisitesSatisfied(CurriculumSubject $placement, array $marks, array $credited): bool
    {
        foreach ($placement->prerequisites as $edge) {
            if (isset($credited[$edge->prerequisite_subject_id])) {
                continue;
            }

            $mark = $marks[$edge->prerequisite_subject_id] ?? null;
            if ($mark?->isCompletion() === true) {
                continue;
            }

            $verdict = $this->evaluator->evaluate($mark?->value, $edge->minimum_grade);
            if ($verdict->status->value === 'not_satisfied') {
                return false;
            }
        }

        return true;
    }
}
```

- [ ] **Step 4: Run the test again**

Run: `php artisan test --filter=ClassifyEnrollmentStandingTest`
Expected: all 8 tests PASS. If `prerequisites` isn't a valid relation name on `CurriculumSubject` (double check against `app/Models/CurriculumSubject.php:84`, already confirmed as `prerequisites(): HasMany` during design), fix the eager-load call accordingly — do not change the test.

- [ ] **Step 5: Commit**

```bash
git add app/Actions/Academic/ClassifyEnrollmentStanding.php tests/Feature/Actions/Academic/ClassifyEnrollmentStandingTest.php
git commit -m "feat(enrollment): add term-scoped ClassifyEnrollmentStanding"
```

---

### Task 2: Rewire `ReclassifyStudentEnrollmentCategory`

**Files:**
- Modify: `app/Actions/Academic/ReclassifyStudentEnrollmentCategory.php`
- Modify: `tests/Feature/Actions/Academic/ReclassifyStudentEnrollmentCategoryTest.php`

**Interfaces:**
- Consumes: `ClassifyEnrollmentStanding::classifyMany()` from Task 1.
- Produces: `ReclassifyStudentEnrollmentCategory::execute()`/`executeMany()`/`preview()` — **signatures unchanged** (`StudentProfile`/`Collection<int,StudentProfile>`, `AcademicTerm`, `User $actor`, `AuditRequestContext $context` → `ClassificationVerdict` / `array<int, ClassificationVerdict>`, always non-null). Consumed by Task 3, the existing grade-lock hook in `UpdateAcademicGrade::transition()` (unchanged call site), and `students:reclassify`.

- [ ] **Step 1: Replace the test file's scenarios**

Open `tests/Feature/Actions/Academic/ReclassifyStudentEnrollmentCategoryTest.php`. The old scenarios test the deleted cumulative-lifetime rule and no longer make sense (a failing grade on its own no longer flips standing — only a *backlog subject with an open section*, an *early-completed standard subject*, or an *unmet-prerequisite standard subject* does). Replace the whole file with:

```php
<?php

namespace Tests\Feature\Actions\Academic;

use App\Actions\Academic\ReclassifyStudentEnrollmentCategory;
use App\Domain\Academic\GradeStatus;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Notifications\NotificationType;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Notification;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class ReclassifyStudentEnrollmentCategoryTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeTerm(string $semester = '2nd'): AcademicTerm
    {
        return AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => $semester, 'status' => AcademicTermStatus::SemesterOngoing,
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

    private function makeSubject(string $code): Subject
    {
        return Subject::create(['code' => $code, 'title' => $code.' Title', 'units' => 3.0, 'status' => SubjectStatus::Active]);
    }

    private function placeSubject(Curriculum $curriculum, Subject $subject, int $yearLevel, string $semester = '2nd'): CurriculumSubject
    {
        return CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => $yearLevel, 'semester' => $semester, 'is_required' => true,
        ]);
    }

    private function makeStudent(Curriculum $curriculum, string $email, int $yearLevel = 2, ?string $category = null): StudentProfile
    {
        $user = User::create([
            'name' => 'Test Student', 'email' => $email,
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);

        return StudentProfile::create([
            'user_id' => $user->id,
            'student_number' => 'STU-'.$user->id,
            'program_id' => $curriculum->program_id,
            'curriculum_id' => $curriculum->id,
            'year_level' => $yearLevel,
            'enrollment_category' => $category,
            'admission_status' => AdmissionStatus::Admitted,
            'academic_standing' => AcademicStanding::Good,
        ]);
    }

    private function makeRegistrarHead(): User
    {
        return User::create([
            'name' => 'Registrar', 'email' => 'registrar.reclassify@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::RegistrarHead, 'status' => UserStatus::Active,
        ]);
    }

    private function makePlan(AcademicTerm $term, Curriculum $curriculum, int $yearLevel): AcademicTermSectionPlan
    {
        return AcademicTermSectionPlan::create([
            'academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id,
            'college' => 'ccs', 'year_level' => $yearLevel, 'section_count' => 1,
            'students_per_block' => 40, 'status' => 'submitted',
        ]);
    }

    private function makeBlockSection(AcademicTerm $term, AcademicTermSectionPlan $plan, Subject $subject): Section
    {
        return Section::create([
            'academic_term_id' => $term->id, 'section_plan_id' => $plan->id, 'subject_id' => $subject->id,
            'section_code' => 'IT201', 'schedule_days' => 'MWF', 'starts_at_time' => '08:00:00',
            'ends_at_time' => '09:00:00', 'capacity' => 40, 'is_block_exclusive' => true,
            'status' => SectionStatus::Published,
        ]);
    }

    private function makePlainSection(AcademicTerm $term, Subject $subject): Section
    {
        return Section::create([
            'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'section_code' => 'A',
            'capacity' => 40, 'is_block_exclusive' => false, 'status' => SectionStatus::Published,
        ]);
    }

    private function lockGrade(StudentProfile $student, Subject $subject, AcademicTerm $term, string $mark, User $encoder): AcademicGrade
    {
        return AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $subject->id, 'academic_term_id' => $term->id,
            'mark' => $mark, 'status' => GradeStatus::Locked, 'encoded_by' => $encoder->id,
        ]);
    }

    public function test_a_student_who_fits_the_block_stays_regular_and_writes_nothing(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $subject = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $subject, 2);
        $this->makeBlockSection($term, $plan, $subject);
        $student = $this->makeStudent($curriculum, 'clean@grc.test', yearLevel: 2, category: 'regular');
        $registrar = $this->makeRegistrarHead();

        $verdict = app(ReclassifyStudentEnrollmentCategory::class)->execute(
            $student, $term, $registrar, new AuditRequestContext('test-reclassify', null),
        );

        self::assertTrue($verdict->isRegular());
        self::assertSame('regular', $student->fresh()->enrollment_category);
        self::assertSame(0, AuditLog::query()->where('action', AuditAction::STUDENT_ENROLLMENT_CATEGORY_RECLASSIFIED)->count());
        self::assertSame(0, Notification::query()->where('type', NotificationType::EnrollmentCategoryReclassified)->count());
    }

    public function test_an_open_backlog_subject_flips_the_student_to_irregular_and_audits_and_notifies(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        $backlog = $this->makeSubject('ITC');
        $this->placeSubject($curriculum, $backlog, 1, '1st');
        $this->makePlainSection($term, $backlog);
        $student = $this->makeStudent($curriculum, 'backlog@grc.test', yearLevel: 2, category: 'regular');
        $registrar = $this->makeRegistrarHead();

        $verdict = app(ReclassifyStudentEnrollmentCategory::class)->execute(
            $student, $term, $registrar, new AuditRequestContext('test-reclassify', null),
        );

        self::assertFalse($verdict->isRegular());
        self::assertSame(EnrollmentCategory::Irregular, $verdict->category);

        $fresh = $student->fresh();
        self::assertSame('irregular', $fresh->enrollment_category);
        self::assertNotNull($fresh->enrollment_category_derived_at);

        $audit = AuditLog::query()->where('action', AuditAction::STUDENT_ENROLLMENT_CATEGORY_RECLASSIFIED)->sole();
        self::assertSame('regular', $audit->before_values['enrollment_category']);
        self::assertSame('irregular', $audit->after_values['enrollment_category']);

        $notification = Notification::query()->where('type', NotificationType::EnrollmentCategoryReclassified)->sole();
        self::assertSame($student->user_id, $notification->user_id);
        self::assertStringContainsString('ITC', $notification->message);
    }

    public function test_a_backlog_subject_no_longer_offered_this_term_returns_the_student_to_regular(): void
    {
        // The Socorro Y. Amurao case: was irregular because a backlog
        // subject had an open section; that section is gone this term (a
        // 1st-semester-only subject during a 2nd-semester term), so there
        // is nothing left to add and she reverts to Regular.
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        $backlog = $this->makeSubject('ITC');
        $this->placeSubject($curriculum, $backlog, 1, '1st');
        // No section for ITC exists this term.
        $student = $this->makeStudent($curriculum, 'no-longer-offered@grc.test', yearLevel: 2, category: 'irregular');
        $registrar = $this->makeRegistrarHead();

        $verdict = app(ReclassifyStudentEnrollmentCategory::class)->execute(
            $student, $term, $registrar, new AuditRequestContext('test-reclassify', null),
        );

        self::assertTrue($verdict->isRegular());
        self::assertSame('regular', $student->fresh()->enrollment_category);
    }

    public function test_no_block_published_yet_leaves_the_category_untouched(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        // No plan, no block section for year level 2 this term at all.
        $student = $this->makeStudent($curriculum, 'undetermined@grc.test', yearLevel: 2, category: 'regular');
        $registrar = $this->makeRegistrarHead();

        $verdict = app(ReclassifyStudentEnrollmentCategory::class)->execute(
            $student, $term, $registrar, new AuditRequestContext('test-reclassify', null),
        );

        self::assertTrue($verdict->isRegular());
        self::assertSame('regular', $student->fresh()->enrollment_category);
        self::assertSame(0, AuditLog::query()->where('action', AuditAction::STUDENT_ENROLLMENT_CATEGORY_RECLASSIFIED)->count());
    }

    public function test_locking_a_grade_through_the_endpoint_triggers_reclassification(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        // CS-BACKLOG needs CS-PREREQ; it has an open section this term but
        // isn't addable until the prerequisite is met.
        $prereq = $this->makeSubject('CS-PREREQ');
        $this->placeSubject($curriculum, $prereq, 1, '1st');
        $backlogPlacement = $this->placeSubject($curriculum, $this->makeSubject('CS-BACKLOG'), 1, '1st');
        \App\Models\SubjectPrerequisite::create([
            'curriculum_subject_id' => $backlogPlacement->id,
            'prerequisite_subject_id' => $prereq->id,
            'minimum_grade' => '3.00',
        ]);
        $this->makePlainSection($term, Subject::where('code', 'CS-BACKLOG')->sole());
        $student = $this->makeStudent($curriculum, 'endpoint@grc.test', yearLevel: 2, category: 'regular');
        $professor = User::create(['name' => 'Prof', 'email' => 'prof.reclassify@grc.test', 'password' => self::PASSWORD, 'role' => UserRole::Faculty, 'status' => UserStatus::Active]);
        $registrar = $this->makeRegistrarHead();
        $grade = AcademicGrade::create([
            'student_id' => $student->id, 'subject_id' => $prereq->id, 'academic_term_id' => $term->id,
            'mark' => '2.00', 'status' => GradeStatus::Submitted, 'encoded_by' => $professor->id,
        ]);
        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => $registrar->email, 'password' => self::PASSWORD,
        ])->json('data.token');

        $this->withToken($token)->patchJson("/api/v1/academic-grades/{$grade->id}", ['action' => 'lock'])
            ->assertOk();

        self::assertSame('irregular', $student->fresh()->enrollment_category);
    }

    public function test_batch_reclassification_of_many_students_does_not_scale_reads_with_student_count(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum, 2);
        $standard = $this->makeSubject('CS201');
        $this->placeSubject($curriculum, $standard, 2);
        $this->makeBlockSection($term, $plan, $standard);
        $backlog = $this->makeSubject('ITC');
        $this->placeSubject($curriculum, $backlog, 1, '1st');
        $this->makePlainSection($term, $backlog);
        $registrar = $this->makeRegistrarHead();

        // 5 students, all starting "regular"; exactly 2 (i=2,4) will have
        // already completed the backlog subject early — the other 3 will
        // still have it open and flip to irregular.
        $students = collect(range(1, 5))->map(function (int $i) use ($curriculum, $term, $backlog, $registrar) {
            $student = $this->makeStudent($curriculum, "batch{$i}@grc.test", yearLevel: 2, category: 'regular');
            if ($i % 2 === 0) {
                $this->lockGrade($student, $backlog, $term, '2.00', $registrar);
            }

            return $student;
        });

        $queryCount = 0;
        DB::listen(function () use (&$queryCount) {
            $queryCount++;
        });

        $verdicts = app(ReclassifyStudentEnrollmentCategory::class)->executeMany(
            Collection::make($students->all()), $term, $registrar, new AuditRequestContext('test-batch-reclassify', null),
        );

        self::assertCount(5, $verdicts);
        $irregularCount = collect($verdicts)->filter(fn ($verdict) => ! $verdict->isRegular())->count();
        self::assertSame(3, $irregularCount);

        // The read side is a small constant number of queries regardless
        // of student count (all 5 share one curriculum+year-level group):
        // one for the standard block set, one for curriculum placements +
        // prerequisites, one for backlog open-section lookup, one for
        // locked marks, one for migration credits. A per-student N+1 would
        // instead scale with student count (25+ here). The write side
        // legitimately scales with the 3 actual changes. Run this test
        // once, note the ACTUAL count PHPUnit reports on failure, and set
        // this bound to roughly double it — the goal is proving "does not
        // scale with N", not pinning an exact number.
        self::assertLessThan(30, $queryCount);
    }
}
```

- [ ] **Step 2: Run to verify failure (compile/logic errors, not yet the target behavior)**

Run: `php artisan test --filter=ReclassifyStudentEnrollmentCategoryTest`
Expected: FAIL — `computeVerdicts()` still calls the deleted-in-spirit ordinal pipeline; some assertions will mismatch.

- [ ] **Step 3: Rewrite `ReclassifyStudentEnrollmentCategory`**

Read the current file first (`app/Actions/Academic/ReclassifyStudentEnrollmentCategory.php`) to keep `execute()`, `executeMany()`, `preview()`, and `auditAndNotify()` exactly as they are — only `computeVerdicts()` and the constructor change, and the now-dead private helpers (`latestLockedMarksByStudent`, `withMigrationCredits`, `placementSlotsByCurriculum`, `currentOrdinal`) are removed along with their now-unused imports (`GradeMark`, `GradeStatus`, `SemesterCoverage`, `SemesterSlot`, `CurriculumPlacementSlot`, `EnrollmentCategoryClassifier`, `CurriculumMigrationCredit`, `CurriculumSubject`, `AcademicGrade`).

Replace the constructor:

```php
    public function __construct(
        private AuditRecorder $auditRecorder,
        private ClassifyEnrollmentStanding $classifier,
    ) {}
```

Add the import `use App\Actions\Academic\ClassifyEnrollmentStanding;` (same namespace, so actually no `use` needed — just reference `ClassifyEnrollmentStanding` directly since it's already in `App\Actions\Academic`).

Replace `computeVerdicts()` (and delete the four now-dead private methods listed above) with:

```php
    /**
     * @param  Collection<int, StudentProfile>  $students
     * @return array{0: array<int, ClassificationVerdict>, 1: list<int>, 2: list<int>}
     */
    private function computeVerdicts(Collection $students, AcademicTerm $currentTerm): array
    {
        if ($students->isEmpty()) {
            return [[], [], []];
        }

        $verdicts = [];
        $toRegularIds = [];
        $toIrregularIds = [];

        $groups = $students->groupBy(
            static fn (StudentProfile $student): string => $student->curriculum_id.':'.$student->year_level,
        );

        foreach ($groups as $group) {
            $groupVerdicts = $this->classifier->classifyMany($group, $currentTerm);

            foreach ($group as $student) {
                $verdict = $groupVerdicts[$student->id];

                if ($verdict === null) {
                    // Undetermined (no block published yet) — carry the
                    // student's current category forward unchanged, and
                    // never write/audit/notify for them.
                    $verdicts[$student->id] = $student->enrollment_category === EnrollmentCategory::Irregular->value
                        ? ClassificationVerdict::irregular([])
                        : ClassificationVerdict::regular();

                    continue;
                }

                $verdicts[$student->id] = $verdict;

                if ($student->enrollment_category === $verdict->category->value) {
                    continue;
                }

                if ($verdict->isRegular()) {
                    $toRegularIds[] = $student->id;
                } else {
                    $toIrregularIds[] = $student->id;
                }
            }
        }

        return [$verdicts, $toRegularIds, $toIrregularIds];
    }
```

Add `use App\Domain\Enrollment\EnrollmentCategory;` if not already imported (it likely already is, since `EnrollmentCategory::Regular->value` was used in `executeMany()` — verify before adding a duplicate `use`).

- [ ] **Step 4: Run the tests**

Run: `php artisan test --filter=ReclassifyStudentEnrollmentCategoryTest`
Expected: all 6 tests PASS. If `test_batch_reclassification_of_many_students_does_not_scale_reads_with_student_count` reports an actual query count close to or over 30, read the reported number in the failure message and adjust the `assertLessThan(30, ...)` bound in the test to roughly double the actual observed count (documenting the real number in the comment) — the goal is proving the read side doesn't scale linearly with student count, not pinning an exact constant.

- [ ] **Step 5: Commit**

```bash
git add app/Actions/Academic/ReclassifyStudentEnrollmentCategory.php tests/Feature/Actions/Academic/ReclassifyStudentEnrollmentCategoryTest.php
git commit -m "feat(enrollment): rewire ReclassifyStudentEnrollmentCategory onto the term-scoped rule"
```

---

### Task 3: Self-healing `BuildEnrollmentAccessContext`

**Files:**
- Modify: `app/Actions/Enrollment/BuildEnrollmentAccessContext.php`
- Create: `tests/Feature/Actions/Enrollment/BuildEnrollmentAccessContextTest.php`
- Modify: `tests/Feature/Api/V1/EnrollmentBlocksEndpointTest.php` (one test's fixture)

**Interfaces:**
- Consumes: `ClassifyEnrollmentStanding::classify()` (Task 1), `ReclassifyStudentEnrollmentCategory::execute()` (Task 2, unchanged signature).
- Produces: `BuildEnrollmentAccessContext::execute(AcademicTerm $term, StudentProfile $student): EnrollmentAccessContext` — **signature unchanged**. Consumed unchanged by `BuildEligibleSubjectPool`, `BuildEnrollmentBlockPool`.

- [ ] **Step 1: Write the failing test**

Create `tests/Feature/Actions/Enrollment/BuildEnrollmentAccessContextTest.php`:

```php
<?php

namespace Tests\Feature\Actions\Enrollment;

use App\Actions\Enrollment\BuildEnrollmentAccessContext;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Enrollment\EnrollmentAudience;
use App\Domain\Identity\AcademicStanding;
use App\Domain\Identity\AdmissionStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Organization\ProgramStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class BuildEnrollmentAccessContextTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function makeCurriculum(): Curriculum
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);

        return Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Active,
        ]);
    }

    private function makeStudent(Curriculum $curriculum, string $email, ?string $category): StudentProfile
    {
        $user = User::create([
            'name' => 'Test Student', 'email' => $email,
            'password' => self::PASSWORD, 'role' => UserRole::Student, 'status' => UserStatus::Active,
        ]);

        return StudentProfile::create([
            'user_id' => $user->id, 'student_number' => 'STU-'.$user->id,
            'program_id' => $curriculum->program_id, 'curriculum_id' => $curriculum->id,
            'year_level' => 2, 'enrollment_category' => $category,
            'admission_status' => AdmissionStatus::Admitted, 'academic_standing' => AcademicStanding::Good,
        ]);
    }

    private function makeBlock(AcademicTerm $term, Curriculum $curriculum): void
    {
        $plan = AcademicTermSectionPlan::create([
            'academic_term_id' => $term->id, 'curriculum_id' => $curriculum->id,
            'college' => 'ccs', 'year_level' => 2, 'section_count' => 1,
            'students_per_block' => 40, 'status' => 'submitted',
        ]);
        $subject = Subject::create(['code' => 'CS201', 'title' => 'CS201 Title', 'units' => 3, 'status' => SubjectStatus::Active]);
        CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $subject->id,
            'year_level' => 2, 'semester' => '2nd', 'is_required' => true,
        ]);
        Section::create([
            'academic_term_id' => $term->id, 'section_plan_id' => $plan->id, 'subject_id' => $subject->id,
            'section_code' => 'IT201', 'schedule_days' => 'MWF', 'starts_at_time' => '08:00:00',
            'ends_at_time' => '09:00:00', 'capacity' => 40, 'is_block_exclusive' => true,
            'status' => SectionStatus::Published,
        ]);
    }

    public function test_a_stale_stored_category_self_heals_to_the_live_verdict_on_the_ongoing_term(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '2nd', 'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        $curriculum = $this->makeCurriculum();
        $this->makeBlock($term, $curriculum);
        // Stored as irregular from a stale prior computation; she fits the
        // block exactly now (no backlog, nothing failed early).
        $student = $this->makeStudent($curriculum, 'stale@grc.test', 'irregular');
        User::create([
            'name' => 'Registrar', 'email' => 'registrar.selfheal@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::RegistrarHead, 'status' => UserStatus::Active,
        ]);

        $context = app(BuildEnrollmentAccessContext::class)->execute($term, $student);

        self::assertNotSame(EnrollmentAudience::Irregular, $context->viewerAudience);
        self::assertSame('regular', $student->fresh()->enrollment_category);
    }

    public function test_browsing_an_archived_term_never_mutates_stored_standing(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2025-2026', 'semester' => '2nd', 'status' => AcademicTermStatus::Archived,
        ]);
        $curriculum = $this->makeCurriculum();
        $this->makeBlock($term, $curriculum);
        $student = $this->makeStudent($curriculum, 'archived@grc.test', 'irregular');

        $context = app(BuildEnrollmentAccessContext::class)->execute($term, $student);

        self::assertSame(EnrollmentAudience::Irregular, $context->viewerAudience);
        self::assertSame('irregular', $student->fresh()->enrollment_category);
    }

    public function test_no_block_published_yet_falls_back_to_the_stored_category_without_writing(): void
    {
        $term = AcademicTerm::create([
            'school_year' => '2026-2027', 'semester' => '2nd', 'status' => AcademicTermStatus::SemesterOngoing,
        ]);
        $curriculum = $this->makeCurriculum();
        // No block published for year level 2 this term.
        $student = $this->makeStudent($curriculum, 'undetermined@grc.test', 'regular');

        $context = app(BuildEnrollmentAccessContext::class)->execute($term, $student);

        self::assertNotSame(EnrollmentAudience::Irregular, $context->viewerAudience);
        self::assertSame('regular', $student->fresh()->enrollment_category);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `php artisan test --filter=BuildEnrollmentAccessContextTest`
Expected: `test_a_stale_stored_category_self_heals_to_the_live_verdict_on_the_ongoing_term` FAILs (stored category stays `'irregular'`, audience stays `Irregular`); the other two pass already (no self-heal exists yet, so they're trivially satisfied — that's fine, they lock in the "don't touch it" behavior for Task 3 to preserve).

- [ ] **Step 3: Implement the self-heal**

Read `app/Actions/Enrollment/BuildEnrollmentAccessContext.php` first. Replace its body:

```php
<?php

namespace App\Actions\Enrollment;

use App\Actions\Academic\ClassifyEnrollmentStanding;
use App\Actions\Academic\ReclassifyStudentEnrollmentCategory;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Enrollment\EnrollmentAccessContext;
use App\Domain\Enrollment\EnrollmentAudience;
use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Enrollment\EnrollmentWindowResolver;
use App\Domain\Identity\UserRole;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\AcademicTermEnrollmentWindow;
use App\Models\StudentProfile;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Resolves all five audience windows for a term in one query, so callers
 * can answer block-access questions without re-reading windows per section.
 *
 * Like `BuildEnrollmentScheduleSummary`, this never writes: a term with no
 * `academic_term_enrollment_windows` rows falls back to the term-wide
 * window in memory. Both actions decide openness through the same pure
 * `EnrollmentWindowResolver`, which is the single definition of the rule.
 *
 * `enrollment_category` self-heals here (spec
 * docs/superpowers/specs/2026-08-19-term-scoped-enrollment-standing-design.md):
 * only for the live `semester_ongoing` term, the freshly computed verdict
 * — not the possibly-stale stored column — decides THIS request's
 * `viewerAudience`, so routing is always correct even if nothing has
 * triggered a write yet. Persisting the fresh value is a secondary,
 * best-effort step via `ReclassifyStudentEnrollmentCategory` (which already
 * guards against no-op writes) attributed to a synthetic system actor, the
 * same pattern `students:reclassify` already uses — if no `registrar_head`
 * user exists to attribute the audit to, the write is skipped, never
 * thrown, since routing already used the live value regardless. Browsing
 * an archived/closed term always uses the stored column as-is.
 */
final class BuildEnrollmentAccessContext
{
    public function __construct(
        private readonly ClassifyEnrollmentStanding $classifier,
        private readonly ReclassifyStudentEnrollmentCategory $reclassifier,
    ) {}

    public function execute(AcademicTerm $term, StudentProfile $student): EnrollmentAccessContext
    {
        $now = CarbonImmutable::now();
        $windows = AcademicTermEnrollmentWindow::query()
            ->where('academic_term_id', $term->id)
            ->get()
            ->keyBy(fn (AcademicTermEnrollmentWindow $window): string => $window->audience->value);

        $openAudiences = [];
        foreach (EnrollmentAudience::cases() as $audience) {
            $window = $windows->get($audience->value);

            $availability = EnrollmentWindowResolver::resolve(
                $term->status,
                $term->enrollment_opens_at,
                $term->enrollment_closes_at,
                $window?->opens_at,
                $window?->closes_at,
                $now,
            );

            if ($availability->isOpen) {
                $openAudiences[] = $audience;
            }
        }

        $enrollmentCategory = $this->liveEnrollmentCategory($term, $student);

        $viewerAudience = EnrollmentAudience::forStudent(
            $enrollmentCategory,
            $student->year_level,
        );

        return new EnrollmentAccessContext(
            $viewerAudience,
            in_array($viewerAudience, $openAudiences, true),
            in_array(EnrollmentAudience::Irregular, $openAudiences, true),
            $openAudiences,
        );
    }

    private function liveEnrollmentCategory(AcademicTerm $term, StudentProfile $student): ?string
    {
        if ($term->status !== AcademicTermStatus::SemesterOngoing) {
            return $student->enrollment_category;
        }

        $verdict = $this->classifier->classify($student, $term);

        if ($verdict === null) {
            return $student->enrollment_category;
        }

        if ($student->enrollment_category !== $verdict->category->value) {
            $this->persistBestEffort($student, $term);
        }

        return $verdict->category->value;
    }

    private function persistBestEffort(StudentProfile $student, AcademicTerm $term): void
    {
        $systemActor = User::query()->where('role', UserRole::RegistrarHead)->first();

        if ($systemActor === null) {
            return;
        }

        $this->reclassifier->execute(
            $student,
            $term,
            $systemActor,
            new AuditRequestContext('enrollment-access-self-heal', null),
        );
    }
}
```

Note: `EnrollmentCategory` import above is unused if not referenced directly — remove it if PHPStan/lint flags it as unused (it isn't referenced in this version; only add the `use` if you end up needing the enum directly).

- [ ] **Step 4: Run the new test**

Run: `php artisan test --filter=BuildEnrollmentAccessContextTest`
Expected: all 3 tests PASS.

- [ ] **Step 5: Run the full existing block/eligible-pool suites and fix the one known fallout**

Run: `php artisan test --filter=EnrollmentBlocksEndpointTest`

Expected: `test_an_irregular_student_receives_an_empty_pool` FAILS — her fixture (`makeBlockSection($term, $plan, 'IT101', 'CS101')` only, `enrollmentCategory: 'irregular'`, no other curriculum subject) now self-heals to Regular, since she fits the one-subject block exactly with no backlog. Fix the fixture so she has a real reason to stay Irregular — a genuine open backlog subject outside the block. Read `tests/Feature/Api/V1/EnrollmentBlocksEndpointTest.php`, find `test_an_irregular_student_receives_an_empty_pool`, and change it to:

```php
    public function test_an_irregular_student_receives_an_empty_pool(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $plan = $this->makePlan($term, $curriculum);
        $this->makeBlockSection($term, $plan, 'IT101', 'CS101');
        // A genuine backlog subject outside the block, with an open
        // section this term — this is what actually makes her Irregular
        // under the term-scoped rule now that BuildEnrollmentAccessContext
        // self-heals on every read.
        $backlog = Subject::create(['code' => 'CS-BACKLOG', 'title' => 'Backlog', 'units' => 3, 'status' => SubjectStatus::Active]);
        CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $backlog->id,
            'year_level' => 1, 'semester' => '1st', 'is_required' => true,
        ]);
        Section::create([
            'academic_term_id' => $term->id, 'subject_id' => $backlog->id, 'section_code' => 'A',
            'capacity' => 40, 'is_block_exclusive' => false, 'status' => SectionStatus::Published,
        ]);
        $student = $this->makeStudent($curriculum, enrollmentCategory: 'irregular');
        $token = $this->tokenFor($student);
        User::create([
            'name' => 'Registrar', 'email' => 'registrar.blockpool@grc.test',
            'password' => self::PASSWORD, 'role' => UserRole::RegistrarHead, 'status' => UserStatus::Active,
        ]);

        $response = $this->withToken($token)->getJson('/api/v1/enrollment-blocks?academic_term_id='.$term->id);

        $response->assertOk();
        $response->assertJsonCount(0, 'data');
    }
```

This requires `SubjectStatus` to already be imported in this file (it is, per its existing `use App\Domain\Curriculum\SubjectStatus;`) — verify before adding a duplicate import.

Run: `php artisan test --filter=EnrollmentBlocksEndpointTest`
Expected: all tests PASS.

Run: `php artisan test --filter=EligibleSubjectsEndpointTest`
Expected: all tests PASS as-is — none of its tests set up a real published `AcademicTermSectionPlan`-backed block, so every self-heal in this file resolves `undetermined` (no block published) and leaves the stored category untouched (verified during design: `makeSection()` in this file never sets `section_plan_id`). If any test unexpectedly fails, apply the same fix pattern as above (add a real, deliberate reason for the stored category to hold under the live rule) — do not weaken the self-heal logic to make a test pass.

Run: `php artisan test --filter=EnrollmentScheduleEndpointTest`
Expected: all tests PASS as-is (same reasoning — no block fixtures in this file).

- [ ] **Step 6: Commit**

```bash
git add app/Actions/Enrollment/BuildEnrollmentAccessContext.php tests/Feature/Actions/Enrollment/BuildEnrollmentAccessContextTest.php tests/Feature/Api/V1/EnrollmentBlocksEndpointTest.php
git commit -m "feat(enrollment): self-heal enrollment_category on every live-term access"
```

---

### Task 4: Delete the old cumulative-lifetime classifier

**Files:**
- Delete: `app/Domain/Enrollment/EnrollmentCategoryClassifier.php`
- Delete: `app/Domain/Enrollment/CurriculumPlacementSlot.php`
- Delete: `tests/Unit/Domain/Enrollment/EnrollmentCategoryClassifierTest.php`
- Modify: `database/seeders/StudentRosterSeeder.php` (docblock references only)

**Interfaces:**
- Consumes: nothing (dead code confirmed via `grep -rn "CurriculumPlacementSlot" app` and `grep -rn "EnrollmentCategoryClassifier" app` returning only these two files plus `ReclassifyStudentEnrollmentCategory.php`, already rewritten in Task 2).
- Produces: nothing new.

- [ ] **Step 1: Confirm nothing else references them**

Run: `grep -rn "EnrollmentCategoryClassifier\|CurriculumPlacementSlot" app tests`
Expected: no matches outside `database/seeders/StudentRosterSeeder.php` (comments only — confirm each hit there is inside a `/** ... */` or `//` comment block, not executable code) and the three files this task deletes.

- [ ] **Step 2: Delete the files**

```bash
git rm app/Domain/Enrollment/EnrollmentCategoryClassifier.php app/Domain/Enrollment/CurriculumPlacementSlot.php tests/Unit/Domain/Enrollment/EnrollmentCategoryClassifierTest.php
```

- [ ] **Step 3: Update the stale docblock references in the seeder**

Open `database/seeders/StudentRosterSeeder.php`. At the four locations found in Step 1 (near lines 113, 729, 742, 846 as of this writing — line numbers may have shifted, search by text instead), replace `EnrollmentCategoryClassifier` with `ClassifyEnrollmentStanding` in the prose, and correct any description of the *old* rule (any blocking mark in a completed semester) to describe the *new* one (a backlog subject with an open section this term, or a standard-block subject already completed early / blocked by an unmet prerequisite) where the comment is explaining the rule's behavior rather than just naming the class. Read each comment in context before editing — some may only need the class name swapped, others may need a sentence rewritten because they describe now-defunct "ordinal"/"completed semester" mechanics.

- [ ] **Step 4: Run the full test suite once, to catch any residual reference**

Run: `php artisan test`
Expected: no `Class not found` errors referencing the deleted classes. (Other failures are expected and handled in Task 5.)

- [ ] **Step 5: Commit**

```bash
git add app/Domain/Enrollment/EnrollmentCategoryClassifier.php app/Domain/Enrollment/CurriculumPlacementSlot.php tests/Unit/Domain/Enrollment/EnrollmentCategoryClassifierTest.php database/seeders/StudentRosterSeeder.php
git commit -m "chore(enrollment): remove the superseded cumulative-lifetime classifier"
```

---

### Task 5: Reconcile `StudentRosterSeederTest`, `DemoEnrollmentSeederTest`, and `AutomationStepsTest`/`AutomationRunsEndpointTest`

**Controller ruling (recorded after Task 2's review):** Task 2's full-suite run surfaced two more production call sites of `ReclassifyStudentEnrollmentCategory` this plan's original pre-flight scan did not name — `database/seeders/DemoEnrollmentSeeder.php:650` (`app(ReclassifyStudentEnrollmentCategory::class)->executeMany(...)`, same pattern as `StudentRosterSeeder.php:961`) and `app/Actions/ItControl/RunStudentsAutoEnroll.php:26,55` (constructor-injects it and branches auto-enrollment behavior on `$student->enrollment_category === EnrollmentCategory::Regular->value`). Both have tests whose assertions are calibrated to the old cumulative-lifetime algorithm's specific output, exactly like `StudentRosterSeederTest` — confirmed via reading each failure's actual assertion diff in a full-suite run (`DemoEnrollmentSeederTest`: `Failed asserting that null is identical to 'regular'` on `$profile->enrollment_category`; `AutomationStepsTest`: expected `AutomationRunStatus::Succeeded`/`Partial`, got `Failed`). This task's scope is expanded to reconcile all three files in one pass — same root cause, same fix pattern, no new production code changes needed anywhere.

**Files:**
- Modify: `tests/Feature/Database/StudentRosterSeederTest.php`
- Modify: `tests/Feature/Database/DemoEnrollmentSeederTest.php`
- Modify: `tests/Feature/Actions/ItControl/AutomationStepsTest.php`
- Modify: `tests/Feature/Api/V1/ItControl/AutomationRunsEndpointTest.php`
- Possibly modify: whatever fixture path(s) `irregularFixturePath()` points to (find via `grep -n "irregularFixturePath" tests/Feature/Database/StudentRosterSeederTest.php`), if the roster needs backlog-subject sections added to produce a meaningful Irregular population under the new rule.

**Interfaces:**
- Consumes: `ReclassifyStudentEnrollmentCategory` (Task 2) transitively via `StudentRosterSeeder`'s, `DemoEnrollmentSeeder`'s, and `RunStudentsAutoEnroll`'s own calls to it — no code changes to any of these three production files, only their tests' expectations.

This task is inherently exploratory — the affected tests encode statistical/output assumptions calibrated to the *old* rule, and the correct new assertions can only be determined by running the code against the new algorithm and observing what it actually produces — the same way the original `~10%` threshold in `StudentRosterSeederTest` was itself empirically derived (its own comment says so). Work `StudentRosterSeederTest` first (Steps 1-4 below, unchanged from the original plan), then apply the same read-diagnose-fix-verify method to `DemoEnrollmentSeederTest` and `AutomationStepsTest`/`AutomationRunsEndpointTest` (Step 4a) before the final full-file commit.

- [ ] **Step 1: Run the file and observe current behavior**

Run: `php artisan test --filter=StudentRosterSeederTest`

Read every failure. For `test_roughly_a_tenth_of_students_are_derived_as_irregular` and `test_no_first_year_student_is_irregular`, note the actual computed `irregular` count and percentage the failure message reports.

- [ ] **Step 2: Diagnose why the percentage moved**

Open `database/seeders/Fixtures` (or wherever `irregularFixturePath()`/`fixturePath()` resolve to — find with `grep -n "irregularFixturePath\|fixturePath" tests/Feature/Database/StudentRosterSeederTest.php`) and check whether it creates `Section`/`AcademicTermSectionPlan` rows for the students' *current* term matching their `(curriculum_id, year_level)` the same way `EnrollmentBlocksEndpointTest`'s `makeBlockSection()` does. Under the new rule:
  - A student with **no block published** for their year level this term now reads as `undetermined` and keeps whatever `enrollment_category` they started with (likely `null`, which `reclassifyAllStudents()`'s bulk write may or may not touch — check what `reclassifyAllStudents()` does with a `null` starting value here).
  - A student **with** a block but with old blocking marks (`5.00`/`INC`/`NC`/`DRP`) on subjects that are **not this term's standard set and have no open backlog section** now reads as Regular, not Irregular — this is the exact behavior change this whole project exists to make.

- [ ] **Step 3: Fix the fixture and/or the assertions**

If the fixture already sets up realistic current-term block+backlog sections (matching real production data, as confirmed live in the DB during design — `Section::where('academic_term_id', 11)->count()` returned 902 real block sections), the ~10% figure may simply shift under the new rule — read the actual number from Step 1 and update the threshold bounds in `test_roughly_a_tenth_of_students_are_derived_as_irregular` to bracket the new actual percentage (keep the same *style* of assertion — a generous ± range, not an exact number).

If the fixture does **not** create current-term backlog sections for the students it intends to be Irregular, add them (mirroring the `makeBlockSection`/plain-`Section` pattern from Task 1-3's tests) so the fixture's *intent* (some students have real, actionable backlog) is expressible under the new rule, rather than loosening the assertion to accept a degenerate near-zero result.

For `test_every_irregular_student_has_grade_evidence`, its current assertion (every Irregular student has *some* locked grade in `['5.00','INC','NC','DRP']`) is no longer sufficient on its own — a student can now be Irregular purely from an unmet prerequisite on a standard-block subject with no such mark anywhere, or Regular *despite* having such a mark (if the affected subject isn't offered this term). Rewrite this test's assertion to match what "irregular" now means: either (a) has a locked grade in `['5.00','INC','NC','DRP']` on a subject that also has an open section this term outside their current block, or (b) has an unmet prerequisite blocking a standard-block subject. Prefer asserting via `app(ClassifyEnrollmentStanding::class)->classify($student, $currentTerm)->reasons` directly (one `needs_adding_backlog` or `needs_removing_*` reason per affected student) rather than re-deriving the grade-mark check by hand — this keeps the test from silently drifting out of sync with the real rule again.

- [ ] **Step 4: Run again to confirm green**

Run: `php artisan test --filter=StudentRosterSeederTest`
Expected: all tests PASS.

- [ ] **Step 4a: Reconcile `DemoEnrollmentSeederTest` and `AutomationStepsTest`/`AutomationRunsEndpointTest`**

Same method as Steps 1-3, applied to the other two newly-discovered consumers:

*`DemoEnrollmentSeederTest`:* Run `php artisan test --filter=DemoEnrollmentSeederTest`. Read every failure — expect assertions like `self::assertSame($category, $profile->enrollment_category)` failing because the seeded fixture's hardcoded expected category no longer matches what the new term-scoped rule derives for that student (the fixture likely encodes each demo student's *intended* category as a literal string next to their grade data — find this in `database/seeders/DemoEnrollmentSeeder.php`). For each mismatch: read what block/backlog sections exist for that student's `(curriculum_id, year_level)` in whatever term the seeder treats as current, and confirm by hand (or via `app(ClassifyEnrollmentStanding::class)->classify($student, $term)->reasons`) what the *correct* category is under the new rule. If the demo fixture's intent was "this student should be a clear-cut Irregular example," and the new rule says Regular only because their backlog subject isn't offered this term, adjust the fixture (add an open section for their backlog subject in the demo term) rather than the assertion — the demo data's job is to be a believable illustrative example, not to encode the old algorithm's quirks. If the intent was more incidental (just "some regular, some irregular" filler), update the expected-category literal in the fixture to match the new, correct computation instead.

*`AutomationStepsTest` / `AutomationRunsEndpointTest`:* Run `php artisan test --filter="AutomationStepsTest|AutomationRunsEndpointTest"`. These test `RunStudentsAutoEnroll`'s pipeline, which branches on `$student->enrollment_category === EnrollmentCategory::Regular->value` (`app/Actions/ItControl/RunStudentsAutoEnroll.php:55`). A run now reports `AutomationRunStatus::Failed` where it used to report `Succeeded`/`Partial` because the students in these tests' fixtures no longer classify the way the old rule classified them, so the auto-enroll step attempts an enrollment path that doesn't fit their new category and fails. Read each failing test's fixture setup (find the students' curriculum/year-level/grade setup near the top of the test method) and either (a) add the block/backlog section data needed so the fixture's intended category (Regular for a "happy path" auto-enroll test, or Irregular where the test is specifically about the irregular path) actually holds under the new rule, or (b) if a test was specifically exercising an edge case tied to the old algorithm's semantics that no longer exists (e.g. "a student with an old failing grade auto-enrolls into the irregular path"), rewrite it to exercise the equivalent new-rule scenario (e.g. "a student with an open backlog subject this term auto-enrolls into the irregular path") — do not just loosen the assertion to accept `Failed`.

Run both filters again to confirm green before moving on.

- [ ] **Step 5: Commit**

```bash
git add tests/Feature/Database/StudentRosterSeederTest.php tests/Feature/Database/DemoEnrollmentSeederTest.php tests/Feature/Actions/ItControl/AutomationStepsTest.php tests/Feature/Api/V1/ItControl/AutomationRunsEndpointTest.php
# plus any fixture file(s) touched in Step 3/4a — check `git status` for the exact path(s)
git commit -m "test(seeder,automation): reconcile category-dependent assertions with the term-scoped rule"
```

---

### Task 6: Full suite, dead-code sweep, and live verification against Socorro's real data

**Files:** none new — this is verification only, touching whatever the full suite reveals.

- [ ] **Step 1: Run the entire backend test suite**

Run: `php artisan test`

**Known pre-existing, out-of-scope failures (confirmed during Task 2's review, unrelated to this plan — do not attempt to fix):** `DeriveSectionDemandObservationsTest` (5, an unconditional "no registrar_head seeded" guard in `StudentRosterSeeder.php` unrelated to the classification algorithm), `CurriculumAuditTest` (4, `AuthorizationException` from an unrelated policy check), `AnalyticsSubstrateMigrationTest` (3), `FacultyInputAuditTest` (3), `AuditVocabularyTest` (2), `CurriculumVersioningMigrationTest` (2), `ProgramVisibilityTest` (1), `GrcSubjectCatalogSeederCurriculumIntegrationTest` (1), `FacultyInputMigrationTest` (1), `FacultyAvailabilityTermIndependenceMigrationTest` (1), `CurriculumScheduleReferenceMigrationTest` (1), `ApiSurfaceTest` (1), `SectionAuditTest` (1) — 26 total, all snapshot/schema/route/authorization drift from other unrelated in-flight work already sitting in this repo, verified via each failure's actual assertion diff before Task 5 was scoped. If the actual run shows a different set of failures than this list, treat any new/different failure as a real regression to investigate (Task 2/3's own changes could theoretically interact with something), but do not spend time re-litigating this already-confirmed list.

Fix any remaining failure NOT on the list above using the same method as Task 3 Step 5 and Task 5: read the failure, determine whether it's (a) a fixture that needs a real block/backlog reason for its expected category (fix the fixture, matching the established pattern), or (b) a genuine bug in `ClassifyEnrollmentStanding`/`ReclassifyStudentEnrollmentCategory`/`BuildEnrollmentAccessContext` (fix the implementation, add a regression test in the relevant Task 1/2/3 test file). Do not weaken an assertion just to make it pass — the fixture or the implementation is wrong, not the check.

Expected end state: `php artisan test` exits 0 except for the 26 known-pre-existing failures listed above, which are explicitly out of this plan's scope — note their continued presence in your report rather than silently ignoring them.

- [ ] **Step 2: Static analysis / lint, if configured**

Run: `composer analyse` or `vendor/bin/phpstan analyse` (check `composer.json` `scripts` section for the exact configured command name first — use whichever this project actually defines). Fix any new errors the rewritten files introduce (in particular, confirm no leftover references to the deleted `EnrollmentCategoryClassifier`/`CurriculumPlacementSlot`, and that `ClassifyEnrollmentStanding`'s `?ClassificationVerdict` nullability is handled at every call site PHPStan can see).

- [ ] **Step 3: Verify the real Socorro case against the live database**

This is the acceptance test for the entire project — the bug report that started it. Run:

```bash
php artisan students:reclassify --student=2024-06-01611 --dry-run
```

Expected output: a line showing her transitioning `irregular -> regular` (or, if `--dry-run` output only reports actual `execute()`-style changes, confirm via tinker instead — see below). Then run for real:

```bash
php artisan students:reclassify --student=2024-06-01611
```

Then confirm via tinker:

```bash
php artisan tinker --execute="
\$sp = App\Models\StudentProfile::where('student_number', '2024-06-01611')->first();
echo 'enrollment_category: '.\$sp->enrollment_category.PHP_EOL;
\$term = App\Models\AcademicTerm::where('status', App\Domain\Organization\AcademicTermStatus::SemesterOngoing)->first();
\$verdict = app(App\Actions\Academic\ClassifyEnrollmentStanding::class)->classify(\$sp, \$term);
echo 'live verdict: '.(\$verdict === null ? 'undetermined' : \$verdict->category->value).PHP_EOL;
foreach ((\$verdict->reasons ?? []) as \$r) echo '  reason: '.\$r['code'].' - '.\$r['message'].PHP_EOL;
"
```

Expected: `enrollment_category: regular`, `live verdict: regular`, no reasons printed — confirming she is Regular this term because her ITC/ITCL/ITP1 backlog isn't offered in the current (2nd semester) term, exactly as diagnosed. If this does **not** hold, treat it as a real failure of the implementation (not a fixture issue, since this is live production-shaped data) — return to Task 1/2 and re-diagnose using the same tinker-based investigation technique used during design (query her real locked grades, the real `Section`/`AcademicTermSectionPlan` rows for `curriculum_id=13, year_level=3, academic_term_id=11`, and step through `ClassifyEnrollmentStanding::classify()` by hand against that data).

- [ ] **Step 4: Regenerate the Irregular Students report and spot-check**

```bash
php artisan students:generate-irregular-report
```

Confirm Socorro Y. Amurao (`2024-06-01611`) no longer appears in the regenerated `Subject And Prerequisuite/Irregular-Students.md`, and that the total irregular count changed sensibly (not to zero, not unchanged — some genuine backlog-with-open-section cases should remain).

- [ ] **Step 5: Final report to the user**

No commit in this step (verification only) unless Step 1-2 required fixes, in which case those are already committed per their own tasks. Summarize for the user: what changed, the before/after for Socorro specifically, and that the regenerated report is ready to review.
