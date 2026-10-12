# Full-Payment Discount (10%) With a Registrar Head Override — Design Spec

**Status:** Design approved in chat by the owner (2026-10-11). **This written spec is awaiting the owner's review.** Nothing is implemented. No implementation plan exists yet.
**Related:** ADR 0025 (scholarship discount as an assessment line), ADR 0043 (freshman and transferee pay-first), PRD §5.3 FR-FIN-007 to FR-FIN-009 (payment confirmation, COM, idempotency).

> **Corrections found while planning (2026-10-12), applied below:** (1) The "Registrar Head Fee Settings page" this spec first assumed no longer exists. The `fee-settings` module is in Accounting Staff's list only (`role-capabilities.ts`, `FeeSettingsWorkspace` is `accounting_staff`-only, and `PUT /fee-schedules` is Accounting-only). The discount control therefore gets its **own Registrar Head module, "Payment Discount"**. (2) The frozen percentage for pay-first payments lives on `student_profiles`, next to `freshman_payment_confirmed_at`, not on `account_payments`. (3) The percentage has **at most one decimal place**, because it is stored in the discount line's `quantity` (`decimal(6,1)`). (4) The quote `reason` values are `off`, `scheduled`, `expired`, `scholar`, `no_estimate`. A new **ADR 0046** and PRD / OpenAPI / data-dictionary amendments come with the implementation. (ADR 0044 and 0045 are already taken.)
**Branch:** work happens on `main`. Per `AGENTS.md` nothing is committed or pushed until the owner asks for a GitHub saving point.

## Context

The owner's request (Taglish, paraphrased):

1. Add a **10% discount for full payment**.
2. **Installment has no discount and no extra fee.** The discount is only for students who pay in full.
3. Add an **override** so the percentage and the **validity** of the discount can be edited. Put it with the **Registrar Head**, because every Accounting user is staff and there is no Accounting Head.

Answers given while scoping:

| Question | Answer |
|---|---|
| What is "validity"? | A **date window** (valid from, valid until). |
| Which payment flows? | **All Cashier flows**: returnee/continuing, freshman and transferee. |
| Does it stack with a scholarship? | **No.** A scholar gets the scholarship tier only. |

### What exists today (verified in code)

- **Payment confirmation** (`ConfirmPayment`, `ConfirmPaymentRequest`): an explicit amount must be at least ₱1,000. An amount below the assessment total needs `promissory_note_on_file`. An omitted amount falls back to the assessment total. `payments.enrollment_id` is unique, which is the idempotency anchor.
- **Scholarship** (ADR 0025): one negative `assessment_items` line (`scholarship_discount`, tier in `quantity`), `assessments.total_amount` set to the net, taken from the base of tuition plus miscellaneous (`ScholarshipBase`), applied only while the enrollment is `pending_payment` with no confirmed `Payment`.
- **Pay-first students** (ADR 0043): a freshman or transferee pays at the Cashier **before any assessment exists**. The money is held as credit (`account_payments` with `enrollment_id` null). The assessment is built at Registrar approval (`TransitionEnrollment` runs `AssessEnrollment`, then `SettleEnrollmentFromAdvanceCredit`, in one transaction). The Cashier preview (`PreviewFreshmanPayment`) already shows an estimated total from `AssessEnrollment::estimateTotal`. The minimum first payment is ₱1,000 with no promissory note (`FreshmanPaymentRules`).
- **Fee Settings** (`fee-settings-workspace.tsx`, `FeeScheduleController`) is an **Accounting Staff** module: only that role sees it in the portal and only that role may write fee schedules (the Head can call the read endpoint but has no page). The Head's discount control is therefore a new module (see "Registrar Head override").
- Audit actions live in `AuditAction`. Money is always handled with `bc*` math and rounded half-up to the cent.

## Decisions

