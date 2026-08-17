# Student Section Selection Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Schedule Preference feature from the student enrollment experience (both regular and irregular flows) and let irregular students fill a non-major (shared) subject from another department's open section, presented in a new per-subject selection table with a Remove action.

**Architecture:** `BuildEligibleSubjectPool` widens its section query from the placement's own `subject_id` to every `subjects` row sharing its `code`+`units` (its "siblings" across colleges), and `EligibleSubjectResource` tags each returned section with `college`/`is_own_department`. The frontend deletes the whole Schedule Preference stack (component, hook, service, schema) and the shared `ApplyPreferencesSwitch`, and replaces the irregular flow's per-subject card grid with a new `EligibleSubjectTable` that renders a `DataTable` row per subject with a manual section picker, a College badge for cross-department picks, and a session-local Remove/Show toggle.

**Tech Stack:** Laravel 12, PHP 8.4, Eloquent, PHPUnit; Next.js 16, React 19, TypeScript, Zod, TanStack Query, Tailwind CSS, shadcn/ui (Radix), Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-17-student-section-selection-redesign-design.md`

## Global Constraints

- Remove Schedule Preference from both the regular and irregular student flows. Backend storage (`StudentSchedulePreference` model/API/`SchedulePreferenceScorer`) is left untouched and simply becomes unused.
- Cross-department section sourcing applies only to subjects sharing the same `code` and `units` across colleges (their "siblings"); a subject with no sibling row (a major) is unaffected.
- Do not modify the shared `SectionResource` or the shared `sectionSchema` — the `college`/`is_own_department` fields are added only to the eligible-subject-specific resource output and schema.
- Removing a subject from the irregular table is a client-side, session-local visibility action only; it never persists, and never affects eligibility or submission.
- Do not change the regular (block) student flow beyond removing its Schedule Preference panel — its inline block-selection cards are otherwise unchanged.
- Do not generate or publish any missing section plans — that gap (4 third-year programs with none generated this term) is a Registrar/Dean/Program Chair workflow action, out of scope here.
- Do not commit or push until the user explicitly requests a GitHub saving point.

---

### Task 1: Remove Schedule Preference from the frontend

**Files:**
- Delete: `frontend/src/features/components/portal/student-schedule-preferences-panel.tsx`
- Delete: `frontend/src/features/components/portal/student-schedule-preferences-panel.test.tsx`
- Delete: `frontend/src/features/components/portal/apply-preferences-switch.tsx`
- Delete: `frontend/src/features/hooks/use-student-schedule-preference.ts`
- Delete: `frontend/src/features/services/student-schedule-preference-service.ts`
- Delete: `frontend/src/features/schemas/student-schedule-preference-schema.ts`
- Modify: `frontend/src/features/components/portal/enrollment-workspace.tsx`
- Modify: `frontend/src/features/components/portal/enrollment-section-table.tsx`
- Modify: `frontend/src/features/components/portal/enrollment-subject-filter-bar.tsx`
- Test: `frontend/src/features/components/portal/enrollment-workspace.test.tsx`
- Test: `frontend/src/features/components/portal/enrollment-section-table.test.tsx`
- Test: `frontend/src/features/components/portal/enrollment-subject-filter-bar.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `EnrollmentSectionTable` and `EnrollmentSubjectFilterBar` with unchanged public props (no `applyPreferences` state ever existed in their prop signatures — this was internal state, so no signature change).

- [ ] **Step 1: Delete the Schedule Preference files**

```bash
git rm frontend/src/features/components/portal/student-schedule-preferences-panel.tsx
git rm frontend/src/features/components/portal/student-schedule-preferences-panel.test.tsx
git rm frontend/src/features/components/portal/apply-preferences-switch.tsx
git rm frontend/src/features/hooks/use-student-schedule-preference.ts
git rm frontend/src/features/services/student-schedule-preference-service.ts
git rm frontend/src/features/schemas/student-schedule-preference-schema.ts
```

- [ ] **Step 2: Remove the preference toggle and sort from `EnrollmentSectionTable`**

In `frontend/src/features/components/portal/enrollment-section-table.tsx`, replace:

```tsx
import type { ReactNode } from "react"
import { useState } from "react"

import { ApplyPreferencesSwitch } from "@/features/components/portal/apply-preferences-switch"
import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
```

with:

```tsx
import type { ReactNode } from "react"

import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
```

Replace:

```tsx
/**
 * Regular-student block selection. Every available block now exposes its full
 * subject schedule inline, so choosing a section never requires a picker
 * modal. Preferences can still rank the visible pool but never remove a
 * section from it.
 */
```

with:

```tsx
/**
 * Regular-student block selection. Every available block now exposes its full
 * subject schedule inline, so choosing a section never requires a picker
 * modal.
 */
```

Replace:

```tsx
  const [applyPreferences, setApplyPreferences] = useState(false)
  const selectedBlock = blocks.find(
    (block) => block.block_code === selectedBlockCode,
  )
  const rows = applyPreferences
    ? [...blocks].sort(
        (a, b) =>
          (b.preference_score ?? Number.NEGATIVE_INFINITY) -
          (a.preference_score ?? Number.NEGATIVE_INFINITY),
      )
    : blocks

  if (selectedBlock) {
```

with:

```tsx
  const selectedBlock = blocks.find(
    (block) => block.block_code === selectedBlockCode,
  )

  if (selectedBlock) {
```

Replace:

```tsx
  return (
    <div className="grid gap-4">
      <ApplyPreferencesSwitch
        id="enrollment-section-table-apply-preferences"
        checked={applyPreferences}
        onCheckedChange={setApplyPreferences}
      />
      {rows.map((block) => (
```

with:

```tsx
  return (
    <div className="grid gap-4">
      {blocks.map((block) => (
```

- [ ] **Step 3: Remove the "sorts by preference match" test**

In `frontend/src/features/components/portal/enrollment-section-table.test.tsx`, delete this whole test:

```tsx
  it("sorts by preference match when preferences are applied without removing a section", async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(
      screen.getByRole("switch", { name: "Apply my preferences" }),
    )

    const sections = screen.getAllByRole("article")
    expect(sections[0]).toHaveAccessibleName("IT303 section")
    expect(
      screen.getByRole("article", { name: "IT301 section" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("article", { name: "IT302 section" }),
    ).toBeInTheDocument()
  })

```

- [ ] **Step 4: Remove the preference toggle and sort from `EnrollmentSubjectFilterBar`**

In `frontend/src/features/components/portal/enrollment-subject-filter-bar.tsx`, replace:

```tsx
import { useState, type ReactNode } from "react"

import { ApplyPreferencesSwitch } from "@/features/components/portal/apply-preferences-switch"
import { StatusRegion } from "@/features/components/portal/status-region"
```

with:

```tsx
import { useState, type ReactNode } from "react"

import { StatusRegion } from "@/features/components/portal/status-region"
```

Replace:

```tsx
/**
 * Client-side filters (Day, Time block, Professor, Subject search) plus the
 * "Apply my preferences" sort, over an already-fetched eligible-subject
 * pool — the irregular-student per-subject flow in `enrollment-workspace.tsx`.
 * Everything here operates on the `subjects` prop already sitting in the
 * parent's query cache; no filter or sort ever issues a new request.
 *
 * "Apply my preferences" sorts the subject list by its own `preference_score`
 * (the pool only scores a subject as a whole against its available sections,
 * not per individual section — see `BuildEligibleSubjectPool`). Like the
 * regular-student table, this only reorders: a subject with no score, or a
 * low one, is never removed (preferences rank, they never gate).
 */
```

