# Transferee Queue Number, Pay-First Enrollment and Prospectus Implementation Plan (Slice 3 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (the owner chose native execution and said "proceed") to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A transferee whose credit mapping has closed gets a queue number by email (with the no-login live link) and an in-app notice; picks subjects on the Enrollment page and submits them into a payment hold; pays at the Cashier (minimum PHP 1,000, no promissory note); waits only for the Registrar's approval to be Enrolled; their approved credits show on the Prospectus with the grade from the previous school as information, and approval re-derives Regular or Irregular.

**Architecture:** Generalize the freshman pay-first code instead of copying it: a student is "pay-first" when Freshman or Transferee; `student_profiles.freshman_payment_confirmed_at` stays the idempotency key for both (no migration); one new non-terminal enrollment status `awaiting_first_payment` is the hold; the existing Cashier endpoints (`freshman-payment-preview`, `freshman-payment`) accept a transferee; the ticket is issued by the generalized `IssueFreshmanQueueTicket` when the last open credit row closes.

**Tech Stack:** Laravel 12 / PHPUnit 11 / MariaDB; Next.js (client-rendered), TypeScript strict, TanStack Query, Zod, Tailwind, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-04-transferee-credit-mapping-pay-first-design.md` (Slice 3 and Decisions). Earlier slices: `docs/superpowers/plans/2026-10-04-transferee-credit-drafts-and-registrar-head-approval.md` (Slice 1), `docs/superpowers/plans/2026-10-04-transferee-credit-side-by-side-mapping-and-head-review.md` (Slice 2), both implemented.

## Why this plan is condensed

The author is also the executor (native execution, one session): the plan records interfaces, behaviors, test names and the non-obvious decisions, not every line of routine code. Rulings are in the execution ledger.

## Global Constraints

- **No commits and no pushes** (AGENTS.md: only on the owner's explicit request). "Checkpoint" = a `PROGRESS.md` line plus the ledger.
- **No migration.** Reuse `freshman_payment_confirmed_at` as the first-payment key for transferees; `enrollments.status` is a plain string and `active_academic_term_id` is NULL only for rejected/cancelled/withdrawn, so a new non-terminal status needs no schema change. If a task finds it needs one after all, stop and rule in the ledger.
- Bearer-token auth only; `/api/v1`; Policies, Form Requests, Actions, Resources, transactions; **idempotent** payment confirmation, ticket issuance and settlement (a repeat changes nothing and notifies nobody; AGENTS.md).
- Authorization before validation (403 before 422). Resources are built for `preventLazyLoading`.
- **The freshman flow must not change** for freshmen: every existing freshman test stays green unmodified unless the plan names it.
- **Backend tests only on the private MariaDB** (`127.0.0.1:3310`, user `root`, no password), database `grc_enrollment_slice1`, through process env vars `DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_DATABASE` (never the owner's `:3306`); verify the target with tinker before any run that writes.
- Emails leave the building and cannot be rolled back: they are sent after commit, by the controller, and a delivery failure never undoes the ticket or payment (same rule as the freshman).
- Targeted `Edit`s on files other sessions modified (`routes/api.php`, `ApiSurfaceTest.php`, `openapi.yaml`, `PRD.md`, `enrollment-workspace.tsx`, `notification-presentation.ts`, `ConfirmFreshmanPayment.php`, `SettleEnrollmentFromAdvanceCredit.php`, `TransitionEnrollment.php`); whole-file rewrites only on files git shows clean.
- Run Pint on exactly the PHP files changed (never directories), PHPStan on new/rewritten source files, `tsc --noEmit`, ESLint on changed frontend files. Do not reformat lint/format red that already exists at HEAD.
- **Memory is short on this machine** (the harness reaped two background jobs on 2026-10-05): run only one heavy process at a time, never a production build alongside a suite; if a job is reaped, clean up and ask before restarting it.

## Review Focus

1. **Idempotency of the queue number:** closing the last open row twice (two Heads, a double click, approve-all then a single approve) issues exactly one ticket, sends exactly one email, and never a second ticket after the student has paid.
2. **The number is not issued early or to the wrong student:** not while any row is `pending` or `endorsed`, not for a Freshman, Returnee or Existing Student, not for a transferee who already paid, not for a transferee with no submitted credit at all.
3. **The Registrar never sees an unpaid transferee:** `awaiting_first_payment` is absent from the Registrar approval lists and bulk approve-all; only `pending_registrar_approval` is approvable.
4. **An Irregular transferee goes Program Chair first, then the payment hold, then the Registrar** (ADR 0030 order), also through the student-accepts-revision path (ADR 0040).
5. **Paying before choosing subjects is safe:** the payment is held as credit with no enrollment, the student is told to choose and submit subjects, and that later submission goes straight to the Registrar (not back to the hold) and settles from the held credit.
6. **Seats:** a hold reserves seats at submission; `student_cancel`, `void` and rejection from `awaiting_first_payment` give them back exactly once.
7. **A freshman and a transferee never get each other's wording or rules** (the freshman account-setup email is not sent to a transferee at payment; a transferee is not blocked from signing in before paying).

## File Structure

**Backend create** (`backend/app/`)
- `Domain/Enrollment/EnrollmentRouting.php`: `statusAfterReview(StudentProfile): EnrollmentStatus`.
- `Actions/Academic/IssueTransfereeQueueTicket.php`: `whenMappingCloses(StudentProfile, User, AuditRequestContext, ?QueueLinkOutbox): ?IssuedFreshmanQueueTicket`.
- `Domain/Enrollment/QueueLinkOutbox.php`: collects newly issued tickets (with plain tokens) for the controller to email after commit.
- `Actions/Enrollment/SendQueueLinks.php`: drains an outbox through `SendFreshmanQueueTicketEmail`.
- `Mail/TransfereeQueueTicketMail.php` + `resources/views/mail/transferee-queue-ticket.blade.php`.
- Tests: `tests/Unit/Domain/Enrollment/EnrollmentRoutingTest.php`, `tests/Feature/Actions/Academic/IssueTransfereeQueueTicketTest.php`, `tests/Feature/Api/V1/TransfereePayFirstJourneyTest.php`.

**Backend modify**
- `Domain/Identity/StudentType.php` (`isPayFirst`), `Models/StudentProfile.php` (`isAwaitingFirstPayment`), `Domain/Enrollment/EnrollmentStatus.php` (`AwaitingFirstPayment`), `Domain/Notifications/NotificationType.php` (`TransfereeQueueNumberIssued`).
- `Actions/Enrollment/SubmitEnrollment.php`, `TransitionEnrollment.php`, `Http/Requests/Api/V1/Enrollment/UpdateEnrollmentRequest.php`, `BuildStudentQueueView.php`, `BuildPublicQueueView.php`, `IssueFreshmanQueueTicket.php` (guard), `SendFreshmanQueueTicketEmail.php` (mail by type).
- `Actions/Enrollment/ConfirmFreshmanPayment.php`, `PreviewFreshmanPayment.php`, `SettleEnrollmentFromAdvanceCredit.php`; `Http/Controllers/Api/V1/FreshmanPaymentController.php`; `Http/Resources/Api/V1/QueueTicketResource.php` (`is_transferee`), `FreshmanPaymentPreviewResource.php`.
- `Actions/Academic/UpdateTransfereeCredit.php`, `ApproveStudentCredits.php` (issue the ticket, reclassify), `Http/Controllers/Api/V1/TransfereeCreditController.php`, `StudentCreditMappingController.php` (flush the outbox after commit).
- Dashboards that enumerate statuses: `Domain/Dashboard/EnrollmentStatusGroup.php`, `Actions/Dashboard/{BuildEnrollmentStatusOverview,ListStuckEnrollments,EnrollmentStatusPopulation}.php`; `Http/Resources/Api/V1/ProspectusResource.php`.
- Docs: `docs/api/openapi.yaml`, `docs/adr/0043-*.md` (amendment), `docs/adr/0030-*.md` (note), `docs/data-dictionary/*`, `PRD.md`.

**Frontend modify** (`frontend/src/features/`)
- `schemas/` (enrollment status, student-queue stage, queue-ticket `is_transferee`, prospectus credited fields), `lib/notification-presentation.ts`, status label helpers.
- `components/portal/enrollment-workspace.tsx` (queue number, stepper), `accounting-payment-workspace.tsx` + `freshman-payment-dialog.tsx` (Transferee badge and dialog), `components/queue/student-queue-live-panel.tsx` + `components/pages/public-queue-page.tsx` (copy), the Prospectus page.

## Tasks

### Task 1: Pay-first vocabulary and the routing rule
- `StudentType::isPayFirst(): bool` (Freshman, Transferee). `StudentProfile::isAwaitingFirstPayment(): bool` (pay-first and `freshman_payment_confirmed_at === null`); `isFreshmanAwaitingPayment()` stays as is (it also means "no usable account yet").
- `EnrollmentStatus::AwaitingFirstPayment = 'awaiting_first_payment'`, label "Awaiting First Payment", non-terminal.
- `EnrollmentRouting::statusAfterReview(StudentProfile): EnrollmentStatus`: `AwaitingFirstPayment` for a Transferee who has not paid, else `PendingRegistrarApproval`.
- Tests (RED first): `StudentTypeTest` (isPayFirst per case), `EnrollmentStatusTest` (the new case, label, not terminal; the existing every-case loop), `StudentProfile` unit/feature test for `isAwaitingFirstPayment`, `EnrollmentRoutingTest` (transferee unpaid, transferee paid, freshman, returnee).

### Task 2: The payment hold in the enrollment workflow
- `SubmitEnrollment`: the non-program-head status is `EnrollmentRouting::statusAfterReview($student)`; no Registrar notice for the hold, a student notice that says "pay at the Cashier with your queue number".
- `TransitionEnrollment`: `program_head_approve` and `student_accept_revision` targets use the routing rule (dynamic target); `void` and `student_cancel` accept `AwaitingFirstPayment` (seats released through the existing terminal path). `UpdateEnrollmentRequest` mirrors the allowed-from lists.
- `BuildStudentQueueView` stage `awaiting_first_payment`; dashboards/analytics that group or label statuses include it (grouped with Pending Payment).
- Tests (RED first, `TransfereePayFirstJourneyTest`, a section of it): regular transferee block submit goes to `awaiting_first_payment` with seats reserved and no Registrar notice; irregular transferee goes to `pending_program_head_approval`, then program-head approve goes to `awaiting_first_payment`; student-accept-revision likewise; a transferee who already paid submits straight to `pending_registrar_approval`; `student_cancel` and `void` from the hold release seats once; Registrar list excludes the hold; freshman submit unchanged.

### Task 3: The queue number when the last open credit row closes
- `IssueFreshmanQueueTicket` guard: `isAwaitingFirstPayment()`. `IssueTransfereeQueueTicket::whenMappingCloses`: locks the profile; Transferee, unpaid, `EvaluateCreditMappingStatus` complete, no ticket yet; issues the profile-linked ticket; in-app notification `TransfereeQueueNumberIssued`; adds the new ticket to the outbox; a repeat issues nothing.
- Called inside the transaction of `UpdateTransfereeCredit` (`approve`, `reject`, `decline`) and `ApproveStudentCredits`; both take an optional `?QueueLinkOutbox $outbox = null` (existing callers and tests unchanged). Controllers pass an outbox and call `SendQueueLinks` after the action; `SendFreshmanQueueTicketEmail` picks `TransfereeQueueTicketMail` for a transferee.
- Tests (RED first, `IssueTransfereeQueueTicketTest` + endpoint tests): the five Review Focus 1 and 2 cases; all-rejected still gets a number; `Mail::fake` shows one email with the `/queue/live?t=` link after the closing request; a mail failure leaves the ticket; the ticket draws from the open cycle sequence (`Q%03d`).

### Task 4: The Cashier confirms a transferee's first payment
- `ConfirmFreshmanPayment`: accepts any pay-first student. A transferee: money held as credit first; if they have an `awaiting_first_payment` enrollment it moves to `pending_registrar_approval` and gets `payment_confirmed_at`; otherwise it is the held path (student told to choose and submit subjects); ticket served; `freshman_payment_confirmed_at` stamped under the profile lock; student and Registrar Staff/Head notified (reusing `FreshmanAwaitingRegistrarApproval` / `FreshmanAwaitingSection` types, transferee wording). Same minimum, no promissory note.
- `PreviewFreshmanPayment` for a transferee: no block selection; reports their enrollment (status, subjects count, units) and the estimated assessment when it exists. `FreshmanPaymentController`: the account-setup email is only for a freshman. `QueueTicketResource` gains `is_transferee`. `SettleEnrollmentFromAdvanceCredit` accepts pay-first students.
- Tests (RED first): confirm with an awaiting enrollment, confirm with none, repeat is a no-op, below-minimum and promissory refused, a Returnee refused, a non-Accounting actor 403; Registrar approve settles from credit (Enrolled, COR, one enrolled email); the full journey in `TransfereePayFirstJourneyTest` from Head approval to Enrolled.

### Task 5: Reclassify on approval and the Prospectus
- `UpdateTransfereeCredit` `approve` and `ApproveStudentCredits` call `ReclassifyStudentEnrollmentCategory` for the student inside the transaction (only when something was approved). `ProspectusResource` adds `source_grade`, `source_school_year`, `source_semester` for credited subjects; no conversion, no GWA.
- Tests (RED first): approving credits that cover a regular-load flips an Irregular transferee to Regular; the Prospectus JSON carries the three fields and a grade-free subject has nulls; a rejected credit is not listed as credited.

### Task 6: The student's own and the public live view
- `BuildStudentQueueView`: the ticket falls back to the profile-linked ticket while the pay-first student has not paid; stage `awaiting_first_payment` when they hold that enrollment. `BuildPublicQueueView`: a transferee gets `transferee_awaiting_payment` / `transferee_paid` stages.
- Tests (RED first): the view for a transferee with a ticket and no enrollment, with the hold enrollment, after payment; the public view stages; a freshman's views unchanged.

### Task 7: Contracts and documents
- OpenAPI (status enum, stage enums, `is_transferee`, Prospectus fields, the payment endpoints' wording), ADR 0043 amendment ("transferees: yes"), ADR 0030 note (order with the hold), data dictionary (`awaiting_first_payment`, the reused key), PRD lines, `ApiSurfaceTest` only if a route or ability changes.

### Task 8: Frontend contract and labels
- Zod: enrollment status `awaiting_first_payment`, student-queue stage, queue-ticket `is_transferee`, prospectus credited fields; status label helper; `notification-presentation` for `transferee_queue_number_issued` (student → Enrollment).
- Tests (RED first): schema parse of the new values, label, presentation routing.

### Task 9: The student's Enrollment page
- A transferee with a queue number sees it with "Pay at the Cashier"; the stepper shows Credits closed ✓, Queue number, Choose subjects, Payment at the Cashier, Registrar approval, Enrolled; `awaiting_first_payment` is explained; the submit button copy says the enrollment goes to the Cashier first.
- Tests (RED first, `enrollment-workspace.test.tsx`): number shown, stepper states per status, no change for a freshman.

### Task 10: Cashier badge, dialog and live-link copy
- The Cashier sees a **Transferee** badge on the ticket and opens the same payment dialog; the dialog shows the transferee's enrollment summary instead of "first open block". The live panel and public page use neutral or transferee wording by stage.
- Tests (RED first): accounting workspace badge + dialog for `is_transferee`, dialog copy, live panel stages.

### Task 11: The Prospectus marker
- The Prospectus page marks a credited subject "Credited — grade from previous school" with the grade, school year and semester as information only.
- Test (RED first): marker rendered with the grade; none for a normally taken subject.

### Task 12: Verification, review and hand-off
- Focused runs per task; full backend suite once, alone (private DB, background, ~31-49 min, nothing else heavy meanwhile); full frontend suite once (`--maxWorkers=6`); Pint/PHPStan/tsc/ESLint on changed files; one fresh whole-slice reviewer (most capable model, read-only, no test runs) with a review diff built from the working tree; fix Critical and Important findings test-first; real-browser pass of the whole Transferee journey on a private stack only when memory allows (otherwise the lighter route: the owner's running dev server with API calls redirected by Playwright to the private backend, scratch DB); update `PROGRESS.md` (re-grep after), memory notes, ledger.