| Decision | Choice |
|---|---|
| Meaning of "full payment" | The Cashier collects the **whole net assessment** in one payment. Anything less is an installment. |
| Discount base | The whole assessment (tuition plus miscellaneous), the same base as the scholarship. |
| Installment | No discount and **no extra fee**. The amount due is exactly what it is today. A test locks this. |
| Scholar | No full-payment discount. The test is whether the assessment has a `scholarship_discount` line. The Cashier's Payee/Scholar step (ADR 0025) already keeps that line and the student's classification in sync, since choosing Regular payee removes the line. |
| Where the discount is written | At **payment confirmation**, in the same transaction, as one negative line. It is never on the assessment before the Cashier confirms. |
| Percentage and validity | One settings row: `percentage` (0 to 100, **one decimal**), `valid_from`, `valid_until` (both nullable dates). Created on first read at 10.0 with no dates. 0, or a `valid_until` in the past, turns it off. |
| Who may edit | **Registrar Head only.** Accounting Staff may read. |
| Day boundary | `Asia/Manila` calendar dates, both ends inclusive, the same convention as other school-facing dates. |
| Past records | Editing the setting never changes an assessment, payment or COR that already exists (the COR is immutable). |

## Data model

1. **New table `payment_discount_settings`** (one row): `id`, `percentage` `decimal(4,1)`, `valid_from` `date` null, `valid_until` `date` null, `updated_by` FK to `users` null, timestamps. The default 10.0 comes from `config('fees.full_payment_discount_percentage')`. The row is created on first read if missing (so a restored older dump cannot break payment), mirroring the lazy counter in ADR 0042.
2. **`student_profiles.full_payment_discount_percentage`** `decimal(4,1)` null. Set only when a pay-first Cashier payment is a full payment that carried a discount. It freezes the percentage that was quoted, so a later edit by the Head (or the window closing) cannot change what the student was promised. It lives on the profile because the pay-first payment is exactly once per profile (`freshman_payment_confirmed_at`) and both the Cashier action and the settlement action already hold the profile's row lock.
3. **`AssessmentItemCategory::FullPaymentDiscount`** (`full_payment_discount`). `assessment_items.category` is a string column and `amount` is a signed decimal, so no change is needed there. `ScholarshipBase` must skip this category as well as the scholarship one, so the base is always the undiscounted lines.

Both migrations are reversible, and their rollback tests use the `RollsBackThroughMigration` trait.

## Rules (one domain class)

`App\Domain\Billing\FullPaymentDiscountPolicy` is a pure class with no framework calls except a passed-in date:

- `isActiveOn(CarbonInterface $day)`: percentage greater than 0, `valid_from` null or not after the day, `valid_until` null or not before the day.
- `amountFor(string $base)`: `base × percentage / 100`, half-up to the cent with `bcadd(…, '0.005', 2)`, like every other assessment amount.
- `status(string $day)`: `off`, `scheduled`, `active` or `expired`, from `Y-m-d` strings in the school's calendar.
- A separate action, `QuoteFullPayment`, adds the two reasons the pure class cannot know: `scholar` (the assessment has a scholarship line) and `no_estimate` (a pay-first student with no estimated total yet).

## Returnee and continuing students (assessment exists)

**API.**
- `GET /api/v1/enrollments/{enrollment}/payment-quote` (same policy as confirming payment: Accounting Staff). Returns the assessment `total_amount` and `full_payment` (`applies`, `percentage`, `discount_amount`, `net_total`, `reason`). `net_total` is always what a full payment collects: the discounted amount when a discount applies, otherwise the plain total. The server does the arithmetic so the browser never disagrees on rounding.
- `ConfirmPaymentRequest` gains optional `payment_type` (`full` or `installment`) and, for `full`, `quoted_amount` (the net the Cashier was shown). A `full` request sends no `amount`; the server derives it, and `amount` combined with `full` is rejected. When `payment_type` is absent the request behaves exactly as today with no discount, so older clients and every existing test keep working.