with:

```tsx
/**
 * Client-side filters (Day, Time block, Professor, Subject search) over an
 * already-fetched eligible-subject pool — the irregular-student per-subject
 * flow in `enrollment-workspace.tsx`. Everything here operates on the
 * `subjects` prop already sitting in the parent's query cache; no filter
 * ever issues a new request.
 */
```

Replace:

```tsx
  const [search, setSearch] = useState("")
  const [day, setDay] = useState(ALL_FILTER_VALUE)
  const [timeBlock, setTimeBlock] = useState(ALL_FILTER_VALUE)
  const [professorId, setProfessorId] = useState(ALL_FILTER_VALUE)
  const [applyPreferences, setApplyPreferences] = useState(false)

  const filtered = subjects.filter(
    (subject) =>
      matchesSearch(subject, search) &&
      matchesDay(subject, day) &&
      matchesTimeBlock(subject, timeBlock) &&
      matchesProfessor(subject, professorId),
  )

  const visible = applyPreferences
    ? [...filtered].sort(
        (a, b) =>
          (b.preference_score ?? Number.NEGATIVE_INFINITY) -
          (a.preference_score ?? Number.NEGATIVE_INFINITY),
      )
    : filtered

  return (
```

with:

```tsx
  const [search, setSearch] = useState("")
  const [day, setDay] = useState(ALL_FILTER_VALUE)
  const [timeBlock, setTimeBlock] = useState(ALL_FILTER_VALUE)
  const [professorId, setProfessorId] = useState(ALL_FILTER_VALUE)

  const visible = subjects.filter(
    (subject) =>
      matchesSearch(subject, search) &&
      matchesDay(subject, day) &&
      matchesTimeBlock(subject, timeBlock) &&
      matchesProfessor(subject, professorId),
  )

  return (
```

Replace:

```tsx
      <ApplyPreferencesSwitch
        id="eligible-subject-apply-preferences"
        checked={applyPreferences}
        onCheckedChange={setApplyPreferences}
      />

      <StatusRegion
```

with:

```tsx
      <StatusRegion
```

- [ ] **Step 5: Remove the "sorts by preference score" test**

In `frontend/src/features/components/portal/enrollment-subject-filter-bar.test.tsx`, delete this whole test:

```tsx
  it("sorts by preference score when applied, without hiding a low- or unscored subject", async () => {
    const user = userEvent.setup()
    const low = subject({ subject_id: 1, code: "IT100", preference_score: 10 })
    const unscored = subject({ subject_id: 2, code: "IT200", preference_score: null })
    const high = subject({ subject_id: 3, code: "IT300", preference_score: 90 })
    renderBar([low, unscored, high])

    await user.click(
      screen.getByRole("switch", { name: "Apply my preferences" }),
    )

    const items = screen.getAllByRole("listitem")
    expect(items.map((item) => item.textContent)).toEqual([
      "IT300",
      "IT100",
      "IT200",
    ])
    expect(screen.getByText("IT200")).toBeInTheDocument()
  })

```

- [ ] **Step 6: Remove the panel from `EnrollmentWorkspace`**

In `frontend/src/features/components/portal/enrollment-workspace.tsx`, replace:

```tsx
import { StaggerItem, StaggerList } from "@/features/components/portal/motion"
import { StudentSchedulePreferencesPanel } from "@/features/components/portal/student-schedule-preferences-panel"
import {
  StatusStepper,
```

with:

```tsx
import { StaggerItem, StaggerList } from "@/features/components/portal/motion"
import {
  StatusStepper,
```

Replace:

```tsx
          <div className="grid gap-4">
            <StudentSchedulePreferencesPanel compact />
            <AsyncBoundary
```

with:

```tsx
          <div className="grid gap-4">
            <AsyncBoundary
```

Replace:

```tsx
          <div className="grid gap-4">
            <StudentSchedulePreferencesPanel />
            <AsyncBoundary
```

with:

```tsx
          <div className="grid gap-4">
            <AsyncBoundary
```

- [ ] **Step 7: Remove Schedule Preference route mocks and update assertions in `enrollment-workspace.test.tsx`**

Remove the `/student-schedule-preferences` branch from `mockIrregularRoutes`:

```tsx
    if (target.endsWith("/student-schedule-preferences"))
      return Promise.resolve(
        new Response(JSON.stringify({ data: defaultSchedulePreference })),
      )
```

Remove the same branch from `mockRegularRoutes` (identical text, appears a second time in the file).

Remove the now-unused `defaultSchedulePreference` constant:

```tsx
const defaultSchedulePreference = {
  type: "student-schedule-preference",
  id: null,
  student_id: 1,
  preferred_days: null,
  preferred_time_block: "any",
  preferred_time_block_label: "No Preference",
  preferred_modality: null,
  max_days_on_campus: null,
  avoid_early_first_class: false,
  notes: null,
}

```

In the test `"a regular student selects an inline section, confirms, and submits"`, replace:

```tsx
    expect(await screen.findByText("Preferred days")).toBeInTheDocument()
    expect(screen.getByLabelText("Maximum days on campus")).toBeInTheDocument()
    expect(
      screen.queryByLabelText("Preferred time block"),
    ).not.toBeInTheDocument()

    const section = await screen.findByRole("article", {
      name: "IT201 section",
    })
```

with:

```tsx
    const section = await screen.findByRole("article", {
      name: "IT201 section",
    })
    expect(screen.queryByText("Schedule preference")).not.toBeInTheDocument()
```

Replace the test `"loads the schedule preference panel for an irregular student"`:

```tsx
  it("loads the schedule preference panel for an irregular student", async () => {
    fetchMock.mockImplementation(mockIrregularRoutes())
    renderWithSession(<EnrollmentWorkspace />, {
      session: irregularStudentSession,
    })

    expect(
      await screen.findByRole("checkbox", { name: "Monday" }),
    ).toBeInTheDocument()
  })
```

with:

```tsx
  it("does not render schedule preference for an irregular student", async () => {
    fetchMock.mockImplementation(mockIrregularRoutes())
    renderWithSession(<EnrollmentWorkspace />, {
      session: irregularStudentSession,
    })

    await screen.findByRole("heading", { name: /eligible subjects/i })
    expect(screen.queryByText("Schedule preference")).not.toBeInTheDocument()
  })
```

Delete the last test in the file, `"sorts the irregular subject pool by preference score when applied, keeping every subject selectable"`:

```tsx

  it("sorts the irregular subject pool by preference score when applied, keeping every subject selectable", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(mockIrregularRoutes())
    renderWithSession(<EnrollmentWorkspace />, {
      session: irregularStudentSession,
    })

    await screen.findByRole("heading", { name: /eligible subjects/i })
    await user.click(
      screen.getByRole("switch", { name: "Apply my preferences" }),
    )

    const articles = screen.getAllByRole("article")
    // IT 205 scores 90, IT 305 scores 40 -- highest preference_score first,
    // but both remain present and their Section selects stay enabled.
    expect(articles[0]).toHaveAccessibleName(/IT 205/)
    expect(articles[1]).toHaveAccessibleName(/IT 305/)
    for (const article of articles) {
      expect(within(article).getByLabelText("Section")).toBeEnabled()
    }
  })
```

(Leave the file ending with the closing `})` of the `describe` block right after the previous test.)

