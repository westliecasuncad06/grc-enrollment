# Student Records and Account Setup Data Dictionary

**Database:** MariaDB 10.4.32 (`grc_enrollment` / `grc_enrollment_test`), per ADR 0007.

**Owning logical store:** PRD `STUDENT RECORDS`. This slice covers Admission provisioning and corrections, Student self-service profile reads, initial password setup, and Admission-approved profile change requests. Enrollment and academic-history fields remain documented in `enrollment-records.md`.

## Security and lifecycle rules

- Admission creates the Student `users` row and `student_profiles` row in one database transaction only after attesting that requirements were submitted.
- A new account is `disabled` with a server-generated hidden password until the Student successfully uses the emailed one-time setup code. The API never accepts or returns an initial password, setup code, or reset-token value.
- Curriculum is resolved from `program_id` plus `entry_year`; clients cannot select or override `curriculum_id`.
- Invitation delivery runs after commit. A delivery failure leaves the single pending account intact and records a resendable failed state. Resend replaces the prior code.
- Laravel's password broker stores only the hashed code and applies the configured 60-minute expiry. Successful setup is single-use, activates the account, replaces the hidden password, and deletes the code.
- Existing accounts are backfilled with `account_setup_completed_at` so this migration never disables working users.
- Students may propose only name, email, and complete address changes. The official record is unchanged until Admission verifies identity in person and approves the complete request atomically.
- Admission direct corrections require a reason and in-person verification. Academic setup fields are editable only before the first enrollment; curriculum and academic standing are never directly editable.
- Audit rows contain action metadata and changed field names/counts, not name, email, address, reason text, decision-note text, passwords, or setup codes.

## `users` additions

| Column | Type | Constraints | Producer / consumer | Sensitivity and notes |
|---|---|---|---|---|
| `account_setup_completed_at` | `TIMESTAMP` | nullable | Set by account activation; read by login and Student Records | Account lifecycle metadata. `null` means initial setup is still pending. |
| `account_setup_invitation_sent_at` | `TIMESTAMP` | nullable | Set after successful mail delivery; read by Admission | Delivery metadata; contains no email content or code. |
| `account_setup_invitation_failed_at` | `TIMESTAMP` | nullable | Set after failed mail delivery; read by Admission | Delivery metadata used to expose the resend action. |

The existing `users.status` remains the login enforcement field: pending setup accounts are `disabled`; successful setup changes it to `active`.

These three columns are shared, role-agnostic infrastructure — not Student-specific despite living alongside the Student Records slice. Program Chair's Faculty invitations (`InviteFacultyAccount`/`ActivateFacultyAccount`) and Registrar Head's staff invitations spanning every other non-Student role (`InviteStaffAccount`/`ActivateStaffAccount`, `UserRole::registrarInvitableCases()`) read and write the exact same three columns on `users`, following the same disabled-until-activated lifecycle. Unlike Admission's Student flow, both of those invite with only an email (plus, for staff, a role); the invitee supplies their own name when redeeming the setup code.

## `student_profiles` additions

| Column | Type | Constraints | Producer / consumer | Sensitivity and notes |
|---|---|---|---|---|
| `address` | `TEXT` | nullable for migration compatibility | Admission provisioning/direct correction or approved Student request; Student Information and future COR snapshots | Personal contact data. Required for newly provisioned accounts; existing rows may display `Not provided`. Multiline printable value. |
| `requirements_verified_at` | `TIMESTAMP` | nullable | Set during Admission provisioning | Evidence that Admission confirmed submitted requirements; not a document checklist. |
| `requirements_verified_by` | `BIGINT UNSIGNED` | nullable FK → `users.id`, `NULL` on staff deletion | Set during Admission provisioning | Admission actor responsible for the attestation. |
| `student_type` | `VARCHAR(255)` | nullable, enum values `freshman`/`transferee` (`App\Domain\Identity\StudentType`) | Required at Admission provisioning; editable pre-enrollment correction only | Whether the student entered as an incoming Freshman or a Transferee from another institution. Informational only — does not itself grant `TransfereeCredit` rows; Registrar staff still record those separately. Nullable at the DB level so pre-existing/seeded rows are unaffected. |

The established fields `entry_year`, `program_id`, `curriculum_id`, `year_level`, `enrollment_category`, `financial_status`, and `admission_status` remain part of the profile. `academic_setup_editable` is an API-derived boolean (`false` once any enrollment exists), not a stored column.

