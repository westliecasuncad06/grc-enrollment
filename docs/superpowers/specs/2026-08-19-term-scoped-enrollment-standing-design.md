# Term-scoped enrollment standing (Regular/Irregular) — design

## Background

`student_profiles.enrollment_category` gates which enrollment flow a
student uses (`EnrollmentAudience::forStudent()`): Regular students pick
one block section for their whole year level; Irregular students pick a
section per subject. It was last defined on 2026-08-04
(`App\Domain\Enrollment\EnrollmentCategoryClassifier`) as: a student is
Regular if no locked mark in any *already-completed* semester (i.e. any
curriculum placement whose ordinal is before the student's current
one) is Failed, Incomplete, Not Complete, Dropped, or missing (for a
required subject). This is recomputed by
`App\Actions\Academic\ReclassifyStudentEnrollmentCategory`, triggered
only when one of the student's grades transitions to `locked`
(`App\Actions\Academic\UpdateAcademicGrade::transition()`).

## Problem

That rule accumulates over the student's **entire history**, forever.
Investigating a real case (Socorro Y. Amurao, `2024-06-01611`) showed
this working exactly as coded: three required Year‑1 subjects
(`ITC`=Incomplete, `ITCL`=Not Complete, `ITP1`=Dropped) were never
retaken, so she stays Irregular permanently — even though her most
recently completed semester is entirely clean, and even in a semester
where those three subjects aren't offered at all, so there's nothing
she could do about them this term regardless.

The user's clarified intent (confirmed in conversation): a student's
standing should be evaluated **against the specific term about to be
enrolled**, not their whole history. If she can take exactly the
standard subject set the Program Chair set up for her year level this
term — nothing needs to be added, nothing needs to be removed — she's
Regular. She only becomes Irregular when, for *this* term, she has a
backlog subject that's actually offered and needs adding, or a
standard-set subject she can't take (unmet prerequisite, or already
passed early).

## Rule

For a given `(student, term)`:

1. **Standard set** — the distinct `subject_id`s covered by the
   published, block-exclusive `Section`s this term whose
   `AcademicTermSectionPlan` matches the student's own
   `(year_level, curriculum_id)`. This is exactly the set
   `BuildEnrollmentBlockPool` already draws block sections from — "the
   block the Program Chair set for this year level."