- [ ] **Step 8: Run the affected test files**

Run: `npm test -- --run src/features/components/portal/enrollment-workspace.test.tsx src/features/components/portal/enrollment-section-table.test.tsx src/features/components/portal/enrollment-subject-filter-bar.test.tsx`

Expected: PASS. (The remaining `getByLabelText("Section")` assertions in `enrollment-workspace.test.tsx` still pass here — `SectionChoice` itself is untouched until Task 5.)

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/components/portal/enrollment-workspace.tsx frontend/src/features/components/portal/enrollment-workspace.test.tsx frontend/src/features/components/portal/enrollment-section-table.tsx frontend/src/features/components/portal/enrollment-section-table.test.tsx frontend/src/features/components/portal/enrollment-subject-filter-bar.tsx frontend/src/features/components/portal/enrollment-subject-filter-bar.test.tsx
git commit -m "feat(enrollment): remove schedule preference from student flows"
```

---

### Task 2: Backend — cross-department eligibility for shared subjects

**Files:**
- Modify: `backend/app/Actions/Enrollment/BuildEligibleSubjectPool.php`
- Modify: `backend/app/Http/Resources/Api/V1/EligibleSubjectResource.php`
- Modify: `backend/tests/Feature/Api/V1/EligibleSubjectsEndpointTest.php`

**Interfaces:**
- Consumes: `Subject::code`, `Subject::units`, `Subject::college` (existing model fields).
- Produces: `EligibleSubjectResource`'s `available_sections[].college: ?string` and `available_sections[].is_own_department: bool`, additive to the existing per-section shape.

- [ ] **Step 1: Write failing tests for cross-department sourcing**

In `backend/tests/Feature/Api/V1/EligibleSubjectsEndpointTest.php`, change the `makeSubject` helper to accept an optional college:

```php
    private function makeSubject(string $code, float $units = 3.0, ?string $college = null): Subject
    {
        return Subject::create(['code' => $code, 'college' => $college, 'title' => $code.' Title', 'units' => $units, 'status' => SubjectStatus::Active]);
    }
```

Add these four tests, right before the final closing `}` of the class:

```php
    public function test_a_shared_subject_pulls_in_another_colleges_open_section(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownSubject = $this->makeSubject('RIZAL', 3.0, 'ccs');
        $this->placeSubject($curriculum, $ownSubject);
        // The student's own college has no open section for RIZAL, but
        // another college's identical (same code + units) RIZAL row does.
        $otherSubject = $this->makeSubject('RIZAL', 3.0, 'coe');
        $otherSection = $this->makeSection($term, $otherSubject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', true);
        $response->assertJsonCount(1, 'data.0.available_sections');
        $response->assertJsonPath('data.0.available_sections.0.id', $otherSection->id);
        $response->assertJsonPath('data.0.available_sections.0.is_own_department', false);
        $response->assertJsonPath('data.0.available_sections.0.college', 'coe');
    }

    public function test_a_subject_with_a_different_code_in_another_college_is_not_pulled_in(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownSubject = $this->makeSubject('CS101', 3.0, 'ccs');
        $this->placeSubject($curriculum, $ownSubject);
        // A different code entirely -- never a sibling, no matter the units.
        $unrelatedSubject = $this->makeSubject('CS999', 3.0, 'coe');
        $this->makeSection($term, $unrelatedSubject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'no_sections_available');
    }

    public function test_a_same_code_subject_with_different_units_is_not_treated_as_the_same_subject(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownSubject = $this->makeSubject('RIZAL', 3.0, 'ccs');
        $this->placeSubject($curriculum, $ownSubject);
        // Same code, but a different unit count -- a coincidence, not the
        // same course, so it must not be pulled in.
        $mismatchedSubject = $this->makeSubject('RIZAL', 5.0, 'coe');
        $this->makeSection($term, $mismatchedSubject);
        $student = $this->makeStudent($curriculum);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'no_sections_available');
    }

    public function test_already_selected_via_a_sibling_departments_section_excludes_the_subject(): void
    {
        $term = $this->makeTerm();
        $curriculum = $this->makeCurriculum();
        $ownSubject = $this->makeSubject('RIZAL', 3.0, 'ccs');
        $this->placeSubject($curriculum, $ownSubject);
        $otherSubject = $this->makeSubject('RIZAL', 3.0, 'coe');
        $otherSection = $this->makeSection($term, $otherSubject);
        $student = $this->makeStudent($curriculum);

        $enrollment = Enrollment::create([
            'student_id' => $student->id, 'academic_term_id' => $term->id, 'status' => EnrollmentStatus::Draft,
        ]);
        EnrollmentSubject::create([
            'enrollment_id' => $enrollment->id, 'section_id' => $otherSection->id, 'status' => EnrollmentSubjectStatus::Selected,
        ]);
        $token = $this->tokenFor($student);

        $response = $this->withToken($token)->getJson('/api/v1/eligible-subjects?academic_term_id='.$term->id);

        $response->assertJsonPath('data.0.is_eligible', false);
        $response->assertJsonPath('data.0.reasons.0.code', 'already_selected');
    }
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `php artisan test --filter=EligibleSubjectsEndpointTest`

Expected: FAIL — the four new tests fail (own-college-only sourcing means the shared-subject and already-selected-via-sibling cases don't behave as asserted; `college`/`is_own_department` keys don't exist yet in the JSON).

- [ ] **Step 3: Widen section sourcing and fix the already-selected check in `BuildEligibleSubjectPool`**

Add the `Subject` import:

```php
use App\Models\StudentProfile;
use App\Models\StudentSchedulePreference;
```

becomes:

```php
use App\Models\StudentProfile;
use App\Models\StudentSchedulePreference;
use App\Models\Subject;
```

Replace:

```php
        /** @var list<array{code: string, message: string}> $reasons */
        $reasons = [];
        $excluded = false;

        $ownGrade = $this->latestLockedGrade($student->id, $placement->subject_id);
        if (isset($creditedSubjectIds[$placement->subject_id])) {
            $reasons[] = ['code' => 'completed', 'message' => 'This subject was credited from the student\'s prior curriculum.'];
            $excluded = true;
        } elseif ($this->verdictFor($ownGrade, (string) config('enrollment.grading.passing_grade'))->isSatisfied()) {
            $reasons[] = ['code' => 'completed', 'message' => 'This subject has already been completed with a passing grade.'];
            $excluded = true;
        }

        if ($this->isAlreadySelectedThisTerm($student->id, $term->id, $placement->subject_id)) {
            $reasons[] = ['code' => 'already_selected', 'message' => 'This subject is already part of your current enrollment for this term.'];
            $excluded = true;
        }
```

with:

```php
        /** @var list<array{code: string, message: string}> $reasons */
        $reasons = [];
        $excluded = false;

        // Every `subjects` row sharing this subject's code and units is the
        // same course offered under a different college -- general-education
        // subjects (RIZAL, NSTP, PATHFIT, ...) are duplicated one row per
        // college, while a major subject has no such sibling. Sourcing
        // sections from the whole sibling set is what lets a student fill a
        // shared subject from another department's open section.
        $siblingSubjectIds = Subject::query()
            ->where('code', $placement->subject->code)
            ->where('units', $placement->subject->units)
            ->pluck('id')
            ->all();

        $ownGrade = $this->latestLockedGrade($student->id, $placement->subject_id);
        if (isset($creditedSubjectIds[$placement->subject_id])) {
            $reasons[] = ['code' => 'completed', 'message' => 'This subject was credited from the student\'s prior curriculum.'];
            $excluded = true;
        } elseif ($this->verdictFor($ownGrade, (string) config('enrollment.grading.passing_grade'))->isSatisfied()) {
            $reasons[] = ['code' => 'completed', 'message' => 'This subject has already been completed with a passing grade.'];
            $excluded = true;
        }

        if ($this->isAlreadySelectedThisTerm($student->id, $term->id, $siblingSubjectIds)) {
            $reasons[] = ['code' => 'already_selected', 'message' => 'This subject is already part of your current enrollment for this term.'];
            $excluded = true;
        }
```