**`ConfirmPayment` (same transaction, same locks).**
- `full`: re-quote under the enrollment lock. If a discount applies, write the `full_payment_discount` line (percentage in `quantity`, like the scholarship tier), set `assessments.total_amount` to the net, and set the `Payment` amount to the net. If `quoted_amount` no longer matches the server's net (the Head changed the setting, or the Cashier corrected a fee, between quote and confirm), reject with 422 so the Cashier reviews the new amount instead of charging the wrong one. If no discount applies, a `full` payment is the undiscounted total, written exactly like an omitted-amount payment today.
- `installment`: unchanged. An explicit amount of at least ₱1,000, and a promissory note when below the total.
- The `Payment` row is still unique per enrollment and checked first, so a repeat call returns what was done and writes nothing (FR-FIN-009). The COR snapshot gets `fees.full_payment_discount` (the lines) and `fees.total_full_payment_discount`, and `grand_total` stays the net, the same shape as the scholarship fields. Snapshots made earlier are untouched.
- Audit: a new `assessment.full_payment_discount_applied` entry (before total, after total, percentage, discount amount), written only when a discount line is created.

**Cashier UI** (`accounting-payment-workspace.tsx`, after the Payee/Scholar step):
- The payment modal offers **Pay in full** and **Installment**. Pay in full shows Assessment, Discount (percentage) and **Net payable** from the quote, and the amount is fixed. Installment keeps today's amount field, the ₱1,000 minimum and the promissory note, and shows no discount and no fee.
- The Pay in full / Installment choice is shown **only when a discount applies**. When none does (`off`, `scheduled`, `expired`, or a scholar), the modal stays exactly as it is today (the amount field pre-filled with the net, partial payments need a promissory note), with a short muted note for the first three ("No full-payment discount is active."). A discount that cannot be checked (the quote request fails) leaves the modal as it is today, with a muted "could not check" note, so the Cashier is never blocked from taking a payment.

## Freshman and transferee (pay-first, assessment not built yet)

This is the riskiest part, so it is deliberately conservative.

