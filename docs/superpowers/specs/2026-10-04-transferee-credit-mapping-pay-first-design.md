# Transferee Credit Mapping, Registrar Head Approval and Pay-First Enrollment — Design Spec

**Status:** Design approved by the owner in chat (2026-10-04). This written spec awaits the owner's review; no implementation plan and no code exist yet.
**Related:** ADR 0026 (credit mapping ownership and effect — amended by this work), ADR 0039 (TOR uploads — amended), ADR 0030 (Registrar approval for every enrollment, Program Head for Irregular), ADR 0043 and 0044 (freshman pay-first, public live-queue link), ADR 0042 (student numbers), PRD §3.1, §3.4, §3.8, FR-FIN-003, PRD §17 (official grade equivalence, still open).
**Branch:** work happens on `main` (AGENTS.md). Nothing is committed or pushed unless the owner asks for a saving point.

## Context

The owner's request (Taglish, paraphrased):

1. A transferee goes to **Admission** with their requirements. Admission creates a **temporary account** so the student can do credit mapping: enter the subjects taken elsewhere (**Subject code, Subject title, Grade, Units, Semester, School year**) and submit them to the **Program Chair**. The system should **read an uploaded file automatically** and fill those fields.
2. The **Program Chair** sees each subject with a per-subject button to map it to the equivalent GRC subject: the student's entry on the **left**, the matching GRC subject on the **right**, with a **searchable dropdown**. The system **auto-populates** the match but the Chair can **still edit** it.
3. When the Chair is done, it goes to the **Registrar Head** for approval; the Head has the option to **review** the mapping. Once the Registrar Head approves, the student is given a **queue number** like a freshman, and sees it in their **email**.
4. After the student **pays**, they **wait only for the Registrar's approval** and are then **Enrolled**.

Owner decisions taken while designing (all in chat, 2026-10-04):

- **Subjects first, payment submits it:** after the credits are approved the student picks subjects on the Enrollment page; the Cashier payment then sends the enrollment to the Registrar. Credited subjects that carry a grade must appear in the **Prospectus**, which is also where Regular or Irregular is determined.
- **Registrar Head only** approves credit mapping (Registrar Staff no longer do).
- **TOR reading happens in the student's browser** (pdf.js and Tesseract OCR, self-hosted).
- **Approach A:** extend the existing `transferee_credits` table; no new batch table.

### What exists today (verified in code)

- **Credit mapping is built** (ADR 0026): `transferee_credits`, statuses `pending → endorsed → approved | rejected`; the Student requests, the Program Chair maps and endorses (or declines a `pending` one with a reason), **Registrar Staff** approve or reject an endorsed one (`TransfereeCreditPolicy::decide`; `UpdateTransfereeCredit` notifies `RegistrarStaff`). The Registrar Head is read-only. A Student's request is created `pending` at once and notifies the Chairs one row at a time (`CreateTransfereeCredit`).
- **Suggestions** (`SuggestCreditSubjects`) are computed on demand, per credit, never stored and never written into `subject_id`.
- **TOR upload** (`StudentTorDocument`, ADR 0039) stores a PDF, JPG or PNG privately as evidence only; its decision 1 says the system never reads the file.
- **An approved, mapped credit already counts as credited** (`ResolveCreditedSubjectIds`), and `ClassifyEnrollmentStanding` already treats credited subjects as completed, so Regular or Irregular is already derived from them. `ReclassifyStudentEnrollmentCategory` exists and is already run after a curriculum migration (`ApplyCurriculumMigration`).
- **The enrollment gate** (`EvaluateCreditMappingStatus`): a Transferee is complete when they have at least one credit and none is `pending` or `endorsed`.
- **Freshman pay-first** (ADR 0043 and its 2026-10-04 amendment): a freshman's queue ticket is issued at Admission (`AdmitStudent` → `IssueFreshmanQueueTicket`, `queue_tickets.student_profile_id`, `unique`), a hashed public token drives the no-login live link, the Cashier confirms a first payment (`ConfirmFreshmanPayment`: held as an `account_payments` row with no enrollment, the enrollment is submitted to a block, the Registrar approves, `SettleEnrollmentFromAdvanceCredit` completes it). The ADR's "still open" note was whether this also covers transferees; the owner has now said yes.
- **Enrollment states:** `enrollments.status` is a plain string; `active_academic_term_id` is a stored generated column that is `NULL` only for `rejected`, `cancelled` and `withdrawn`, so a **new non-terminal status needs no migration**. `SubmitEnrollment` reserves seats under row locks at submission and sends an Irregular or overload submission to `pending_program_head_approval` before the Registrar.
- **`ml-service` is aggregate-only and never accepts student-level records**, so it is not a place to read a TOR. Nothing in the repo reads documents today; the backend has dompdf only, and there is no OCR binary on the dev machine.
- **Uncommitted in the working tree:** the whole freshman pay-first work (other sessions). Slice 3 builds on those files.