Replace:

```php
        if (! $excluded) {
            $sectionsThisTerm = Section::query()
                ->where('academic_term_id', $term->id)
                ->where('subject_id', $placement->subject_id)
                ->with('sectionPlan')
                ->get();
```

with:

```php
        if (! $excluded) {
            $sectionsThisTerm = Section::query()
                ->where('academic_term_id', $term->id)
                ->whereIn('subject_id', $siblingSubjectIds)
                ->with(['sectionPlan', 'subject'])
                ->get();
```

Replace the `isAlreadySelectedThisTerm` method:

```php
    private function isAlreadySelectedThisTerm(int $studentId, int $academicTermId, int $subjectId): bool
    {
        return EnrollmentSubject::query()
            ->whereHas(
                'enrollment',
                fn ($query) => $query
                    ->where('student_id', $studentId)
                    ->where('academic_term_id', $academicTermId)
                    ->whereNotIn('status', EnrollmentStatus::terminalValues()),
            )
            ->whereHas('section', fn ($query) => $query->where('subject_id', $subjectId))
            ->where('status', '!=', EnrollmentSubjectStatus::Dropped->value)
            ->exists();
    }
```

with:

```php
    /**
     * @param  list<int>  $subjectIds
     */
    private function isAlreadySelectedThisTerm(int $studentId, int $academicTermId, array $subjectIds): bool
    {
        return EnrollmentSubject::query()
            ->whereHas(
                'enrollment',
                fn ($query) => $query
                    ->where('student_id', $studentId)
                    ->where('academic_term_id', $academicTermId)
                    ->whereNotIn('status', EnrollmentStatus::terminalValues()),
            )
            ->whereHas('section', fn ($query) => $query->whereIn('subject_id', $subjectIds))
            ->where('status', '!=', EnrollmentSubjectStatus::Dropped->value)
            ->exists();
    }
```

- [ ] **Step 4: Expose `college` and `is_own_department` in `EligibleSubjectResource`**

Add the `Section` import:

```php
use App\Domain\Enrollment\EligibleSubjectEntry;
use Illuminate\Http\Request;
```

becomes:

```php
use App\Domain\Enrollment\EligibleSubjectEntry;
use App\Models\Section;
use Illuminate\Http\Request;
```

Replace:

```php
            'available_sections' => SectionResource::collection($this->resource->availableSections),
        ];
```

with:

```php
            'available_sections' => array_map(
                fn (Section $section): array => [
                    ...(new SectionResource($section))->resolve($request),
                    'college' => $section->subject->college?->value,
                    'is_own_department' => $section->subject_id === $this->resource->subject->id,
                ],
                $this->resource->availableSections,
            ),
        ];
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `php artisan test --filter=EligibleSubjectsEndpointTest`

Expected: PASS (all tests, including the four new ones).

- [ ] **Step 6: Run Pint and PHPStan on the changed files**

Run:

```bash
php vendor/bin/pint --test app/Actions/Enrollment/BuildEligibleSubjectPool.php app/Http/Resources/Api/V1/EligibleSubjectResource.php
php vendor/bin/phpstan analyse --memory-limit=512M app/Actions/Enrollment/BuildEligibleSubjectPool.php app/Http/Resources/Api/V1/EligibleSubjectResource.php
```

Expected: both PASS with no errors.

- [ ] **Step 7: Commit**

```bash
git add app/Actions/Enrollment/BuildEligibleSubjectPool.php app/Http/Resources/Api/V1/EligibleSubjectResource.php tests/Feature/Api/V1/EligibleSubjectsEndpointTest.php
git commit -m "feat(enrollment): let a shared subject fill from another department's section"
```

(Run this `git add`/`git commit` from the `backend` directory.)

---

### Task 3: Frontend schema — extend eligible sections with college/department

**Files:**
- Modify: `frontend/src/features/schemas/enrollment-schema.ts`
- Modify: `frontend/src/features/services/enrollment-service.test.ts`
- Modify: `frontend/src/features/components/portal/enrollment-subject-filter-bar.test.tsx`
- Modify: `frontend/src/features/components/portal/enrollment-workspace.test.tsx`

**Interfaces:**
- Consumes: `sectionSchema` (unchanged, from `reference-data-schema.ts`).
- Produces: `eligibleSectionSchema` (exported), and `eligibleSubjectSchema.available_sections: eligibleSectionSchema[]` — every `EligibleSubject["available_sections"][number]` now carries `college: string | null` and `is_own_department: boolean`, matching Task 2's API response.

- [ ] **Step 1: Add `eligibleSectionSchema` and use it for `available_sections`**

In `frontend/src/features/schemas/enrollment-schema.ts`, replace:

```ts
import { z } from "zod"

import { sectionSchema } from "@/features/schemas/reference-data-schema"

export const eligibleSubjectReasonSchema = z
```

with:

```ts
import { z } from "zod"

import { sectionSchema } from "@/features/schemas/reference-data-schema"

/**
 * A section available to an eligible subject, extended with which
 * department it belongs to — `is_own_department` is false when the section
 * was sourced from another college's identical (same code + units) subject
 * row, per `BuildEligibleSubjectPool`'s cross-department sourcing.
 */
export const eligibleSectionSchema = sectionSchema.extend({
  college: z.string().nullable(),
  is_own_department: z.boolean(),
})

export const eligibleSubjectReasonSchema = z
```

Replace:

```ts
    available_sections: z.array(sectionSchema),
  })
  .strict()

export const eligibleSubjectsEnvelopeSchema = z
```

with:

```ts
    available_sections: z.array(eligibleSectionSchema),
  })
  .strict()

export const eligibleSubjectsEnvelopeSchema = z
```

- [ ] **Step 2: Update the roundtrip fixture in `enrollment-service.test.ts`**

Replace:

```ts
      is_block_exclusive: null,
      status: "published",
      status_label: "Published",
    },
  ],
} as const
```

with:

```ts
      is_block_exclusive: null,
      status: "published",
      status_label: "Published",
      college: "ccs",
      is_own_department: true,
    },
  ],
} as const
```

- [ ] **Step 3: Update the `section()` builder in `enrollment-subject-filter-bar.test.tsx`**

Replace:

```tsx
    is_block_exclusive: null,
    status: "published",
    status_label: "Published",
    ...overrides,
  }
}

function subject(overrides: Partial<EligibleSubject> = {}): EligibleSubject {
```

with:

```tsx
    is_block_exclusive: null,
    status: "published",
    status_label: "Published",
    college: "ccs",
    is_own_department: true,
    ...overrides,
  }
}