2. **Fit check** (each standard-set subject): does the student already
   have a passing locked grade *or a curriculum-migration credit* for
   it (already completed early — doesn't belong in this term's load —
   same "credited counts as passed" rule `BuildEligibleSubjectPool`
   already applies via `CurriculumMigrationCredit`), or an unmet
   prerequisite (can't take it yet)? Either makes that subject need
   **removing** from her load relative to the standard set. A subject
   she previously failed *in this same curriculum slot* (a repeat)
   is not a removal case — retaking it is simply part of the normal
   load, no add/remove needed.
3. **Backlog check** (every other curriculum subject, not in the
   standard set): does the student lack a passing locked grade *and*
   lack a migration credit for it, meet its prerequisites, **and**
   does at least one published, non-block-exclusive section exist for
   it this term with an open seat? If so, it needs **adding** to her
   load this term. A backlog subject with no section offered this
   term is invisible to this check — there is nothing actionable this
   term, so it does not affect standing until a term that actually
   offers it.
4. **Verdict**: Regular if nothing needs adding and nothing needs
   removing. Otherwise Irregular, with one reason per affected subject
   (reusing the existing `{code, message}` shape).

If no standard-set block exists yet for the student's year level this
term (Program Chair hasn't published one), standing cannot be
confirmed Regular — default to Irregular, the same "safer of the two"
default the codebase already uses when an audience can't be resolved.

## Components

- **New: `App\Actions\Academic\ClassifyEnrollmentStanding`** — replaces
  `App\Domain\Enrollment\EnrollmentCategoryClassifier`. An
  injectable Action (constructor-injects `PrerequisiteEvaluator`, same
  pattern as `BuildEnrollmentBlockPool`), because the rule now needs
  live section/section-plan data and real prerequisite evaluation —
  it can no longer be a pure, DB-free static function. One method,
  `classify(StudentProfile $student, AcademicTerm $term): ClassificationVerdict`.
  `ClassificationVerdict`/`EnrollmentCategory` (existing value objects)
  are unchanged. Prerequisite edges come from the student's own
  curriculum's `CurriculumSubject->prerequisites()`, evaluated the same
  way `BuildEnrollmentBlockPool`/`BuildEligibleSubjectPool` already do;
  "already passed" folds in `CurriculumMigrationCredit` the same way
  `BuildEligibleSubjectPool`'s `creditedSubjectIds` does.
- **Removed:** `App\Domain\Enrollment\EnrollmentCategoryClassifier`,
  `App\Domain\Enrollment\CurriculumPlacementSlot` (no longer used by
  anything else — verified by grep).
- **Changed: `App\Actions\Academic\ReclassifyStudentEnrollmentCategory`**
  — `computeVerdicts()` now delegates per student to
  `ClassifyEnrollmentStanding::classify()` instead of the old
  grades+placements+ordinal pipeline. `execute()`/`executeMany()`/
  `preview()` keep their existing signatures and existing
  audit/notify/guard-against-no-op-write behavior unchanged.
- **Changed: `App\Actions\Enrollment\BuildEnrollmentAccessContext::execute()`**
  — before reading `$student->enrollment_category`, self-heals it:
  when `$term->status === AcademicTermStatus::SemesterOngoing`, calls
  the reclassifier for `($student, $term)` and persists if the
  category actually changed (existing no-op-if-unchanged guard means
  this is a cheap, silent read in the common case). Only the live term
  ever triggers a write — browsing an archived/closed term never
  mutates standing. This is the authoritative correctness path: both
  `BuildEligibleSubjectPool` and `BuildEnrollmentBlockPool` already
  call `execute($term, $student)` first, so every enrollment-facing
  read self-heals automatically regardless of entry point.
- **Unchanged (still correct as-is):** `EnrollmentAudience::forStudent()`,
  `UpdateAcademicGrade::transition()`'s grade-lock hook (still fires
  reclassification eagerly so a student gets notified promptly,
  now just running the new rule), `students:reclassify` command,
  `GenerateIrregularStudentReport`, the audit/notification wording.

## Data flow

```
Student opens Eligible Subjects / Block Pool page for term T
  -> BuildEligibleSubjectPool / BuildEnrollmentBlockPool .execute(student, T)
    -> BuildEnrollmentAccessContext.execute(T, student)
       -> if T.status == semester_ongoing:
            verdict = ClassifyEnrollmentStanding.classify(student, T)
            if verdict.category != student.enrollment_category:
              persist + audit + notify (existing ReclassifyStudentEnrollmentCategory path)
       -> EnrollmentAudience::forStudent(student.enrollment_category, student.year_level)
       -> EnrollmentAccessContext { viewerAudience, ... }
```

## Testing

- Unit/feature tests for `ClassifyEnrollmentStanding` covering: exact
  match → Regular; backlog subject offered this term but not in
  standard set → Irregular ("needs adding"); backlog subject **not**
  offered this term → Regular (the Socorro case); standard-set subject
  already passed early → Irregular ("needs removing"); standard-set
  subject blocked by an unmet prerequisite → Irregular; no block
  published yet for the year level → Irregular (default).
- `BuildEnrollmentAccessContext` test: viewing an archived/closed term
  never mutates `enrollment_category` even when the computed verdict
  would differ.
- Existing `ReclassifyStudentEnrollmentCategory`/`UpdateAcademicGrade`/
  `students:reclassify` tests updated to the new rule's fixtures
  instead of the old cumulative-history ones.
- After merge: re-run `php artisan students:reclassify` (or the
  `GenerateIrregularStudentReport` command) against the seeded roster
  and confirm Socorro moves to Regular for the current (2nd semester)
  term.

## Out of scope

- No change to `enrollment_category`'s storage shape (still a single
  nullable string column, not per-term history).
- No change to how Registrar/Program Chair publish blocks or sections.
- No UI change beyond what already exists (the Regular/Irregular
  explanation banner added earlier this conversation already describes
  this rule in plain language; its copy doesn't need to change).
