# Curriculum Approval Workflow — Continuation Handoff

**Purpose of this document:** Claude Code's session hit its rate limit mid-implementation (twice now — this doc has been updated to reflect real progress each time). This is a cold-start briefing for whichever agent (Codex or otherwise) picks this work up next, so it does not need to reconstruct any of the context that produced the plan below.

## Read these two documents first, in order

1. **Design spec** (why/what, already approved by the project owner):
   `docs/superpowers/specs/2026-08-07-curriculum-approval-workflow-and-manage-table-design.md`
2. **Implementation plan** (how — the document to execute from):
   `docs/superpowers/plans/2026-08-07-curriculum-approval-workflow.md`

The plan is self-contained: every one of its 15 tasks lists exact file paths, complete ready-to-paste code (for both implementation and tests), and the exact test commands to run. It was written so an engineer with zero prior context on this codebase could follow it task-by-task. Do not improvise beyond what a task's code blocks specify — where the plan gives exact code, use it verbatim. The plan itself has already been corrected in a few places mid-execution (see "Corrections already folded into the plan" below) — those corrections are already in the plan text, not something you need to redo.

## Where things stand right now (as of this update)

- **Working tree:** `C:\xampp\htdocs\GRC-ENROLLMENT\.claude\worktrees\curriculum-approval-workflow`
- **Branch:** `worktree-curriculum-approval-workflow` (forked from `main`; this is a git worktree, not the main checkout — the main checkout is `C:\xampp\htdocs\GRC-ENROLLMENT`)
- **Progress ledger:** `.superpowers/sdd/2026-08-07-curriculum-approval-workflow/progress.md` — read it directly for the full detail behind each completed task (every entry notes any deviation from the plan's literal text and why). Summary:

  **Tasks 1–12 are DONE and each individually code-reviewed clean** (by a fresh reviewer subagent per task, verifying spec compliance + code quality — not just "tests pass"). This covers:
  - **Backend, fully complete (Tasks 1–10):** the `pending_dean_review`/`pending_executive_review` `CurriculumStatus` cases; `decided_by`/`decided_at`/`last_decision_reason` columns + model exposure; `CurriculumTransitionRules` (pure action→status mapping); `NotificationType` + `CurriculumTransitionNotificationPlan`/`NotifyCurriculumTransition`; `CurriculumPolicy::submit()/approveAsDean()/approveAsExecutive()`; the core `TransitionCurriculum` action + `PATCH /api/v1/curricula/{id}/transition` endpoint + route (8 passing scenarios); the old `PATCH /curricula/{id}` content-save endpoint now rejects a `status` field entirely and 422s any edit once a curriculum has left `Draft`; `CurriculumResource` exposes the two new fields.
  - **Frontend, partially complete (Tasks 11–12 of 11–14):**
    - Task 11: `reference-data-schema.ts`/`curriculum-schema.ts`/`curriculum-service.ts` updated for the 5-value status union and the new `transitionCurriculum()` call. Also fixed a real runtime bug this same change exposed (`toCurriculumReplacement` was still sending `status` to a schema that no longer accepts it — invisible to `tsc`, would have broken every save at runtime) and 3 unrelated test fixture files that needed the two new required response fields.
    - Task 12: `curriculum-workspace.tsx`'s Manage tab — Status dropdown removed (now a read-only Badge + return-reason Alert), every editing control locked outside Draft, autosave silenced while locked, Submit-for-Dean-Review button + confirmation dialog added. Also removed a **pre-existing, unrelated-to-this-plan "Save Curriculum" button** that force-set `status: "active"` directly — it predated this whole workflow, no longer type-checked after Task 11, and directly contradicted this task's purpose. (Confirmed via `git blame`: introduced in commit `817f5a5`, long before this plan existed — this was correct to remove, not scope creep.)
  - Every one of Tasks 1–12's deviations-from-the-brief was independently verified by a fresh reviewer subagent (not just self-reported by the implementer) before being marked complete — read the ledger entries for the specifics; they're substantive (e.g. Task 8 found and fixed 2 real bugs already present in the plan's own text, Task 12 found and fixed 6 things). None of this needs to be redone or re-litigated.

- **Task 13 is IN PROGRESS, NOT YET COMMITTED.** An implementer subagent was working on it (new `CurriculumApprovalsWorkspace` component + test file, the Dean/Executive Director review UI) when this session hit its rate limit again. Two files exist on disk, untracked by git:
  - `frontend/src/features/components/portal/curriculum-approvals-workspace.tsx` (252 lines)
  - `frontend/src/features/components/portal/curriculum-approvals-workspace.test.tsx` (116 lines)

  **These files have NOT been verified** — no `tsc`/`vitest` run confirmed against them by this session, no commit made, no code review done. Do not assume they are correct or complete. Your first action should be:
  1. Read `.superpowers/sdd/2026-08-07-curriculum-approval-workflow/task-13-brief.md` (the exact requirements) and compare it against what's actually in the two on-disk files.
  2. Run `npx tsc --noEmit -p tsconfig.json` and `npx vitest run frontend/src/features/components/portal/curriculum-approvals-workspace.test.tsx` from `frontend/` to see where they actually stand.
  3. If they're close/complete: finish verifying, fix anything broken, commit them (one commit, per the plan's Task 13 step), append a ledger line, mark Task 13 done, move to Task 14.
  4. If they're badly incomplete or wrong: it's fine to discard and restart Task 13 from the brief/plan — these two files are untracked, so `rm` is non-destructive to any committed work.

- **Tasks 14–15 are NOT started.**
- **Last real commit:** `0d14a00 feat(curriculum): remove Status dropdown, lock editing outside Draft, add Submit for Dean Review` (Task 12).

## How to continue

Finish Task 13 (see above), then work through **Task 14 → Task 15 in order** — later tasks consume files/interfaces earlier tasks produce (each task's own "Interfaces" section in the plan states exactly what it consumes and produces).

For each task:

1. Read that task's full section in the plan file.
2. Implement exactly what it specifies.
3. Run the test command(s) the task specifies; confirm they pass.
4. Commit — one commit per task, in the same terse conventional-commit style as the existing log (`git log --oneline` in this repo for examples).
5. Append one line to the ledger: `Task <N>: complete (commits <before-sha>..<after-sha>, <short note>)`.

If a plan step turns out to be ambiguous, wrong, or in conflict with the actual codebase state you find, don't silently improvise around it — note the discrepancy and make the most spec-faithful call you can, favoring what the plan's own stated architecture/rationale implies over inventing something new. This has already happened productively several times (see the ledger) — it's expected, not a failure mode, as long as it's disclosed and verified rather than guessed.

**Task 15 is verification-only** (no code changes): run the full backend suite (`php artisan test`), the full frontend suite (`npx vitest run`), `npx tsc --noEmit -p tsconfig.json`, and `php artisan migrate` against the real dev database (not just the test DB) to confirm the new migrations apply cleanly there too. This task does not need a dedicated implementer subagent — running it directly is fine.

**A known, pre-existing sandbox environment issue, not a regression:** this development environment intermittently produces spurious `vitest` test timeouts under load (tests finishing at ~5.0–5.1s against a 5000ms default, or "Failed to start forks worker" errors when running the full suite) — this has been independently confirmed multiple times across many otherwise-unrelated files and both before and after every task in this plan touched anything. If a test fails ONLY with a timeout (not an assertion failure) and passes on a clean re-run or with a longer timeout, that's this known flakiness, not something to chase. Two specific known-flaky tests in `curriculum-workspace.test.tsx`: `"keeps the selected curriculum and edits when a switch is cancelled"` and `"resets the form after confirming a selector switch to new"`.

## Global constraints (binding across every remaining task — copied verbatim from the plan)

- Every new PHP enum case, class, and test follows the existing `final class` / strict-typed style already used throughout `app/Domain`, `app/Actions`, `app/Policies` — copy the shape of the `ScheduleProposal` equivalent exactly rather than inventing a new one.
- Dean and Executive Director authorization is **role-scoped only, not college-scoped** — see `ScheduleProposalPolicy::approveAsDean()`/`approveAsExecutive()` and `NotifyScheduleTransition`'s docblock. Do not add a `college` check to any Dean/Executive Director curriculum ability.
- `dean_return` and `executive_return` require a non-empty `reason`; both land the curriculum back on `Draft`.
- No change to `Archived` or to the View tab.
- This plan does **not** touch the Manage tab's subject-entry mechanism (SearchableCombobox + placement list + Prerequisite graph dialog) beyond locking it outside `Draft` and removing the Status field — the flat-table redesign and inline subject creation are a separate, later plan (not yet written).
- Frontend: run `npx vitest run <file>` for the specific file(s) you touched after each step that says to; run `npx tsc --noEmit -p tsconfig.json` before every commit that touches a `.ts`/`.tsx` file. Backend: run `php artisan test <path>` for the specific test file after each step that says to.
- **This worktree's `.env`/`.env.testing` were originally missing** (gitignored, per-checkout files a fresh worktree doesn't get) — already fixed by copying both from the main checkout's `backend/.env`/`backend/.env.testing`. **`frontend/node_modules` was also originally missing** — already fixed via a Windows symlink (`New-Item -ItemType SymbolicLink`) to the main checkout's `frontend/node_modules`. Both are confirmed working; you shouldn't need to redo either, but if a fresh clone/worktree ever loses them again, that's the fix.

## Corrections already folded into the plan/ledger — do not "fix" them back

1. **`CurriculumPolicy::submit()` is college-scoped, not role-only.** `submit()` must check that the acting Program Chair's own `college` matches the curriculum's *program's* `college` — unlike `approveAsDean()`/`approveAsExecutive()`, which genuinely are role-only. This is already correctly implemented (Task 7) and tested (Task 8's `test_a_program_chair_from_a_different_college_cannot_submit_someone_elses_curriculum`, asserting 403). If you notice this asymmetry and are tempted to "make it consistent" — don't; it's intentional (submit starts a chain other people rely on; a role check alone isn't enough — see Task 7's docblock in the plan).
2. **`CollegeCode` has no `Cba` case** — the real cases are `Ccs`, `Coe`, `Coa`, `Cbae`. The plan's own example test code (written before this was discovered) says `CollegeCode::Cba` in a couple of places; every task that hit this substituted `Cbae` with no change in test intent. If you're writing new test code referencing colleges, use a real `CollegeCode` case.
3. **`CurriculumTransitionNotificationPlan::forAction('dean_approve', ...)` legitimately emits 2 notification rows sharing one `NotificationType`** (one to the submitter, one to every active Executive Director) — not 1. The plan's Task 8 test text originally asserted 1; this was caught and corrected (both in the actual test code and in the plan document itself, commit `e5deabe`).
4. **Sanctum guard-caching bug**: chaining `withToken()` calls for *different* users within a single PHPUnit test method silently keeps resolving the *first* user for the rest of that method. If you write a backend feature test that needs multiple different authenticated actors in sequence, do NOT chain `withToken()` calls — structure it as one authenticated actor per test method, building any "already submitted"/"already approved" precondition directly via Eloquent (`Model::create()`/`->update()`) instead of a prior live HTTP call as a different user. `ScheduleProposalsEndpointTest.php` and `CurriculumTransitionEndpointTest.php` both already follow this convention — match it.

