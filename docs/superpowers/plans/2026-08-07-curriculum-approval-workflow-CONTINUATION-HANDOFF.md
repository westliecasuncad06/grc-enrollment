# Curriculum Approval Workflow — Continuation Handoff

**Purpose of this document:** Claude Code's session hit its rate limit mid-implementation. This is a cold-start briefing for whichever agent (Codex or otherwise) picks this work up next, so it does not need to reconstruct any of the context that produced the plan below.

## Read these two documents first, in order

1. **Design spec** (why/what, already approved by the project owner):
   `docs/superpowers/specs/2026-08-07-curriculum-approval-workflow-and-manage-table-design.md`
2. **Implementation plan** (how — the document to execute from):
   `docs/superpowers/plans/2026-08-07-curriculum-approval-workflow.md`

The plan is self-contained: every one of its 15 tasks lists exact file paths, complete ready-to-paste code (for both implementation and tests), and the exact test commands to run. It was written so an engineer with zero prior context on this codebase could follow it task-by-task. Do not improvise beyond what a task's code blocks specify — where the plan gives exact code, use it verbatim.

## Where things stand right now

- **Working tree:** `C:\xampp\htdocs\GRC-ENROLLMENT\.claude\worktrees\curriculum-approval-workflow`
- **Branch:** `worktree-curriculum-approval-workflow` (forked from `main`; this is a git worktree, not the main checkout — the main checkout is `C:\xampp\htdocs\GRC-ENROLLMENT`)
- **Progress ledger:** `.superpowers/sdd/2026-08-07-curriculum-approval-workflow/progress.md` (git-ignored scratch dir — task briefs, implementer reports, and review diffs from work-so-far also live there if useful, but the ledger's own lines are the source of truth for what's actually done)
- **Ledger currently reads:**
  ```
  # SDD ledger — plan: docs/superpowers/plans/2026-08-07-curriculum-approval-workflow.md
  Task 1: complete (commits 41b76bf..e6428a5, review clean)
  ```
- **Task 1 is DONE and reviewed clean** (`CurriculumStatus` gained `PendingDeanReview`/`PendingExecutiveReview`, backend/app/Domain/Curriculum/CurriculumStatus.php + its test).
- **Tasks 2–15 are NOT started.** A Task 2 implementer attempt was launched but failed immediately on a rate limit before writing any file — `git status --short` is clean, there is nothing to undo.
- **Last real commit:** `e6428a5 feat(curriculum): add PendingDeanReview/PendingExecutiveReview statuses`

## How to continue

Work through **Task 2 → Task 15 in order** — later tasks consume files/interfaces earlier tasks produce (each task's own "Interfaces" section in the plan states exactly what it consumes and produces, so cross-task dependencies are explicit, not implicit).

For each task:

1. Read that task's full section in the plan file.
2. Implement exactly what it specifies.
3. Run the test command(s) the task specifies; confirm they pass.
4. Commit — one commit per task, in the same terse conventional-commit style as the existing log (`git log --oneline` in this repo for examples; Task 1's commit `e6428a5` is the most recent example of the expected style).
5. Append one line to the ledger: `Task <N>: complete (commits <before-sha>..<after-sha>, <short note>)`.

If a plan step turns out to be ambiguous, wrong, or in conflict with the actual codebase state you find, don't silently improvise around it — note the discrepancy (in a comment in your own working notes, or directly to whoever is supervising this run) and make the most spec-faithful call you can, favoring what the plan's own stated architecture/rationale implies over inventing something new.

## Global constraints (binding across every remaining task — copied verbatim from the plan)

- Every new PHP enum case, class, and test follows the existing `final class` / strict-typed style already used throughout `app/Domain`, `app/Actions`, `app/Policies` — copy the shape of the `ScheduleProposal` equivalent exactly rather than inventing a new one.
- Dean and Executive Director authorization is **role-scoped only, not college-scoped** — see `ScheduleProposalPolicy::approveAsDean()`/`approveAsExecutive()` and `NotifyScheduleTransition`'s docblock. Do not add a `college` check to any Dean/Executive Director curriculum ability.
- `dean_return` and `executive_return` require a non-empty `reason`; both land the curriculum back on `Draft`.
- No change to `Archived` or to the View tab.
- This plan does **not** touch the Manage tab's subject-entry mechanism (SearchableCombobox + placement list + Prerequisite graph dialog) beyond locking it outside `Draft` and removing the Status field — the flat-table redesign and inline subject creation are a separate, later plan (not yet written).
- Frontend: run `npx vitest run <file>` for the specific file(s) you touched after each step that says to; run `npx tsc --noEmit -p tsconfig.json` before every commit that touches a `.ts`/`.tsx` file. Backend: run `php artisan test <path>` for the specific test file after each step that says to. (Confirm this repo's actual test-runner invocation once, e.g. via `composer.json`'s `test` script, if `php artisan test` doesn't behave as expected.)

## One important correction already folded into the plan — do not "fix" it back

While writing the plan, a bug was caught during self-review and corrected in the plan text itself (Task 7): `CurriculumPolicy::submit()` must check that the acting Program Chair's own `college` matches the curriculum's *program's* `college` — it is **not** role-only, unlike `approveAsDean()`/`approveAsExecutive()` which genuinely are role-only (per the Global Constraint above). This is already written correctly into Task 7's code in the plan and into Task 8's endpoint test (`test_a_program_chair_from_a_different_college_cannot_submit_someone_elses_curriculum`, which asserts `403 Forbidden`). If you notice this asymmetry (submit is college-scoped, dean/executive approvals aren't) and are tempted to "make it consistent" — don't; it's intentional, and the plan's own Task 7 docblock explains why (submit starts a chain other people rely on; a role check alone isn't enough).

## When all 15 tasks are done

Run the full verification in Task 15: `php artisan test` (backend), `npx vitest run` (frontend), `npx tsc --noEmit -p tsconfig.json` (frontend), and `php artisan migrate` against the real dev database (not just the test DB) to confirm the new migration applies cleanly there too.

**Do not merge this branch into `main` or push to any remote automatically.** Leave that decision to the project owner (West) — report the branch as ready for review once Task 15 is green, the same way `superpowers:finishing-a-development-branch` would present the merge/PR/keep-as-is choice, but let a human make the actual call.

## What NOT to do

- Don't start on "Plan B" (the Manage-tab flat-table redesign + inline subject creation) — it doesn't have a written plan yet, and this handoff is scoped to finishing the 15 tasks already planned.
- Don't touch `frontend/src/features/components/portal/curriculum-view.tsx`, `curriculum-view.test.tsx`, `frontend/src/features/components/ui/tabs.tsx`, or `frontend/src/app/globals.css` beyond what a specific plan task explicitly asks — these already shipped correctly earlier this session (Curriculum Editor View tab, red Tabs active-state fix, Prerequisites column) and are not part of this plan's scope.
- Don't add scope beyond what each task's code blocks specify, even where it might seem like an obvious nearby improvement (YAGNI — matches this plan's own stated discipline).
