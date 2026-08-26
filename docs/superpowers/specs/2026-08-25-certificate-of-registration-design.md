# Certificate of Registration (COR) design

## Decision

Certificate of Matriculation (COM) and Certificate of Registration (COR) are
the same GRC enrollment artifact. The system will use the single canonical
`cor` document type and `COR` document-number prefix; no separate COM artifact
will remain. A COR is created only after an enrollment payment is confirmed by
Accounting. Draft, Registrar-pending, and unpaid enrollments have no COR.

## Lifecycle and historical records

- The existing idempotent payment-confirmation transaction creates exactly one
  COR per enrollment, alongside its payment record and enrollment transition.
- A reversible migration renames existing `com` document rows and their
  `COM`-prefixed numbers to the canonical COR representation.
- An audited, idempotent backfill creates a COR for every previously paid,
  enrolled enrollment without one. It may only use the authoritative current
  related records that exist locally; historical COM records currently contain
  no document-content snapshot, so the system must not claim unavailable data
  was captured from an original printout.
- Each newly generated or backfilled COR stores an immutable structured
  snapshot and content hash. Later schedule, subject, assessment, or profile
  changes cannot rewrite a prior COR.

## COR content and print layout

The Student/Cashier viewer renders an A4, fixed-format, accessible printable
COR based on the supplied GRC reference:

1. **Page one:** GRC identity and document title; student and academic-term
   details; subject code, name, unit, section, schedule ID, schedule, and room
   table; total units; admission certification; tuition assessment; itemized
   other fees; total other fees; and grand total.
2. **Page two:** the supplied withdrawal terms, student acknowledgement and
   signature line, Cashier line populated from the payment confirmer, and an
   unsigned Registrar line for the authorized physical/digital signature
   process.
3. The snapshot uses exact authoritative data from the enrollment, section,
   assessment, payment, academic term, program, and student profile. Missing
   production data is shown as `Not provided`, never fabricated.
4. Local test fixtures use the clearly fictional address `123 Test Drive,
   Caloocan City`; no invented address is persisted as a real student record.

## Access and APIs

- Students can list and view only their own CORs.
- Accounting Staff can search/view COR history for students, including prior
  paid enrollments, but cannot alter COR content.
- Registrar Head and Registrar Staff retain permitted all-record access.
- The document list remains lightweight. A policy-protected detail endpoint
  returns the immutable COR snapshot for viewing and printing; no storage path
  or unrelated student data is exposed.
- Frontend services remain the only place making API calls. Zod schemas cover
  list and detail responses, and TanStack Query keys include the authorized
  viewer plus document ID.

## Frontend experience

- Rename the Student portal module from **Digital COM** to **Certificate of
  Registration** and show a chronological list of the student's CORs with a
  View/Print action.
- Add an Accounting **COR records** workspace with student-number search,
  history results, selected-document preview, and the same printable A4 view.
- Preserve the existing payment queue. Its confirmation text and result
  reference COR, and the new COR is visible after the successful payment
  response/refetch.
- The print surface hides portal navigation and controls, has repeatable table
  headers, prevents row splitting where feasible, and retains explicit status
  and accessible document headings on screen.

## Verification

- Backend tests: payment generation is idempotent and produces COR; legacy
  conversion/backfill is idempotent; snapshot is immutable; Student ownership,
  Cashier history access, Registrar access, and unauthorized denials hold.
- Frontend tests: renamed Student module, COR detail rendering, print control,
  Cashier search/history/view, loading/empty/error states, and accessibility.
- Render an actual representative COR to PDF/PNG and visually verify both A4
  pages for table alignment, fee totals, page break behavior, and signature
  lines. Use fictional fixture data only.

## Scope boundaries

This change does not make a COR available before Cashier payment confirmation,
does not fabricate production student data, and does not create a second COM
document type. No signature image, upload, cryptographic signing, or external
PDF storage is introduced; printing is performed from the protected immutable
snapshot in the existing SPA print workflow.