## Decisions

| Decision | Choice |
|---|---|
| Data model | Extend `transferee_credits` (one row per subject). No new batch table. |
| New statuses | `draft` only. A return is `endorsed → pending` with a reason, not a status. |
| Final approver of credits | **Registrar Head only.** Registrar Staff keep read-only visibility. |
| Auto-populated mapping | Pre-selected in the screen with a "Suggested" badge, **saved only when the Chair confirms**. The API still never writes a guess into `subject_id`. |
| Head's power | Approve all, **return a row** to the Chair with a reason, or reject a row. The Head does not edit a mapping. |
| Temporary account | The existing account setup email a Transferee already gets at Admission. No new account type. |
| Queue number | Issued automatically when the student's **last open credit row closes**. |
| Payment rule | Same as a freshman: at least the configured minimum (PHP 1,000), no promissory note. No new value is invented. |
| Irregular selection | Still goes to the **Program Chair first** (ADR 0030). The payment gate sits **after** that and **before** the Registrar. |
| Credited grade | Shown on the Prospectus as information ("from the previous school"). **Not converted, not in any GWA** (PRD §17 stays open). |
| TOR reading | **Browser only**: pdf.js for a PDF text layer, Tesseract (tesseract.js) for scans and images, all assets self-hosted. Output is an editable draft; nothing is submitted automatically. |
| Scope | Transferee only for pay-first. The draft/submit dialog is shared with Returnee (see "Flags"). Year level is not changed by this work. |

## Slice 1 — Draft, submit and the Registrar Head as approver

### Data

One additive, reversible migration on `transferee_credits`: `submitted_at` (nullable timestamp), `returned_by` (nullable FK to `users`), `returned_at` (nullable timestamp), `return_reason` (nullable text). `status` is a string, so `draft` needs no schema change. `TransfereeCreditStatus` gains `Draft`; `isOpen()` stays `Pending` or `Endorsed` (a draft is not in the workflow).

### Behavior

- **Student adds a row** → `draft`. No notification, no effect on `EvaluateCreditMappingStatus` beyond "you have drafts to submit". A student may edit or delete their own draft (new rules in the policy; audited).
- **`POST /api/v1/transferee-credits/submit`** (Student): every `draft` of the caller becomes `pending` with `submitted_at`, in one transaction under the student's profile lock. One notification to the Program Chairs of the student's college with the row count. Idempotent: a second call finds no drafts and returns 200 with nothing changed. The old rule that a repeated identical request returns the existing row stays for drafts and open rows.
- **`POST /api/v1/students/{id}/transferee-credits/submit-to-registrar-head`** (Program Chair, own college): every `pending` row of that student must be mapped (`subject_id`) or declined with a reason; otherwise 422 listing the rows. Mapped rows become `endorsed` (`endorsed_by`, `endorsed_at`) in one transaction; notifies the **Registrar Head** role (`transferee_credit_endorsed`, now addressed to the Head).
- **Registrar Head** (`TransfereeCreditPolicy::decide` returns true for `RegistrarHead` only): `approve` (single row or all `endorsed` of one student), `reject` (reason), and **`return`** (`endorsed → pending`, sets `returned_by`, `returned_at`, `return_reason`, clears `endorsed_by` and `endorsed_at`, notifies the Chairs). Each step re-checks status under a row lock, like `UpdateTransfereeCredit` today.
- **`EvaluateCreditMappingStatus`:** a Transferee with only drafts is not complete and is told to submit them; otherwise the existing rules apply.
- **Audit:** existing actions plus `transferee_credit.submitted`, `.returned`, `.deleted` (draft).
- **Policy:** Registrar Staff keep `viewAny` and the visibility scope but lose `decide`. Registrar Head gains `decide`.

### Deployment consequence

Rows that are `endorsed` and waiting on Registrar Staff when this ships become the Registrar Head's queue. No data migration is needed; the Head must be told.

## Slice 2 — Program Chair and Registrar Head screens

