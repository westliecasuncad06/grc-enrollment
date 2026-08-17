# Student Section Selection Redesign Design

## Goal

Remove the Schedule Preference feature from the student enrollment
experience entirely, and let irregular students pick sections for
non-major (shared) subjects from any department that offers the same
subject, not only their own curriculum's offering.

## Background

Two separate findings led here:

- A student screenshot showed "No sections were generated for your
  year level and curriculum yet" during an open enrollment window.
  Investigation found this is correct behavior, not a bug: for the
  current term, 4 of 11 third-year curricula (programs 3, 5, 6, 8 —
  180 students) simply have no section plans generated yet. That is a
  Registrar/Dean/Program Chair scheduling-workflow gap, out of scope
  for this change, and is flagged separately.
- The regular-student block flow was already redesigned in an earlier
  session to inline cards with only two preference fields shown
  (`docs/superpowers/specs/2026-08-14-student-inline-section-selection-design.md`,
  already merged). The request now is to remove Schedule Preference
  outright — for both regular and irregular students — and, for the
  irregular per-subject flow, let a non-major subject be filled from
  another department's section when it's genuinely the same subject.

## Scope

1. Delete the Schedule Preference feature from the student-facing
   frontend (both the regular and irregular flows). Backend storage,
   API, and scoring are left as-is and become simply unused — smaller
   diff, reversible, no risk to other consumers.
2. Backend: `BuildEligibleSubjectPool` sources a placement's available
   sections from every `subjects` row that shares the same `code` and
   `units` (its "sibling" subjects), not only the student's own
   curriculum's `subject_id`. Since major subjects have no siblings in
   this data (only gen-ed subjects like RIZAL, NSTP, PATHFIT are
   duplicated per college), this only ever expands non-major subjects.
3. Frontend: replace the per-subject card grid in the irregular flow
   with a single table, each row carrying a manual section picker
   (with a College badge on cross-department options) and a Remove
   action.

## Out of scope

- Generating or publishing the missing third-year section plans —
  that's a scheduling-workflow action for Program Chairs/Dean, not a
  code change.
- Any change to the regular (block) student flow beyond removing the
  Schedule Preference panel — its inline block-selection cards stay as
  they are.
- Any change to `StudentSchedulePreference` backend storage, its API,
  or `SchedulePreferenceScorer`.

## Backend changes

### Cross-department section sourcing

In `App\Actions\Enrollment\BuildEligibleSubjectPool::evaluatePlacement()`,
the section query currently filters by
`subject_id = $placement->subject_id` only. It changes to filter by
every subject id sharing the placement subject's `code` and `units`:

```php
$siblingSubjectIds = Subject::query()
    ->where('code', $placement->subject->code)
    ->where('units', $placement->subject->units)
    ->pluck('id')
    ->all();

$sectionsThisTerm = Section::query()
    ->where('academic_term_id', $term->id)
    ->whereIn('subject_id', $siblingSubjectIds)
    ->with(['sectionPlan', 'subject'])
    ->get();
```

Every existing filter after this point (published + open seats,
`BlockSectionAccessPolicy::allows()` for block-restricted sections)
runs unchanged over the widened collection — no other eligibility rule
changes.

`isAlreadySelectedThisTerm()` must check the same sibling id set
instead of the placement's own `subject_id` alone. Otherwise a student
who already enrolled in a cross-department section for a shared
subject would still see that placement offered as open, since the
existing check only recognizes their own curriculum's `subject_id`.

No change to grade/prerequisite checks (`ownGrade`,
`isSatisfied`, prerequisite edges) — those stay scoped to the
placement's own subject, matching the student's actual curriculum
requirement.

### College and cross-department labeling

`EligibleSubjectResource::toArray()`'s `available_sections` mapping
gains two computed fields per section, built inline rather than by
modifying the shared `SectionResource`/`sectionSchema` (which many
other, unrelated features also consume):

```php
'available_sections' => array_map(
    fn (Section $section): array => [
        ...(new SectionResource($section))->resolve($request),
        'college' => $section->subject->college,
        'is_own_department' => $section->subject_id === $this->resource->subject->id,
    ],
    $this->resource->availableSections,
),
```

This requires `subject` to be eager-loaded alongside `sectionPlan` in
the widened query above.

### Validation

No change needed in `StoreEnrollmentRequest::rejectIneligibleSections()` —
it already accepts any section id present in any pool entry's
`availableSections`, regardless of which subject_id that section
belongs to, so a cross-department section the student picked already
validates correctly once the pool includes it.

## Frontend changes

### Schema

`eligibleSubjectSchema.available_sections` (currently
`z.array(sectionSchema)`) becomes a new `eligibleSectionSchema`
(`sectionSchema.extend({ college: z.string(), is_own_department:
z.boolean() })`), scoped to this one field so no other schema or
fixture in the app is affected.