function subject(overrides: Partial<EligibleSubject> = {}): EligibleSubject {
```

- [ ] **Step 4: Update the three fixtures in `enrollment-workspace.test.tsx`**

Replace (the `eligibleSubject` fixture's section):

```tsx
  available_sections: [
    {
      type: "section",
      id: 5,
      academic_term_id: 2,
      subject_id: 7,
      section_code: "A",
      professor_id: null,
      schedule_days: "MWF",
      starts_at_time: "08:00:00",
      ends_at_time: "09:00:00",
      room: "R101",
      capacity: 30,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 30,
      is_block_exclusive: null,
      status: "published",
      status_label: "Published",
    },
  ],
}

const enrollmentBlock = {
```

with:

```tsx
  available_sections: [
    {
      type: "section",
      id: 5,
      academic_term_id: 2,
      subject_id: 7,
      section_code: "A",
      professor_id: null,
      schedule_days: "MWF",
      starts_at_time: "08:00:00",
      ends_at_time: "09:00:00",
      room: "R101",
      capacity: 30,
      capacity_source: "plan",
      viability_threshold: null,
      enrolled_count: 0,
      remaining_seats: 30,
      is_block_exclusive: null,
      status: "published",
      status_label: "Published",
      college: "ccs",
      is_own_department: true,
    },
  ],
}

const enrollmentBlock = {
```

Replace (the first `filterableSubjects` entry's section, `id: 30`):

```tsx
    available_sections: [
      {
        type: "section",
        id: 30,
        academic_term_id: 2,
        subject_id: 30,
        section_code: "A",
        professor_id: 10,
        schedule_days: "MWF",
        starts_at_time: "08:00:00",
        ends_at_time: "09:00:00",
        room: "R101",
        capacity: 30,
        capacity_source: "plan",
        viability_threshold: null,
        enrolled_count: 0,
        remaining_seats: 30,
        is_block_exclusive: null,
        status: "published",
        status_label: "Published",
      },
    ],
  },
```

with:

```tsx
    available_sections: [
      {
        type: "section",
        id: 30,
        academic_term_id: 2,
        subject_id: 30,
        section_code: "A",
        professor_id: 10,
        schedule_days: "MWF",
        starts_at_time: "08:00:00",
        ends_at_time: "09:00:00",
        room: "R101",
        capacity: 30,
        capacity_source: "plan",
        viability_threshold: null,
        enrolled_count: 0,
        remaining_seats: 30,
        is_block_exclusive: null,
        status: "published",
        status_label: "Published",
        college: "ccs",
        is_own_department: true,
      },
    ],
  },
```

Replace (the second `filterableSubjects` entry's section, `id: 20`):

```tsx
    available_sections: [
      {
        type: "section",
        id: 20,
        academic_term_id: 2,
        subject_id: 20,
        section_code: "A",
        professor_id: 20,
        schedule_days: "TTh",
        starts_at_time: "13:00:00",
        ends_at_time: "14:30:00",
        room: "R202",
        capacity: 30,
        capacity_source: "plan",
        viability_threshold: null,
        enrolled_count: 0,
        remaining_seats: 30,
        is_block_exclusive: null,
        status: "published",
        status_label: "Published",
      },
    ],
  },
]
```

with:

```tsx
    available_sections: [
      {
        type: "section",
        id: 20,
        academic_term_id: 2,
        subject_id: 20,
        section_code: "A",
        professor_id: 20,
        schedule_days: "TTh",
        starts_at_time: "13:00:00",
        ends_at_time: "14:30:00",
        room: "R202",
        capacity: 30,
        capacity_source: "plan",
        viability_threshold: null,
        enrolled_count: 0,
        remaining_seats: 30,
        is_block_exclusive: null,
        status: "published",
        status_label: "Published",
        college: "ccs",
        is_own_department: true,
      },
    ],
  },
]
```

- [ ] **Step 5: Run typecheck and the affected tests**

Run:

```
npm run typecheck
npm test -- --run src/features/services/enrollment-service.test.ts src/features/components/portal/enrollment-subject-filter-bar.test.tsx src/features/components/portal/enrollment-workspace.test.tsx
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/schemas/enrollment-schema.ts src/features/services/enrollment-service.test.ts src/features/components/portal/enrollment-subject-filter-bar.test.tsx src/features/components/portal/enrollment-workspace.test.tsx
git commit -m "feat(enrollment): add college/department fields to the eligible-section schema"
```

(Run this `git add`/`git commit` from the `frontend` directory.)

---

### Task 4: New `EligibleSubjectTable` component

**Files:**
- Create: `frontend/src/features/components/portal/eligible-subject-table.tsx`
- Test: `frontend/src/features/components/portal/eligible-subject-table.test.tsx`

**Interfaces:**
- Consumes: `EligibleSubject` from `@/features/schemas/enrollment-schema` (Task 3's shape).
- Produces: `EligibleSubjectTable({ subjects, selections, onChoose, onClear, disabled })`, where `subjects: readonly EligibleSubject[]`, `selections: Record<number, number>`, `onChoose: (subjectId: number, sectionId: number) => void`, `onClear: (subjectId: number) => void`, `disabled?: boolean` (default `false`). This is the exact shape Task 5 wires from `EnrollmentWorkspace`'s existing `selections`/`chooseSection`/`clearSection`.

- [ ] **Step 1: Write the failing test file**

Create `frontend/src/features/components/portal/eligible-subject-table.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"

import { EligibleSubjectTable } from "@/features/components/portal/eligible-subject-table"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"

function section(
  overrides: Partial<EligibleSubject["available_sections"][number]> = {},
): EligibleSubject["available_sections"][number] {
  return {
    type: "section",
    id: 1,
    academic_term_id: 2,
    subject_id: 7,
    section_code: "A",
    professor_id: null,
    schedule_days: "MWF",
    starts_at_time: "08:00:00",
    ends_at_time: "09:00:00",
    room: "R101",
    capacity: 30,
    capacity_source: "plan",
    viability_threshold: null,
    enrolled_count: 0,
    remaining_seats: 30,
    is_block_exclusive: null,
    status: "published",
    status_label: "Published",
    college: "ccs",
    is_own_department: true,
    ...overrides,
  }
}

function subject(overrides: Partial<EligibleSubject> = {}): EligibleSubject {
  return {
    type: "eligible_subject",
    subject_id: 1,
    code: "CS101",
    title: "Programming 1",
    units: 3,
    year_level: 1,
    semester: "1st",
    is_required: true,
    is_eligible: true,
    reasons: [{ code: "eligible", message: "All requirements are met." }],
    preference_score: null,
    preference_reasons: [],
    available_sections: [section()],
    ...overrides,
  }
}

function renderTable({
  subjects = [subject()],
  selections = {},
  onChoose = vi.fn(),
  onClear = vi.fn(),
  disabled = false,
}: {
  subjects?: readonly EligibleSubject[]
  selections?: Record<number, number>
  onChoose?: (subjectId: number, sectionId: number) => void
  onClear?: (subjectId: number) => void
  disabled?: boolean
} = {}) {
  return render(
    <EligibleSubjectTable
      subjects={subjects}
      selections={selections}
      onChoose={onChoose}
      onClear={onClear}
      disabled={disabled}
    />,
  )
}