## When all 15 tasks are done

Run Task 15's full verification (see above). Then this branch is ready for a human to review and merge into `main`.

**Do not merge this branch into `main` or push to any remote automatically.** Leave that decision to the project owner (West) — report the branch as ready for review, the same way `superpowers:finishing-a-development-branch` would present the merge/PR/keep-as-is choice, but let a human make the actual call.

## What NOT to do

- Don't start on "Plan B" (the Manage-tab flat-table redesign + inline subject creation) — it doesn't have a written plan yet, and this handoff is scoped to finishing the 15 tasks already planned.
- Don't touch `frontend/src/features/components/portal/curriculum-view.tsx`, `frontend/src/features/components/ui/tabs.tsx`, or `frontend/src/app/globals.css` beyond what a specific plan task explicitly asks — these already shipped correctly earlier this session (Curriculum Editor View tab, red Tabs active-state fix, Prerequisites column) and are not part of this plan's scope. (`curriculum-view.test.tsx` has 2 known, independently-verified-pre-existing `tsc` errors — see the ledger's Task 9/11/12 entries — that predate this entire plan; they are not yours to fix either, unless a future task explicitly asks.)
- Don't add scope beyond what each task's code blocks specify, even where it might seem like an obvious nearby improvement (YAGNI — matches this plan's own stated discipline).
- Don't re-verify claims that 3 independent reviewer subagents have already each separately confirmed (e.g. the `curriculum-view.test.tsx` pre-existing-errors claim) — trust the ledger's record of that.