### Delete: Schedule Preference stack

Delete outright (all become fully unused once un-wired):

- `frontend/src/features/components/portal/student-schedule-preferences-panel.tsx`
  and its test
- `frontend/src/features/components/portal/apply-preferences-switch.tsx`
- `frontend/src/features/hooks/use-student-schedule-preference.ts`
- `frontend/src/features/services/student-schedule-preference-service.ts`
- `frontend/src/features/schemas/student-schedule-preference-schema.ts`

### `enrollment-workspace.tsx`

Remove both `<StudentSchedulePreferencesPanel />` /
`<StudentSchedulePreferencesPanel compact />` render calls (regular
and irregular branches). Remove the inline `SectionChoice` function
and its per-subject `<Card>` rendering; render the new
`EligibleSubjectTable` instead (see below), passing the same
`subjectsToShow`, `selections`, `chooseSection`, `clearSection`, and
`enrollmentWindowClosed` values it already computes today.

### `enrollment-section-table.tsx` (regular flow)

Remove the `ApplyPreferencesSwitch` import/render and the
`applyPreferences` state and preference-score sort; `blocks` render in
their existing (currently section_code) order, unchanged otherwise.

### `enrollment-subject-filter-bar.tsx` (irregular flow)

Remove the `ApplyPreferencesSwitch` import/render and the
`applyPreferences` state and preference-score sort. Keep the Subject
search, Day, Time block, and Professor filters — those are independent
of Schedule Preference and remain useful browsing filters.

### New: `eligible-subject-table.tsx`

Replaces the per-subject card grid. Renders `subjects` (the already
filtered/visible list from `EnrollmentSubjectFilterBar`) as a
`DataTable`, one row per subject:

- Subject code + title, units (as today).
- A section picker (existing `<Select>` semantics: choosing an option
  calls `onChoose(subjectId, sectionId)`, choosing the empty option
  calls `onClear(subjectId)`), each option labelled with its section
  code, day/time, remaining seats, and — only when
  `is_own_department` is `false` — a `college` Badge (e.g. "COE") so
  the student can tell it isn't their own department's offering.
- The current selection's day/time/room shown inline once chosen.
- A **Remove** button. Removing a subject hides its row for the rest
  of the session (local component state, a `Set<number>` of removed
  `subject_id`s) and, if that subject currently had a section chosen,
  calls `onClear(subjectId)` so nothing stays silently selected once
  hidden. A small status line ("N subjects removed — Show") lets the
  student undo this within the same session; nothing is persisted
  server-side.
- Disabled state (closed enrollment window) disables both the picker
  and Remove, matching the existing `disabled` prop threaded from
  `EnrollmentWorkspace` today.

## Behaviour and boundaries

- Only non-major (multi-college) subjects are ever affected by
  cross-department sourcing — a major subject has no sibling
  `subjects` row, so its pool is exactly what it is today.
- Cross-department sections are always included alongside the
  student's own department's sections for a shared subject (not only
  as a fallback when the own department has none) — a shared subject
  may simply schedule better in another department's slot.
- Removing a subject from the table is a client-side visibility
  action only; it never affects eligibility, submission, or any
  server state. Reloading the page (or the query refetching) brings
  every eligible subject back.
- `EnrollmentReviewCard` (the selected-subjects review table) is
  unaffected — it already only reflects `selections`, not the browse
  table's row visibility.

## Testing

- `backend/tests/Feature/Api/V1/EligibleSubjectsEndpointTest.php`: add
  coverage for (a) a shared-code subject pulling in another college's
  open section, tagged `is_own_department: false` and the right
  `college`; (b) a major subject's pool unaffected by an unrelated
  same-college-only subject; (c) `already_selected` firing correctly
  once a student has an active enrollment in a sibling section.
- `frontend/.../enrollment-subject-filter-bar.test.tsx`: remove
  preference-sort assertions; keep the existing filter assertions.
- `frontend/.../enrollment-section-table.test.tsx`: remove
  preference-sort assertions.
- `frontend/.../enrollment-workspace.test.tsx`: replace card-based
  irregular-flow assertions with table-row assertions (section pick,
  clear, Remove + undo, cross-department College badge), and assert
  neither Schedule Preference panel renders in either flow.
- Delete `student-schedule-preferences-panel.test.tsx`.

## Self-review

- Placeholder scan: no TBD/TODO present.
- Internal consistency: the "always merged, not fallback-only" rule in
  Behaviour and boundaries matches the always-widened query in Backend
  changes — no contradiction.
- Scope check: single cohesive change (remove one feature, expand one
  eligibility rule, redesign one selection surface); no unrelated
  refactor pulled in.
- Ambiguity check: "non-major" is defined operationally (shares
  `code`+`units` with another college's `subjects` row) rather than
  left to interpretation, since no such flag exists in the schema.