Future COR snapshots copy the current approved `student_profiles.address`. Existing COR snapshot JSON is immutable and is never rewritten after a profile change.

## `password_reset_tokens`

Laravel password-broker storage is also used for initial Student account setup.

| Column | Type | Constraints | Producer / consumer | Sensitivity and notes |
|---|---|---|---|---|
| `email` | `VARCHAR(255)` | primary key | Invitation sender and account setup action | Identifies the pending account; one current code per email. |
| `token` | `VARCHAR(255)` | not null | Laravel password broker | One-way hash only; never serialized or logged. |
| `created_at` | `TIMESTAMP` | nullable | Laravel password broker | Used to enforce the configured 60-minute expiry. |

## `student_profile_change_requests`

| Column | Type | Constraints | Producer / consumer | Sensitivity and notes |
|---|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | primary key, auto-increment | API resource identifier | |
| `student_id` | `BIGINT UNSIGNED` | FK → `student_profiles.id`, cascade delete | Owning Student and Admission review | Ownership boundary. Indexed with `status`. |
| `requested_first_name` | `VARCHAR(255)` | not null | Student request/revision; Admission comparison/decision | Proposed personal data; does not change `users.first_name`/`users.name` until approval. |
| `requested_middle_initial` | `VARCHAR(10)` | nullable | Student request/revision; Admission comparison/decision | Proposed personal data; optional. |
| `requested_last_name` | `VARCHAR(255)` | not null | Student request/revision; Admission comparison/decision | Proposed personal data. |
| `requested_suffix` | `VARCHAR(20)` | nullable | Student request/revision; Admission comparison/decision | Proposed personal data; optional. |
| `requested_email` | `VARCHAR(255)` | not null | Student request/revision; Admission comparison/decision | Proposed personal data; uniqueness is rechecked at approval. |
| `requested_address` | `TEXT` | not null | Student request/revision; Admission comparison/decision | Proposed personal data. |
| `reason` | `TEXT` | not null | Student request/revision; Admission review | User-provided sensitive context; deliberately excluded from audit payload values. |
| `base_profile_updated_at` | `TIMESTAMP` | not null | Captured on create/revision; checked on approval | Optimistic stale-request guard. |
| `status` | `VARCHAR(255)` | not null | Request workflow | `pending`, `approved`, `rejected`, or `cancelled`. One pending request per Student is enforced by transactional application logic. |
| `decided_by` | `BIGINT UNSIGNED` | nullable FK → `users.id`, `NULL` on staff deletion | Admission decision | Admission actor who approved or rejected. |
| `decision_notes` | `TEXT` | nullable | Admission decision; Student status view | Required for rejection; excluded from audit payload values. |
| `identity_verified_at` | `TIMESTAMP` | nullable | Admission decision | Evidence of in-person verification. |
| `decided_at` | `TIMESTAMP` | nullable | Approval, rejection, or cancellation | Workflow completion time. |
| `created_at`, `updated_at` | `TIMESTAMP` | nullable | Laravel timestamps | `created_at` is indexed with `status`. |

## API ownership and serialization

- `GET /api/v1/student-profile` and Student change-request operations resolve ownership from the Sanctum bearer identity; Students cannot supply another Student ID.
- Admission-only `/api/v1/student-profiles` routes support paginated name, student-number, and email search, verified corrections, and invitation resend.
- `StudentProfileResource` serializes approved identity/contact fields (the composed `name` alongside the split `first_name`/`middle_initial`/`last_name`/`suffix` — clients edit the parts, never the composed string), program/curriculum labels, permitted status labels, requirements time, academic editability, and delivery/setup state. It never serializes credential or token fields.
- Change-request resources show official and proposed identity/contact groups, each with the same composed-plus-split name shape, so clients do not present pending values as already official.
- Approvals and rejections notify the owning Student. Authorization is enforced by policy in addition to route middleware where applicable.

## Retention and reversibility

Official profile data is retained with the Student record under the institution's general records policy. Change requests are retained as decision history unless an approved retention policy later requires archival or deletion. Setup codes are temporary authentication material: expired values are rejected and successful setup or resend invalidates the prior code.

Migration `2026_08_26_000001_add_student_record_and_account_setup_fields.php` reverses the three User columns, the three Student-profile fields, and `password_reset_tokens`. Migration `2026_08_26_000002_create_student_profile_change_requests_table.php` drops the request table. Migration `2026_08_27_000001_add_student_type_to_student_profiles.php` drops `student_type`. Rollback does not attempt to restore already delivered emails or external mail-provider state.