describe("EligibleSubjectTable", () => {
  it("lists every subject with a manual section picker", () => {
    renderTable()

    expect(screen.getByText("CS101")).toBeInTheDocument()
    expect(screen.getByLabelText("CS101 section")).toBeInTheDocument()
  })

  it("calls onChoose when a section is picked", async () => {
    const user = userEvent.setup()
    const onChoose = vi.fn()
    renderTable({ onChoose })

    await user.click(screen.getByLabelText("CS101 section"))
    await user.click(await screen.findByRole("option", { name: /Section A/ }))

    expect(onChoose).toHaveBeenCalledWith(1, 1)
  })

  it("labels a cross-department section in the picker before it's chosen", async () => {
    const user = userEvent.setup()
    const otherCollege = subject({
      available_sections: [
        section({ id: 2, college: "coe", is_own_department: false }),
      ],
    })
    renderTable({ subjects: [otherCollege] })

    await user.click(screen.getByLabelText("CS101 section"))

    expect(
      await screen.findByRole("option", { name: /Section A.*COE/ }),
    ).toBeInTheDocument()
  })

  it("shows a College badge for a cross-department section once selected", () => {
    const otherCollege = subject({
      available_sections: [
        section({ id: 2, college: "coe", is_own_department: false }),
      ],
    })
    renderTable({ subjects: [otherCollege], selections: { 1: 2 } })

    expect(screen.getByText("COE section")).toBeInTheDocument()
  })

  it("removes a subject from view and clears its selection", async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    renderTable({ selections: { 1: 1 }, onClear })

    await user.click(screen.getByRole("button", { name: "Remove CS101" }))

    expect(onClear).toHaveBeenCalledWith(1)
    expect(screen.queryByText("CS101")).not.toBeInTheDocument()
    expect(screen.getByText("1 subject removed")).toBeInTheDocument()
  })

  it("brings a removed subject back into view via Show", async () => {
    const user = userEvent.setup()
    renderTable()

    await user.click(screen.getByRole("button", { name: "Remove CS101" }))
    expect(screen.queryByText("CS101")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show" }))

    expect(screen.getByText("CS101")).toBeInTheDocument()
  })

  it("disables the picker and Remove when the enrollment window is closed", () => {
    renderTable({ disabled: true })

    expect(screen.getByLabelText("CS101 section")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Remove CS101" })).toBeDisabled()
  })

  it("has no detectable accessibility violations", async () => {
    const { container } = renderTable()

    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- --run src/features/components/portal/eligible-subject-table.test.tsx`

Expected: FAIL with "Cannot find module '@/features/components/portal/eligible-subject-table'" (the component doesn't exist yet).

- [ ] **Step 3: Implement `EligibleSubjectTable`**

Create `frontend/src/features/components/portal/eligible-subject-table.tsx`:

```tsx
"use client"

import { useState } from "react"

import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"

type EligibleSection = EligibleSubject["available_sections"][number]

const COLLEGE_LABELS: Record<string, string> = {
  ccs: "CCS",
  coe: "COE",
  coa: "COA",
  cbae: "CBAE",
}

function collegeLabel(college: string | null): string {
  if (college === null) return "Other department"
  return COLLEGE_LABELS[college] ?? college.toUpperCase()
}

function scheduleLabel(section: EligibleSection | undefined): string {
  if (!section) return "Not selected"
  if (!section.schedule_days || !section.starts_at_time || !section.ends_at_time)
    return "To be confirmed"
  return `${section.schedule_days} · ${section.starts_at_time.slice(0, 5)}–${section.ends_at_time.slice(0, 5)}`
}

function selectedSectionOf(
  subject: EligibleSubject,
  selections: Record<number, number>,
): EligibleSection | undefined {
  const sectionId = selections[subject.subject_id]
  return subject.available_sections.find((section) => section.id === sectionId)
}

function columns(
  selections: Record<number, number>,
  onChoose: (subjectId: number, sectionId: number) => void,
  onClear: (subjectId: number) => void,
  onRemove: (subjectId: number) => void,
  disabled: boolean,
): DataTableColumn<EligibleSubject>[] {
  return [
    {
      key: "subject",
      header: "Subject",
      render: (subject) => (
        <div>
          <div className="font-medium">{subject.code}</div>
          <div className="text-muted-foreground">{subject.title}</div>
        </div>
      ),
    },
    {
      key: "units",
      header: "Units",
      render: (subject) => subject.units,
    },
    {
      key: "section",
      header: "Section",
      render: (subject) => {
        const selectedSectionId = selections[subject.subject_id]
        const selectedSection = selectedSectionOf(subject, selections)

        return (
          <div className="grid gap-2">
            <Select
              value={selectedSectionId ? String(selectedSectionId) : ""}
              onValueChange={(value) => {
                const sectionId = Number(value)
                if (sectionId) onChoose(subject.subject_id, sectionId)
                else onClear(subject.subject_id)
              }}
              disabled={disabled}
            >
              <SelectTrigger
                aria-label={`${subject.code} section`}
                className="w-full"
              >
                <SelectValue placeholder="Not selected" />
              </SelectTrigger>
              <SelectContent>
                {subject.available_sections.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    Section {option.section_code}
                    {option.schedule_days
                      ? ` · ${option.schedule_days} ${option.starts_at_time}–${option.ends_at_time}`
                      : ""}{" "}
                    · {option.remaining_seats} seat
                    {option.remaining_seats === 1 ? "" : "s"} open
                    {option.is_own_department
                      ? ""
                      : ` · ${collegeLabel(option.college)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSection && !selectedSection.is_own_department && (
              <Badge variant="outline" className="w-fit">
                {collegeLabel(selectedSection.college)} section
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      key: "schedule",
      header: "Schedule",
      render: (subject) => scheduleLabel(selectedSectionOf(subject, selections)),
    },
    {
      key: "room",
      header: "Room",
      render: (subject) =>
        selectedSectionOf(subject, selections)?.room ?? "Not selected",
    },
    {
      key: "remove",
      header: "Remove",
      render: (subject) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onRemove(subject.subject_id)}
        >
          Remove {subject.code}
        </Button>
      ),
    },
  ]
}

/**
 * The irregular-student per-subject selection table. Every row is one
 * eligible subject with a manual section picker — `available_sections`
 * already carries only sections the student may currently choose
 * (`BuildEligibleSubjectPool`), including another department's section for a
 * shared (non-major) subject, flagged via `is_own_department`/`college`.
 * Remove hides a subject from view for the session and clears any selection
 * it had; nothing here is persisted or affects eligibility.
 */
export function EligibleSubjectTable({
  subjects,
  selections,
  onChoose,
  onClear,
  disabled = false,
}: {
  subjects: readonly EligibleSubject[]
  selections: Record<number, number>
  onChoose: (subjectId: number, sectionId: number) => void
  onClear: (subjectId: number) => void
  disabled?: boolean
}) {
  const [removedIds, setRemovedIds] = useState<ReadonlySet<number>>(new Set())

  const remove = (subjectId: number) => {
    if (selections[subjectId] !== undefined) onClear(subjectId)
    setRemovedIds((prev) => new Set(prev).add(subjectId))
  }
  const showRemoved = () => setRemovedIds(new Set())

  const removedVisibleCount = subjects.filter((subject) =>
    removedIds.has(subject.subject_id),
  ).length
  const visibleSubjects = subjects.filter(
    (subject) => !removedIds.has(subject.subject_id),
  )

  return (
    <div className="grid gap-3">
      {removedVisibleCount > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {removedVisibleCount} subject{removedVisibleCount === 1 ? "" : "s"}{" "}
            removed
          </span>
          <Button type="button" variant="link" size="sm" onClick={showRemoved}>
            Show
          </Button>
        </div>
      )}
      <DataTable
        caption="Eligible subjects"
        rowKey={(subject) => subject.subject_id}
        rows={visibleSubjects}
        columns={columns(selections, onChoose, onClear, remove, disabled)}
        emptyMessage={
          removedVisibleCount > 0
            ? "Every subject in view has been removed. Use Show above to bring them back."
            : undefined
        }
      />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/features/components/portal/eligible-subject-table.test.tsx`

Expected: PASS (all 8 tests).

- [ ] **Step 5: Format, lint, and typecheck**

Run:

```
npx prettier --write src/features/components/portal/eligible-subject-table.tsx src/features/components/portal/eligible-subject-table.test.tsx
npm run lint:fast -- src/features/components/portal/eligible-subject-table.tsx src/features/components/portal/eligible-subject-table.test.tsx
npm run typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/components/portal/eligible-subject-table.tsx src/features/components/portal/eligible-subject-table.test.tsx
git commit -m "feat(enrollment): add EligibleSubjectTable for irregular per-subject selection"
```

(Run this `git add`/`git commit` from the `frontend` directory.)

---

### Task 5: Wire `EligibleSubjectTable` into `EnrollmentWorkspace`

**Files:**
- Modify: `frontend/src/features/components/portal/enrollment-workspace.tsx`
- Test: `frontend/src/features/components/portal/enrollment-workspace.test.tsx`

**Interfaces:**
- Consumes: Task 4's `EligibleSubjectTable({ subjects, selections, onChoose, onClear, disabled })`; the workspace's own existing `selections: Record<number, number>`, `chooseSection: (subjectId: number, sectionId: number) => void`, `clearSection: (subjectId: number) => void`.
- Produces: the irregular flow rendering `EligibleSubjectTable` instead of a `SectionChoice` card grid; `SectionChoice` and its now-unused imports removed.

- [ ] **Step 1: Write the failing/updated assertions**

In `frontend/src/features/components/portal/enrollment-workspace.test.tsx`, in the test `"selects a section, reviews, confirms, and submits the enrollment"`, replace:

```tsx
    await selectOption(user, "Section", /Section A/)
    expect(
      await screen.findByText("Review your enrollment"),
    ).toBeInTheDocument()
```

with:

```tsx
    await selectOption(user, "CS101 section", /Section A/)
    expect(
      await screen.findByText("Review your enrollment"),
    ).toBeInTheDocument()
```

In `"preserves the selected section when submission fails"`, replace both:

```tsx
    await selectOption(user, "Section", /Section A/)
```

and:

```tsx
    expect(screen.getByLabelText("Section")).toHaveTextContent("Section A")
```

with:

```tsx
    await selectOption(user, "CS101 section", /Section A/)
```

and:

```tsx
    expect(screen.getByLabelText("CS101 section")).toHaveTextContent(
      "Section A",
    )
```

Apply the same two replacements in `"shows a clear message and preserves the selection when submission conflicts"`.

In `"shows a closed banner and disables selection and submission when the enrollment window is closed"`, replace:

```tsx
    expect(await screen.findByLabelText("Section")).toBeDisabled()
```

with:

```tsx
    expect(await screen.findByLabelText("CS101 section")).toBeDisabled()
```

In `"has no detectable accessibility violations once loaded"`, replace:

```tsx
    await screen.findByLabelText("Section")
```

with:

```tsx
    await screen.findByLabelText("CS101 section")
```

Add a new test at the end of the `describe` block (after the last remaining test), proving the cross-department feature reaches the student through the full stack:

```tsx

  it("lets an irregular student choose a cross-department section for a shared subject", async () => {
    const user = userEvent.setup()
    const sharedSubject = {
      ...eligibleSubject,
      available_sections: [
        {
          ...eligibleSubject.available_sections[0],
          id: 55,
          college: "coe",
          is_own_department: false,
        },
      ],
    }
    fetchMock.mockImplementation((input, init) => {
      const target = url(input)
      if (target.includes("/eligible-subjects"))
        return Promise.resolve(
          new Response(JSON.stringify({ data: [sharedSubject] })),
        )
      return mockRoutes()(input, init)
    })
    renderWithSession(<EnrollmentWorkspace />, {
      session: {
        userId: "1",
        displayName: "Student",
        role: "student",
        signedInAt: "2026-07-30T00:00:00Z",
      },
    })

    await user.click(await screen.findByLabelText("CS101 section"))
    await user.click(
      await screen.findByRole("option", { name: /Section A.*COE/ }),
    )

    expect(screen.getByText("COE section")).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify the expected failures**

Run: `npm test -- --run src/features/components/portal/enrollment-workspace.test.tsx`

Expected: FAIL — the renamed `getByLabelText("CS101 section")` queries find nothing yet (the component still renders the old generic `"Section"` label), and the new cross-department test fails.

- [ ] **Step 3: Remove `SectionChoice` and wire `EligibleSubjectTable`**

Replace the import block:

```tsx
import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { EnrollmentAddDropPanel } from "@/features/components/portal/enrollment-add-drop-panel"
import { EnrollmentAvailabilityBanner } from "@/features/components/portal/enrollment-availability-banner"
import { EnrollmentQueuePaymentPanel } from "@/features/components/portal/enrollment-queue-payment-panel"
import { EnrollmentReviewCard } from "@/features/components/portal/enrollment-review-card"
import { EnrollmentSectionTable } from "@/features/components/portal/enrollment-section-table"
import { EnrollmentSubjectFilterBar } from "@/features/components/portal/enrollment-subject-filter-bar"
import { EnrollmentWithdrawPanel } from "@/features/components/portal/enrollment-withdraw-panel"
import { StudentAccountBalancePanel } from "@/features/components/portal/student-account-balance-panel"
import { StaggerItem, StaggerList } from "@/features/components/portal/motion"
import {
  StatusStepper,
  type StatusStepperStage,
} from "@/features/components/portal/status-stepper"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldLabel } from "@/features/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import { Skeleton } from "@/features/components/ui/skeleton"
```

with:

```tsx
import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { EligibleSubjectTable } from "@/features/components/portal/eligible-subject-table"
import { EnrollmentAddDropPanel } from "@/features/components/portal/enrollment-add-drop-panel"
import { EnrollmentAvailabilityBanner } from "@/features/components/portal/enrollment-availability-banner"
import { EnrollmentQueuePaymentPanel } from "@/features/components/portal/enrollment-queue-payment-panel"
import { EnrollmentReviewCard } from "@/features/components/portal/enrollment-review-card"
import { EnrollmentSectionTable } from "@/features/components/portal/enrollment-section-table"
import { EnrollmentSubjectFilterBar } from "@/features/components/portal/enrollment-subject-filter-bar"
import { EnrollmentWithdrawPanel } from "@/features/components/portal/enrollment-withdraw-panel"
import { StudentAccountBalancePanel } from "@/features/components/portal/student-account-balance-panel"
import {
  StatusStepper,
  type StatusStepperStage,
} from "@/features/components/portal/status-stepper"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Skeleton } from "@/features/components/ui/skeleton"
```

Remove the whole `SectionChoice` function:

```tsx
function SectionChoice({
  subject,
  selectedSectionId,
  onChoose,
  onClear,
  disabled = false,
}: {
  subject: EligibleSubject
  selectedSectionId: number | undefined
  onChoose: (sectionId: number) => void
  onClear: () => void
  disabled?: boolean
}) {
  return (
    <Card role="article" aria-label={`${subject.code} ${subject.title}`}>
      <CardHeader>
        <CardTitle level={2}>
          {subject.code} — {subject.title} ({subject.units} units)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor={`section-choice-${subject.subject_id}`}>
            Section
          </FieldLabel>
          <Select
            value={selectedSectionId ? String(selectedSectionId) : ""}
            onValueChange={(value) => {
              const sectionId = Number(value)
              if (sectionId) onChoose(sectionId)
              else onClear()
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id={`section-choice-${subject.subject_id}`}
              className="w-full"
            >
              <SelectValue placeholder="Not selected" />
            </SelectTrigger>
            <SelectContent>
              {subject.available_sections.map((section) => (
                <SelectItem key={section.id} value={String(section.id)}>
                  Section {section.section_code}
                  {section.schedule_days
                    ? ` · ${section.schedule_days} ${section.starts_at_time}–${section.ends_at_time}`
                    : ""}{" "}
                  · {section.remaining_seats} seat
                  {section.remaining_seats === 1 ? "" : "s"} open
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  )
}

export function EnrollmentWorkspace() {
```

with:

```tsx
export function EnrollmentWorkspace() {
```

Replace the irregular-flow Card body:

```tsx
                <Card>
                  <CardHeader>
                    <CardTitle level={2}>Eligible subjects</CardTitle>
                    <CardDescription>
                      Filter the pool and, optionally, sort it by how well each
                      subject fits your saved schedule preferences.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EnrollmentSubjectFilterBar subjects={selectableSubjects}>
                      {(subjectsToShow) => (
                        <StaggerList className="grid gap-3">
                          {subjectsToShow.map((subject) => (
                            <StaggerItem key={subject.subject_id}>
                              <SectionChoice
                                subject={subject}
                                selectedSectionId={
                                  selections[subject.subject_id]
                                }
                                onChoose={(sectionId) =>
                                  chooseSection(subject.subject_id, sectionId)
                                }
                                onClear={() => clearSection(subject.subject_id)}
                                disabled={enrollmentWindowClosed}
                              />
                            </StaggerItem>
                          ))}
                        </StaggerList>
                      )}
                    </EnrollmentSubjectFilterBar>
                  </CardContent>
                </Card>
```

with:

```tsx
                <Card>
                  <CardHeader>
                    <CardTitle level={2}>Eligible subjects</CardTitle>
                    <CardDescription>
                      Filter the pool, then pick a section for each subject
                      you want to enrol in.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EnrollmentSubjectFilterBar subjects={selectableSubjects}>
                      {(subjectsToShow) => (
                        <EligibleSubjectTable
                          subjects={subjectsToShow}
                          selections={selections}
                          onChoose={chooseSection}
                          onClear={clearSection}
                          disabled={enrollmentWindowClosed}
                        />
                      )}
                    </EnrollmentSubjectFilterBar>
                  </CardContent>
                </Card>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --run src/features/components/portal/enrollment-workspace.test.tsx`

Expected: PASS (every test, including the new cross-department test).

- [ ] **Step 5: Format, lint, and typecheck**

Run:

```
npx prettier --write src/features/components/portal/enrollment-workspace.tsx src/features/components/portal/enrollment-workspace.test.tsx
npm run lint:fast -- src/features/components/portal/enrollment-workspace.tsx src/features/components/portal/enrollment-workspace.test.tsx
npm run typecheck
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/components/portal/enrollment-workspace.tsx src/features/components/portal/enrollment-workspace.test.tsx
git commit -m "feat(enrollment): use EligibleSubjectTable for irregular section selection"
```

(Run this `git add`/`git commit` from the `frontend` directory.)

---

### Task 6: Full verification and progress record

**Files:**
- Verify: every file touched in Tasks 1–5.
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: the completed Tasks 1–5.
- Produces: a verified, documented change with no unrecorded checks.

- [ ] **Step 1: Run the full backend test suite for the touched area**

Run: `php artisan test --filter='(EligibleSubjectsEndpointTest|EnrollmentBlocksEndpointTest|ApiSurfaceTest)'`

Expected: PASS. (`EnrollmentBlocksEndpointTest`/`ApiSurfaceTest` are untouched by this plan but exercise adjacent enrollment routes — confirm no regression.)

- [ ] **Step 2: Run backend Pint and PHPStan across `app/Actions/Enrollment` and `app/Http/Resources/Api/V1`**

Run:

```bash
php vendor/bin/pint --test app/Actions/Enrollment app/Http/Resources/Api/V1/EligibleSubjectResource.php
php vendor/bin/phpstan analyse --memory-limit=512M app/Actions/Enrollment app/Http/Resources/Api/V1/EligibleSubjectResource.php
```

Expected: both PASS.

- [ ] **Step 3: Run the full affected frontend test suite**

Run:

```
npm test -- --run src/features/components/portal/enrollment-workspace.test.tsx src/features/components/portal/enrollment-section-table.test.tsx src/features/components/portal/enrollment-subject-filter-bar.test.tsx src/features/components/portal/eligible-subject-table.test.tsx src/features/services/enrollment-service.test.ts
npm run lint -- --quiet
npm run typecheck
```

Expected: all PASS.

- [ ] **Step 4: Confirm no stray whitespace issues**

Run: `git diff --check`

Expected: no output (clean).

- [ ] **Step 5: Record progress**

Append a new dated entry to `PROGRESS.md` (below the existing `## 2026-08-15 — 2026–2027 second-semester enrollment reset request` entry) summarizing: Schedule Preference removed from both student flows (frontend-only; backend storage/API left in place and unused); `BuildEligibleSubjectPool` now sources a shared (non-major) subject's sections from every college's identical `code`+`units` row, tagged `college`/`is_own_department`, with the already-selected check fixed to match; the irregular per-subject flow replaced with `EligibleSubjectTable` (manual picker, College badge, session-local Remove/Show); and the exact test/lint/typecheck/Pint/PHPStan results from Steps 1–4. Also note, as a separate operational finding (not part of this change): 4 third-year programs (IDs 3, 5, 6, 8 — 180 students) have no section plans generated for the current term, which is why those students saw an empty sections screen — flagged for the Registrar/Dean/Program Chair workflow, not a code defect.

- [ ] **Step 6: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(progress): record schedule preference removal and cross-department eligibility"
```

## Self-review

- Spec coverage: Task 1 removes Schedule Preference from both flows and deletes the whole now-dead frontend stack (spec §1). Task 2 implements cross-department sourcing by code+units siblings, fixes the already-selected check, and exposes `college`/`is_own_department` without touching the shared `SectionResource`/`sectionSchema` (spec §2, §"Backend changes"). Tasks 3–5 implement the schema extension, the new table (manual picker, College badge, Remove/Show), and its wiring, replacing the card grid while leaving the regular block flow and `EnrollmentReviewCard` untouched (spec §"Frontend changes", §"Behaviour and boundaries"). Task 6 covers spec §"Testing" plus PROGRESS.md recording.
- Placeholder scan: no TBD/TODO/"add appropriate handling" phrasing anywhere in the plan; every step shows exact code.
- Type consistency: `EligibleSubjectTable`'s props (`subjects`, `selections`, `onChoose`, `onClear`, `disabled`) are defined in Task 4 and consumed with the identical names and signatures in Task 5's wiring, matching `EnrollmentWorkspace`'s existing `selections`/`chooseSection`/`clearSection` state exactly (no adapter needed). `eligibleSectionSchema`'s `college`/`is_own_department` fields (Task 3) match the JSON keys `EligibleSubjectResource` emits (Task 2) and the fixture fields added across all four test files.
