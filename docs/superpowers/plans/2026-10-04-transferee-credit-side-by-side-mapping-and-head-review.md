# Transferee Credit Side-by-Side Mapping and Registrar Head Review Implementation Plan (Slice 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the owner chose native execution) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Program Chair reviews one student at a time on a side-by-side screen (student's entry on the left, the matching GRC subject on the right in a searchable dropdown, the best suggestion pre-selected but saved only when the Chair confirms) and sends the whole student to the Registrar Head in one step; the Registrar Head reviews the same layout, read-only, and can approve all of a student's credits in one click or return or reject single rows.

**Architecture:** Three student-scoped endpoints under `/api/v1/student-profiles/{studentProfile}/transferee-credits/` (bulk suggestions plus the student's curriculum subjects, `submit-to-registrar-head`, `approve-all`) built on the Slice 1 statuses; the existing per-row PATCH keeps doing single steps. On the frontend, the Chair's per-credit review dialog is replaced by a per-student panel, and the Registrar Head gets his own workspace (Registrar Staff keep the flat read-only table).

**Tech Stack:** Laravel 12 / PHPUnit 11 / MariaDB; Next.js (client-rendered), TypeScript strict, TanStack Query, Zod, Tailwind, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-transferee-credit-mapping-pay-first-design.md` (Slice 2 and Decisions). Slice 1 plan: `docs/superpowers/plans/2026-10-04-transferee-credit-drafts-and-registrar-head-approval.md` (implemented).

## Why this plan is shorter than Slice 1's

The author is also the executor (native execution, one session), so the plan records interfaces, behaviors, test names and the few non-obvious pieces of code, and does not copy every line of routine code. This is a ruling in the execution ledger, not a template for handing the plan to someone else.

## Global Constraints

- **No commits and no pushes** (AGENTS.md: only on the owner's explicit request). "Checkpoint" = `PROGRESS.md` line plus the ledger.
- Bearer-token auth only; `/api/v1`; Form Requests, Policies, Actions, API Resources, transactions; **idempotent** state changes (a repeat changes nothing and notifies nobody).
- **Backend tests only on the private MariaDB** (`127.0.0.1:3310`, user `root`, no password) in database `grc_enrollment_slice1` through **process environment variables** `DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_DATABASE` (never the owner's `:3306`).
- Authorization before validation (403 before 422). The mapping is the Program Chair's decision: **the API never writes a suggestion into `subject_id`**; the screen may pre-select one but saves nothing until the Chair clicks Confirm.
- Resources are built for `preventLazyLoading`: eager-load `student.user`, `student.program`, `subject`.
- `source_grade` is a free string; no grade conversion (PRD §17).
- Targeted `Edit`s on files other sessions have modified (`routes/api.php`, `ApiSurfaceTest.php`, `openapi.yaml`, `PRD.md`, `role-capabilities*`, `module-registry*`, `enrollment-workspace.tsx`, `notification-presentation.ts`); whole-file rewrites only on files git shows clean.
- Run Pint on exactly the PHP files changed (never whole directories), PHPStan on new/rewritten source files, `tsc --noEmit`, ESLint on changed frontend files. Do not reformat lint/format red that already exists at HEAD.

## Review Focus

1. **A student whose pending rows are not all mapped:** `submit-to-registrar-head` must refuse the whole student (422 listing the rows) and endorse **none**; a repeat after success endorses nothing and notifies nobody.
2. **Another college's student, and every non-Chair role,** on the three new endpoints: 403, never a list of someone else's credits.
3. **Drafts and decided rows are never touched or listed** by the bulk endpoints (only `pending` for suggestions and submit, only `endorsed` for approve-all).
4. **Approve-all with zero endorsed rows** is a harmless 200 with an empty list, and with a mix of statuses approves only the `endorsed` ones.
5. **The bulk suggestions equal the per-credit suggestions** (the refactor must not change ranking, exclusions, or the "already mapped by another credit" rule).
6. **Two rows must not pre-select the same GRC subject** on the Chair screen, and nothing pre-selected is saved until Confirm (a reload shows the rows unconfirmed again).
7. **The Registrar Head screen cannot approve anything for a student whose rows are not all `endorsed`** (Approve all acts only on the endorsed rows; the button says how many).

## File Structure

**Backend create**
- `backend/app/Actions/Academic/SubmitCreditsToRegistrarHead.php`
- `backend/app/Actions/Academic/ApproveStudentCredits.php`
- `backend/app/Actions/Academic/BuildCreditMappingWorkspace.php`: for one student, the pending credits' suggestions and the curriculum's subjects.
- `backend/app/Http/Controllers/Api/V1/StudentCreditMappingController.php`
- `backend/tests/Feature/Api/V1/StudentCreditMappingEndpointTest.php`

**Backend modify**
- `app/Actions/Academic/SuggestCreditSubjects.php`: add `forCredits(StudentProfile, Collection): array<int, list<CreditSubjectSuggestion>>`; `execute()` delegates to it.
- `app/Policies/TransfereeCreditPolicy.php`: `manageStudent(User, StudentProfile): bool`.
- `app/Actions/Academic/EvaluateCreditMappingStatus.php`: the two "Registrar" reason strings become "Registrar Head" (Slice 1 deferred minor).
- `routes/api.php`, `tests/Feature/Api/V1/ApiSurfaceTest.php`, `docs/api/openapi.yaml`, `docs/adr/0026-credit-mapping-ownership-and-effect.md`, `docs/data-dictionary/enrollment-records.md`.

**Frontend create** (under `frontend/src/features/`)
- `components/portal/credit-entry-cell.tsx`: the left-hand cell.
- `components/portal/student-credit-mapping-panel.tsx` (+ `.test.tsx`): the Chair's side-by-side panel.
- `components/portal/registrar-head-credit-review-workspace.tsx` (+ `.test.tsx`): the Head's workspace.

**Frontend modify**
- `schemas/transferee-credit-schema.ts`, `services/transferee-credit-service.ts`, `hooks/use-transferee-credits.ts`, `lib/credit-mapping.ts` (+ test).
- `components/portal/program-chair-credit-mappings-workspace.tsx` (+ test): per-student queue and panel replace the review dialog.
- `components/portal/registrar-records-workspace.tsx` (+ test): back to Registrar Staff only (the Head has his own workspace).
- `portal/module-registry.tsx`: the `credit-mappings` router sends `registrar_head` to the new workspace.
- Delete `components/portal/credit-review-dialog.tsx` once nothing imports it.

---

### Task 1: The deferred wording fix (Slice 1 minor)

**Files:** `backend/app/Actions/Academic/EvaluateCreditMappingStatus.php`, `backend/tests/Unit/Actions/Academic/EvaluateCreditMappingStatusTest.php`

- [ ] Test first (add to the existing class): `test_the_reasons_name_the_registrar_head_not_just_the_registrar` asserts that the transferee-with-no-credits reason contains `Registrar Head` and that the returnee-with-nothing reason contains `Registrar Head`. Run, see it fail.
- [ ] Change the two strings: `...Please wait for the Program Head / Registrar Head to evaluate your credits from your previous school.` and `...Please contact your Program Head or Registrar Head before enrolling.`
- [ ] Run `EvaluateCreditMappingStatusTest` (all pass), Pint `--test` on the source file.

### Task 2: Bulk suggestions (`SuggestCreditSubjects::forCredits`) and the workspace endpoint

**Files:** `SuggestCreditSubjects.php` (modify), `BuildCreditMappingWorkspace.php` (create), `StudentCreditMappingController.php` (create), `TransfereeCreditPolicy.php`, `routes/api.php`, `StudentCreditMappingEndpointTest.php` (create)

**Interfaces**
- `SuggestCreditSubjects::forCredits(StudentProfile $student, Collection<int, TransfereeCredit> $credits): array<int, list<CreditSubjectSuggestion>>` keyed by credit id; loads the curriculum placements, the student's credited and passed subjects, and the student's mapped credits **once**; for each credit the excluded set is the base set plus the subjects mapped by **other** credits (the credit's own mapping never excludes itself). `execute(TransfereeCredit)` returns `forCredits($credit->student, new Collection([$credit]))[$credit->id]`.
- `TransfereeCreditPolicy::manageStudent(User $user, StudentProfile $student): bool` is true for a Program Chair with no college or whose college equals `$student->program->college` (`loadMissing('program')`).
- `GET /api/v1/student-profiles/{studentProfile}/transferee-credits/suggestions` (route name `student-profiles.transferee-credits.suggestions`, `whereNumber('studentProfile')`, authorized with `$this->authorize('manageStudent', [TransfereeCredit::class, $studentProfile])`) answers
  `{"data": {"student_id": int, "credits": [{"credit_id": int, "suggestions": [CreditSubjectSuggestionResource...]}], "curriculum_subjects": [{"subject_id": int, "subject_code": string, "subject_title": string, "units": number, "year_level": int, "semester": string}]}}`.
  `credits` has one entry per **`pending`** credit of that student (ordered by id); `curriculum_subjects` are the student's curriculum placements whose subject is active, one entry per subject, ordered by year level, semester, code. Response header `Cache-Control: no-store, private`.

**Steps**
- [ ] Failing tests in the new `StudentCreditMappingEndpointTest` (own helpers copied from `TransfereeCreditsEndpointTest`: `makeCurriculum`, `makeStudent`, `makeUser`, `tokenFor`, `makeSubject`, `makeCredit`):
  - `test_the_chair_gets_suggestions_for_every_pending_credit_of_a_student_in_one_call`: two pending credits for one student and a curriculum of three subjects; assert `data.credits` has 2 entries each with a non-empty `suggestions`, `data.curriculum_subjects` has the 3 subjects, and the first suggestion for the exact-code credit is the exact subject.
  - `test_bulk_suggestions_equal_the_single_credit_suggestions`: for each pending credit compare `data.credits[i].suggestions` with the existing `GET /transferee-credits/{id}/suggestions` data.
  - `test_the_bulk_suggestions_leave_out_what_another_credit_of_the_student_already_maps`: credit A already mapped (pending with `subject_id` X); credit B's suggestions exclude X, A's own suggestions do not.
  - `test_the_bulk_suggestions_skip_drafts_and_decided_credits`: a draft, an endorsed and a rejected credit produce no `credits` entry.
  - `test_another_colleges_chair_and_other_roles_are_refused`: Chair of another college, Registrar Staff, Registrar Head, the student, each 403 (one actor per test; use a small loop of `tokenFor` calls only if each is a separate request in its own test method).
  - `test_a_student_with_no_pending_credit_gets_an_empty_credits_list_but_the_curriculum`.
- [ ] Run them (RED), then implement `forCredits` (move the scoring body into a private `rank(TransfereeCredit, Collection $placements, array $excluded)` and keep `execute()` as the one-credit wrapper), `BuildCreditMappingWorkspace::execute(StudentProfile): array` (returns the structure above using `CreditSubjectSuggestionResource` only in the controller), the controller method, the policy method, the route.
- [ ] GREEN: the new file plus the whole `TransfereeCreditsEndpointTest` (the old single-credit suggestion tests must still pass), Pint and PHPStan on the changed files.

### Task 3: Send a whole student to the Registrar Head

**Files:** `SubmitCreditsToRegistrarHead.php`, controller, route, tests

**Interface:** `POST /api/v1/student-profiles/{studentProfile}/transferee-credits/submit-to-registrar-head` (route name `student-profiles.transferee-credits.submit-to-registrar-head`, same authorization as Task 2). `SubmitCreditsToRegistrarHead::execute(StudentProfile $student, User $chair, AuditRequestContext $context): Collection<int, TransfereeCredit>`:
- in one transaction, lock the student's `pending` credits (`lockForUpdate`, ordered by id);
- none → return an empty collection (200, nothing changes, nobody is notified);
- any with `subject_id` null → `ValidationException::withMessages(['credits' => ["Map or decline every request before sending it to the Registrar Head. Still unmapped: <comma-separated source subject titles>."]])` and **nothing** is endorsed;
- otherwise every row becomes `endorsed` with `endorsed_by`, `endorsed_at`, and `returned_by/returned_at/return_reason` cleared; one `AuditAction::TRANSFEREE_CREDIT_ENDORSED` row per credit (before `status: pending`, after `status: endorsed`); **one** notification to `UserRole::RegistrarHead` (`NotificationType::TransfereeCreditEndorsed`, "N credits for student X were endorsed by the Program Head and await your approval.");
- returns the endorsed credits with `student.user` and `subject` loaded; the controller answers `TransfereeCreditResource::collection(...)`.

**Tests:** `test_the_chair_sends_every_mapped_pending_credit_of_a_student_to_the_registrar_head` (statuses endorsed, `endorsed_by` = chair, one Head notification mentioning "2 credits", two audit rows); `test_it_sends_nothing_when_one_pending_credit_is_still_unmapped` (422 on `credits`, both rows still pending, no notification); `test_sending_twice_changes_nothing_the_second_time`; `test_a_returned_credit_is_sent_again_and_its_return_details_clear`; `test_drafts_and_decided_credits_are_left_alone`; `test_sending_for_a_student_with_nothing_pending_is_an_empty_success`; `test_the_wrong_college_and_other_roles_are_refused` (Chair of another college, Staff, Head, student: 403 and the rows untouched).

### Task 4: Approve all of a student's endorsed credits

**Files:** `ApproveStudentCredits.php`, controller, route, tests

**Interface:** `POST /api/v1/student-profiles/{studentProfile}/transferee-credits/approve-all` (route name `student-profiles.transferee-credits.approve-all`), authorized with `$this->authorize('decide', TransfereeCredit::class)` (Registrar Head only). `ApproveStudentCredits::execute(StudentProfile $student, User $head, AuditRequestContext $context): Collection`: lock the student's `endorsed` credits; none → empty collection (200); else each → `approved` with `processed_by`/`processed_at`, one `TRANSFEREE_CREDIT_APPROVED` audit row each, **one** notification to the student (`NotificationType::TransfereeCreditApproved`, "N of your transferee credits have been approved."), returns the approved credits with `student.user` and `subject` loaded.

**Tests:** `test_the_registrar_head_approves_all_of_a_students_endorsed_credits` (approved, `processed_by` = head, one notification to the student, audit rows); `test_approve_all_touches_only_endorsed_rows` (a pending, a draft, a rejected row stay as they are); `test_approve_all_with_nothing_endorsed_is_an_empty_success`; `test_approving_all_twice_has_no_second_effect`; `test_staff_and_chairs_cannot_approve_all` (403 each, rows untouched).

### Task 5: Route surface and documents

**Files:** `ApiSurfaceTest.php`, `routes/api.php` (already edited in Tasks 2 to 4), `openapi.yaml`, ADR 0026, data dictionary

- [ ] `ApiSurfaceTest`: add the three route lines to the sorted method-and-URI list (`GET|HEAD api/v1/student-profiles/{studentProfile}/transferee-credits/suggestions`, `POST api/v1/student-profiles/{studentProfile}/transferee-credits/approve-all`, `POST api/v1/student-profiles/{studentProfile}/transferee-credits/submit-to-registrar-head`), the three route names to the guarded list, and to the no-`role:`-middleware list (these three are policy-gated like the other credit routes).
- [ ] OpenAPI: three operations (`getStudentCreditMappingSuggestions`, `postStudentCreditsSubmitToRegistrarHead`, `postStudentCreditsApproveAll`) with their schemas; ADR 0026 gets a second amendment (side-by-side screens; bulk endpoints; the screen pre-selects but never saves a suggestion; the per-credit dialog is gone; Registrar Head has his own workspace); data dictionary API paragraph names the three endpoints.
- [ ] Verify: `ApiSurfaceTest` and `tests/Unit/Contracts` pass; `yaml.safe_load` parses the OpenAPI.

### Task 6: Frontend contract and the pure helpers

**Files:** `schemas/transferee-credit-schema.ts`, `services/transferee-credit-service.ts`, `hooks/use-transferee-credits.ts`, `lib/credit-mapping.ts` and `lib/credit-mapping.test.ts`, `schemas/transferee-credit-schema.test.ts`

**Interfaces**
- Schema: `creditMappingSuggestionsEnvelopeSchema` (strict) for the Task 2 response; types `CreditMappingWorkspace`, `CurriculumSubjectOption` (`subject_id`, `subject_code`, `subject_title`, `units`, `year_level`, `semester`), `CreditSuggestionGroup` (`credit_id`, `suggestions`).
- Service: `getCreditMappingWorkspace(studentId, signal?)`, `submitCreditsToRegistrarHead(studentId): Promise<TransfereeCredit[]>`, `approveAllStudentCredits(studentId): Promise<TransfereeCredit[]>`.
- Hooks: `useCreditMappingWorkspaceQuery(studentId | null)` (query key `["credit-mapping-workspace", userId, studentId]`), `useSubmitCreditsToRegistrarHeadMutation()`, `useApproveAllStudentCreditsMutation()`; both mutations invalidate the transferee-credit queries **and** the workspace query.
- `lib/credit-mapping.ts` gains:
  - `preselectSuggestions(credits: {id: number; subject_id: number | null}[], groups: {credit_id: number; suggestions: {subject_id: number}[]}[]): Record<number, number>`: for each credit in order **without a saved subject**, picks its first suggestion whose subject is not already saved on another credit and not already picked for an earlier row; returns `{creditId: subjectId}` only for rows that got one (this is the "two rows never pre-select the same subject" rule).
  - `groupCreditsByStudent<T extends {student_id: number; student_name: string; student_number: string}>(credits: T[]): {student_id: number; student_name: string; student_number: string; credits: T[]}[]` preserving first-seen order.

**Tests first:** `preselectSuggestions` (picks the top suggestion; skips a subject another row already saved; skips a subject picked by an earlier row; leaves rows with a saved subject alone; leaves rows with no suggestions out); `groupCreditsByStudent` (groups, keeps order); schema parses a real-shaped workspace payload and rejects an unknown key (strict).

### Task 7: The Chair's side-by-side panel and workspace

**Files:** `credit-entry-cell.tsx`, `student-credit-mapping-panel.tsx` (+ test), `program-chair-credit-mappings-workspace.tsx` (+ test), delete `credit-review-dialog.tsx`

**Behavior**
- Workspace card **"Students waiting for review"**: pending credits (`status: "pending"`, `per_page: 100`) grouped by student (`groupCreditsByStudent`); each row shows the student, the number of subjects and a **Review** button; choosing one opens the panel for that student (state `reviewingStudentId`). Keep the "Waiting for the Registrar Head" card (endorsed list, wording updated), the TOR uploads card and the "Record a credit for a student" card unchanged.
- **Panel** (`StudentCreditMappingPanel({student, onClose})`): loads the student's credits (`student_id`, `per_page: 100`) and `useCreditMappingWorkspaceQuery`. Layout: header with the student, `StudentTorFiles` (the student's uploaded TOR with its open button), then a table with columns **Student's entry** (left, `CreditEntryCell`) and **GRC subject** (right). Pending rows: a `SearchableCombobox` over `curriculum_subjects` (label `CODE — title`) pre-selected from `preselectSuggestions` and marked with a **Suggested** badge while it is the unconfirmed suggestion; a units input (defaults to the credit's units); buttons **Confirm** (PATCH `{subject_id, credited_units}`, then the row shows **Confirmed**) and **No equivalent** (opens a reason field, then PATCH `{action: "decline", reason}`). Rows already `endorsed`, `approved` or `rejected` are read-only with a status badge; a returned row (pending with `return_reason`) shows "Returned by the Registrar Head: reason". Panel buttons: **Confirm all suggested** (PATCH each unconfirmed pre-selected row in order, stop at the first failure and show it) and **Submit to Registrar Head** (disabled until every pending row has a saved `subject_id`, label says how many are left; calls the bulk endpoint; on success shows how many were sent and closes the panel).
- API errors are shown from `error.fieldErrors` (the first message) like the old dialog.

**Tests (panel):** pre-selects the top suggestion with a Suggested badge and **does not** PATCH until Confirm (assert no PATCH on render); Confirm sends `{subject_id, credited_units}`; two rows with the same top suggestion do not both pre-select it; Confirm all suggested PATCHes each unconfirmed pre-selected row once; Submit is disabled with a count until all pending rows are confirmed, then calls the submit endpoint once; No equivalent needs a reason and sends the decline; a returned row shows the Head's reason; read-only rows have no buttons; an API refusal is shown and the panel stays open; a11y (axe). **Tests (workspace):** groups students, opens the panel, other roles unauthorized, record-a-credit and TOR cards still work (keep the existing tests for those, rewritten to the new queue).

### Task 8: The Registrar Head's workspace and the Staff table

**Files:** `registrar-head-credit-review-workspace.tsx` (+ test), `registrar-records-workspace.tsx` (+ test), `module-registry.tsx`

**Behavior**
- `RegistrarHeadCreditReviewWorkspace`: only for `registrar_head`; lists students with `endorsed` credits (`per_page: 100`, grouped), each with the count and a **Review** button; the review view shows the student's endorsed rows side by side (left `CreditEntryCell`, right the mapped `CODE — title` and units), plus per row **Return** (reason required, sends `{action: "return", reason}`) and **Reject** (reason required), and a student-level **Approve all (N)** that calls the bulk endpoint. Rows that are not `endorsed` are not shown on the Head's queue. Success and API refusals are shown inline.
- `RegistrarRecordsWorkspace` returns to Registrar Staff only: remove `isRegistrarHead`, `canDecideCredits`, the Return button and the `return` branch (the Head no longer uses this component); Staff keep the read-only credits table with the Slice 1 description for Staff. Its test file drops the Head tests (moved to the new component's tests) and keeps the Staff and other-module tests; "keeps every module closed to the Registrar Head" now covers `credit-mappings` too.
- `module-registry.tsx` `CreditMappingsModuleRouter`: `program_chair` → chair workspace, `registrar_head` → the new workspace (lazy), everything else → `RegistrarRecordsWorkspace`.

**Tests:** lists students with endorsed credits only; Approve all calls the endpoint once and refreshes; Return needs a reason and sends it; Reject needs a reason; another role is unauthorized (no fetch); axe.

### Task 9: Verification, review and hand-off

- [ ] Backend: the new `StudentCreditMappingEndpointTest`, `TransfereeCreditsEndpointTest`, `ApiSurfaceTest`, `EvaluateCreditMappingStatusTest` (private DB); then the **full backend suite once, alone** (about 31 minutes).
- [ ] Frontend: the changed test files, `tsc --noEmit`, ESLint on the changed files, then the **full frontend suite** (about 14 minutes).
- [ ] Whole-slice review by one fresh reviewer on the most capable model (read-only), against the Review Focus above; re-grade, fix Critical/Important with a failing test first, ledger the rest.
- [ ] Real-browser pass on a private stack (scratch DB on :3310, own `php -S` backend :8001, production build :3100): a student with five subjects; the Chair opens the side-by-side screen (suggestions pre-selected, nothing saved on reload), confirms, uses No equivalent on one, sends to the Registrar Head; the Head opens his workspace, returns one row, approves the rest with Approve all; the Chair re-confirms and re-sends; the Head approves; Staff see the read-only table. Clean up as in Slice 1.
- [ ] `PROGRESS.md` entry (state, counts, rulings, deferred minors), memory note, ledger.