- **Chair workspace** (`program-chair-credit-mappings-workspace.tsx`, reshaped): one student at a time. A table with **left** the student's entry (code, title, grade, units, school year, semester, source school, and a button that opens the student's TOR file through the existing blob viewer) and **right** the GRC subject in a **searchable combobox** over the student's own curriculum. The top-ranked suggestion is pre-selected with a "Suggested" badge; a row is saved only when the Chair clicks **Confirm** (which sets `subject_id`), or **Confirm all suggested** (an explicit Chair action over the pre-selected rows). Per row: **No equivalent** (decline with a reason). A **Submit to Registrar Head** button for the student, disabled until every row is mapped or declined, with a count of what is left.
- **Bulk suggestions:** `GET /api/v1/students/{id}/transferee-credits/suggestions` returns suggestions for all of a student's open rows in one call (replaces N per-row calls on this screen; the per-row endpoint stays). Same scoring, still advice only.
- **Registrar Head screen:** the same side-by-side layout, **read-only**, with a **Return** (reason) per row, **Reject** (reason) per row, and **Approve all** for the student. A returned row shows "Returned by Registrar Head: reason" to the Chair.
- The existing student dialog (`student-credit-mapping-dialog.tsx`) becomes a draft list with an **Add subject** form (Subject code, Subject title, Grade, Units, Semester, School year, plus the source school) and **Submit to Program Chair**.

## Slice 3 — Queue number, payment, enrollment, Prospectus

### Queue number

When the last open row of a Transferee closes (`approve`, `reject` or a Chair decline) and the profile is a Transferee whose first payment is not confirmed, the system issues the student's queue ticket. `IssueFreshmanQueueTicket` and `SendFreshmanQueueTicketEmail` are generalized (a student-level issuer, guard "pay-first student who has not paid"); the ticket is linked to `student_profile_id`, draws from the open `queue_cycles` row and the `Q%03d` sequence, and `unique(student_profile_id)` makes it idempotent. The student gets an **email with the number and the no-login live link** (ADR 0044) and an in-app notification; the number is also on their Enrollment page. A failed email never stops the ticket (same rule as the freshman).

### Pay-first idempotency key

A new nullable timestamp on `student_profiles` that plays the role `freshman_payment_confirmed_at` plays for freshmen (set once under the profile lock when the first payment is confirmed). The plan chooses the column name and whether to generalize the existing one; it must not rename the freshman column that has already been migrated on the dev database.

### Enrollment

- The student picks subjects on the Enrollment page (credited subjects are already excluded by `BuildEligibleSubjectPool`) and submits. `SubmitEnrollment` is unchanged for seats and overload.
- **A regular-category block submission** goes to the payment hold directly; **an Irregular or overload submission** goes to `pending_program_head_approval` first, as today (ADR 0030).
- The hold is a new non-terminal status **`awaiting_first_payment`** ("waiting for the Cashier"). The Registrar's queue lists only `pending_registrar_approval`, so the Registrar does not see the enrollment before it is paid. No migration is needed (see "What exists today").
- **Cashier:** the ticket shows a **Transferee** badge. The first payment is confirmed through the generalized `ConfirmFreshmanPayment` (renamed or wrapped by the plan): same minimum, no promissory note, the money held as an `account_payments` row with no enrollment, the enrollment moved to `pending_registrar_approval` and `payment_confirmed_at` stamped, the ticket served, the student and the Registrar Staff and Head notified. Idempotent on the new key.
- **Registrar approval** (`registrar_approve`) assesses, then `SettleEnrollmentFromAdvanceCredit` (generalized from "freshman" to "pay-first student") applies the held credit: Enrolled, the COR, one enrolled email.
- If a transferee reaches the Cashier **before** submitting subjects (no enrollment yet), the payment is still accepted and held as credit, and the student is told to choose and submit subjects; the settlement later completes from that credit. This reuses the freshman "held path" unchanged.

### Prospectus and standing

- `ProspectusResource` already lists `transferee_credits`; it adds `source_grade`, `source_school_year` and `source_semester`, and the Prospectus page marks the subject "Credited — grade from previous school" with that grade as information. No conversion, no GWA, no change to grade equivalence.
- Approval of a credit runs `ReclassifyStudentEnrollmentCategory` for that student, so Regular or Irregular is current as soon as the credits count. `ClassifyEnrollmentStanding` itself is unchanged.

## Slice 4 — Reading the uploaded TOR in the browser