- `freshman-payment-preview` gains `full_payment` (percentage, discount amount, discounted estimated total) from the existing `estimateTotal`, or null with a `reason`.
- `POST …/freshman-payment` gains optional `payment_type`. With `full`, the server re-quotes inside the profile lock and the `amount` the Cashier was shown must equal that quote to the cent, or 422 ("the amount due changed"). With `installment` or no `payment_type`, behavior is as today (minimum ₱1,000, no promissory note). A `full` payment is refused (422 on `payment_type`) when there is no estimate to quote.
- A `full` payment that carried a discount saves the quoted percentage on `student_profiles.full_payment_discount_percentage`. It is frozen even if the money stays held because every block is full.
- At Registrar approval, after `AssessEnrollment` and before the settlement `Payment` is written, `SettleEnrollmentFromAdvanceCredit` checks the held credit. **If** the profile carries a frozen percentage **and** the total held credit is at least the discounted net of the **actual** assessment, it writes the `full_payment_discount` line (using the frozen percentage, not today's setting) and lowers the assessment total. **Otherwise** no discount is applied and the payment is simply an installment (any balance shows as usual). This protects the school if the real assessment differs from the estimate, for example a different block with other units, and never invents a discount the money does not cover.
- Idempotency is unchanged: `freshman_payment_confirmed_at` is checked first under the profile lock, and the settlement step finds no held credit on a second run.
- Scholars do not appear in this flow (ADR 0043 has no scholarship step), so no scholar check is needed here.
- Cashier UI: `freshman-payment-dialog.tsx` gets the same Pay in full / Installment choice, shown only when a discount applies. Pay in full fixes the amount at the discounted estimate and shows the discount; Installment keeps the minimum. When no discount applies the dialog is unchanged.

## Registrar Head override

**API** (`PaymentDiscountSettingsController`, `/api/v1/payment-discount-settings`):
- `GET`: Registrar Head and Accounting Staff. Returns `percentage`, `valid_from`, `valid_until`, `status` (`active`, `scheduled`, `expired`, `off`), `updated_by` and `updated_at`.
- `PUT`: **Registrar Head only**, through a Policy (not an inline role check). Form Request rules: `percentage` numeric 0 to 100 with at most one decimal, `valid_from` and `valid_until` nullable `Y-m-d`, `valid_until` on or after `valid_from`. Runs in a transaction. Audit `payment_discount.updated` with before and after. A save that changes nothing writes no audit row, like `FeeScheduleController`.

**UI** (a new Registrar Head module, id `payment-discount`, label "Payment Discount", with its own service module, TanStack Query hook, React Hook Form and Zod schema): a percentage field, a valid-from and a valid-until date field, a status badge, a Save button, and a plain note that already-issued CORs and the held percentages of earlier pay-first payments are not changed. The save button is disabled while the form is unchanged or invalid. Accounting Staff see no new module; the Cashier modal tells them when a discount is active.

## Frontend surfaces and schemas

- `accounting-payment-workspace.tsx` and the Confirm payment modal; `freshman-payment-dialog.tsx`; the new `payment-discount-workspace.tsx`, registered in `role-capabilities.ts` and `module-registry.tsx`; the student-facing payment panel and Statement of Account, which must list the new negative line and the new category value in their Zod schemas (`enrollment-schema.ts`, `enrollment-document-schema.ts`, `statement-of-account-schema.ts`); the printed COR template, which lists the discount above the grand total like the scholarship.
- Every API call stays in a service module and is never made from a rendering component. Strict TypeScript, no `any`.

## Concurrency and idempotency

- Settings are read inside the confirm transaction. The `quoted_amount` check turns a Head edit between quote and confirm into a clean 422, never a wrong charge.
- All writes stay inside existing transactions and lock order (enrollment, assessment lock, items). For pay-first the lock order stays PROFILE then ENROLLMENT then SECTIONS.
- Payment confirmation, the discount line, the held-credit percentage and the settlement are each idempotent as described above.

## Testing

Backend (written first, per the repo's TDD rule):
- `FullPaymentDiscountPolicyTest`: inside, before, after, boundary days, both dates null, percentage 0, 100, half-up rounding.
- Settings endpoint: Registrar Head can PUT, Accounting Staff can only GET, every other role 403, validation (range, decimals, date order), audit before/after, no audit on a no-op save, and a rollback test for both migrations.
- Returnee: full with discount, full outside the window (no discount), full for a scholar (no discount), installment (total and amount unchanged, no extra line, no extra fee), stale `quoted_amount` rejected, repeat confirm idempotent, COR snapshot fields, absent `payment_type` unchanged.
- Pay-first: full payment freezes the percentage, settlement applies it when the credit covers the discounted actual net, falls back to installment when the actual assessment is higher, a later change of the setting does not change a frozen payment, held-while-blocks-full path, repeat settle writes nothing.
- `ApiSurfaceTest`: the new routes.

Frontend: the Cashier modal (both modes, scholar, no active discount), the Freshman dialog, the Head card (form, validation, status badge, disabled states), the schema parsing of the new category, and the COR and Statement lines.

Browser: a real-UI pass of Head edits the discount, Cashier quotes and confirms a full and an installment payment, student sees the line on the COR. Run on the private-backend recipe, never against the owner's live dev server data without asking.

## Documentation

ADR 0046; PRD amendment (new FR-FIN lines and a note under §5.3); `docs/api/openapi.yaml`; the data dictionary entries for the new table and column; `PROGRESS.md` at start, at each milestone and failure, and at the end.

## Out of scope and open items for the owner

- **Refund or clawback** if a student who paid in full with the discount later withdraws or is voided. Decided by the owner on 2026-10-12: only the enrollment process is voided; the payment is not refunded, the discount stays on the paid assessment, and the student does not return to the Cashier. GRC has no refund process.
- **Advance Payment page** account payments are not "full payment" for this feature.
- **Late fees or installment schedules**: not part of this change. Installment keeps today's rules exactly.
- **Retroactive discount** for payments confirmed before this ships: none.

## Handoff notes

- Two migrations are new. The owner's dev server returns 500s on payment screens until `php artisan migrate` is run locally; the handoff will say that first.
- Production deploy is a separate step the owner asks for. The previous deploy (`adcf3a5`) is still waiting on a push, and this work is independent of it.