- **Where:** a Web Worker in the student's browser. The file never leaves the browser for this step; it is still uploaded as evidence through the existing TOR panel and endpoint (ADR 0039), and the backend never trusts what the browser read.
- **Dependencies (supply-chain review before install, per PRD):** `pdfjs-dist` and `tesseract.js`, both Apache-2.0. The worker, the WebAssembly core and the English traineddata file are **served from our own origin**; no CDN and no third-party script at runtime.
- **Pipeline:** a PDF page with a text layer is read by pdf.js as text items grouped into lines by position. A scanned PDF page or an image is rendered to a canvas and read by Tesseract. Both feed one **row parser**.
- **Row parser:** per line, finds a subject code (letters and digits such as `IT 101` or `CS-101`), the title text, a grade token (1.00 to 5.00, a percentage, or a mark such as INC), and units (a small decimal). A heading such as "S.Y. 2021-2022, 1st Semester" is carried forward to the rows beneath it. Each field it is unsure of is flagged.
- **Output:** **draft rows** marked "Auto-read, please check", with uncertain fields highlighted, in the same editable form the student already uses. The Zod validation on that form applies. Nothing is added to the server until the student saves the draft row, and nothing reaches the Program Chair until they press Submit.
- **Limits, stated plainly:** TOR layouts vary, and OCR on a photo or a poor scan is imperfect. It saves typing; it is not a source of truth, and the Program Chair still checks the actual file. The parser is built and tested on **synthetic** fixtures, because no real TOR may be in the repo. To tune it, the plan needs **two or three redacted sample TORs** from the owner.
- ADR 0039 is amended: decision 1's "the system does not read the file (no OCR)" becomes "the student's browser reads it to prefill editable draft rows only; it is never an automatic credit".

## Flags the owner may overrule

1. **Irregular transferees still need the Program Chair's approval** of their subject selection before the payment hold. This keeps ADR 0030. It adds a step the owner did not mention; removing it changes an institutional rule and is the owner's call.
2. **The new draft and Submit step is shared with Returnee**, because the request dialog is the same. Nothing else about the Returnee route changes.
3. **Year level and placement of a transferee are not changed.** They remain what Admission recorded; Regular or Irregular follows from the credits as today.
4. **Registrar Staff lose approval of credits** and become read-only on them.

## Errors and edge cases

- Submit with no drafts: 200, nothing changes. Submit-to-Head with an unmapped, undeclined row: 422 listing the rows. Approve on a row that is no longer `endorsed`: 422 with the current status (as today).
- A Registrar Head's approval of the last row, the ticket issuance and the notification happen in one transaction; the email goes after commit and its failure is logged, never fatal.
- A transferee whose every row is rejected still closes the mapping and receives a queue number (they then enroll without credits).
- A transferee who has **no rows at all** stays blocked by `EvaluateCreditMappingStatus` exactly as today (a Transferee with zero credits is "not submitted or completed yet"). This work does not add a "nothing to credit" path; if the owner wants one, it is a separate decision.
- Two clicks on any bulk action, or two Cashier requests, change nothing the second time (status re-check under a row lock; the payment key; `unique(student_profile_id)`).
- Seat reservation, queue tickets, payment confirmation and COM generation keep their existing idempotency (AGENTS.md).

## Testing

- **Backend (PHPUnit, each written first):** every transition and its refusal, authorization by role (Chair, Head, Staff read-only), college scope, the submit and return flows, idempotency, notifications addressed to the Head, queue-ticket issuance on the last closing row, the Cashier path for a Transferee (held credit, `awaiting_first_payment` to `pending_registrar_approval`, settlement), the held path, reclassification on approval, the Prospectus fields, and a migration test using the `RollsBackThroughMigration` trait.
- **Frontend (Vitest):** the draft list and Submit, the side-by-side workspace (pre-selected suggestion not saved until Confirm, search, No equivalent), the Head screen (Return, Approve all), the Cashier badge, the Prospectus marker; **parser unit tests on synthetic TOR text and a rendered synthetic PDF and image**.
- **Real-browser pass** for the whole journey on a private backend and scratch database (the recipe in the project memory), because jsdom cannot catch React Compiler or form-reset defects. Full suites run one at a time, each in its own database.

## Out of scope

Retention of TORs, malware scanning, official grade equivalence (PRD §17), Returnee pay-first, a refund or void path for a pay-first payment, changing a transferee's year level, and expiry of an unused queue number.

## Delivery order and dependencies

Slice 1 → Slice 2 → Slice 3 → Slice 4. Slices 1 and 2 touch only the credit-mapping code and can start now. **Slice 3 depends on the freshman pay-first work, which is uncommitted in the working tree and being finished by other sessions** (`ConfirmFreshmanPayment`, `SettleEnrollmentFromAdvanceCredit`, `QueueTicket`, `TransitionEnrollment`); it starts only after that tree is settled, and generalizes those files rather than copying them. Slice 4 is independent and last, so Slices 1 to 3 deliver value without it. Migrations (Slice 1's columns, Slice 3's payment key) are for the owner to run on the dev database and on Hostinger; they are not applied by the code change.
