# Phase 4 Cross-Cutting Backend and ML Substrate Design

**Date:** 2026-07-29
**Status:** Approved by the user in chat
**Roadmap phase:** Phase 4 — Cross-Cutting Backend & ML Substrate
**Source of truth:** `PRD.md` v3.2 and `PROGRESS.md`

## 1. Purpose

Phase 4 adds the cross-cutting records that later portal and transaction
phases must use from their first write:

- immutable, request-aware audit history for privileged reads and domain
  mutations;
- user-owned notifications with a read-state API;
- the three schema-only analytical result tables required before machine
  learning is implemented in Phase 9; and
- a documented physical mapping for the manuscript's logical
  `HISTORICAL DATA` store.

The phase comes before portal implementation because Phase 5 must be able to
build the notification centre and Registrar Head audit-log screen without
adding backend plumbing. It also prevents Phases 6 and 7 from retrofitting
audit and event history after enrollment, payment, withdrawal, and grade
workflows already exist.

## 2. PRD Traceability

This design implements or prepares the following requirements:

| Requirement | Phase 4 contribution |
|---|---|
| PRD §4.1 | Every schedule transition receives a durable audit entry. |
| FR-SCH-009 | Publishing a schedule notifies its submitting Program Chair and assigned faculty. |
| FR-SCH-010 | Every existing schedule mutation and status transition is audited. |
| FR-FIN-002 | The audit schema can retain the mandatory reason for future rejection, override, void, and forced-status operations. |
| FR-ANL-001/004 | Section-demand and attrition result tables exist before model implementation. |
| FR-ANL-008/009 | Prediction runs can retain lifecycle, version, metric, error, and freshness information. |
| FR-ANL-010/011 | Student-level results have no Phase 4 API and cannot mutate enrollment or academic records. |
| PRD §5.5 | The physical tables contributing to `HISTORICAL DATA` are explicitly mapped. |
| PRD §8.4 | `GET /notifications`, `PATCH /notifications/{notification}/read`, and `GET /audit-logs` are implemented under `/api/v1`. |
| PRD §9.4/9.6 | Notification ownership and Registrar-only audit access are enforced by Policies and route middleware; privileged reads and writes are audited. |
| PRD §10.4 | The five roadmap tables are created through reversible migrations. |
| PRD §11 | Analytical results remain cached, versioned, private, and strictly advisory. |

## 3. Scope

### 3.1 Included

- Five reversible MariaDB migrations:
  `audit_logs`, `notifications`, `prediction_runs`,
  `section_demand_forecasts`, and `attrition_predictions`.
- Eloquent models, relationships, casts, and domain enums needed by those
  tables.
- A request-context value object carrying the assigned request ID and client
  IP address without passing an HTTP Request into domain actions.
- An explicit `AuditRecorder` persistence service.
- Transactional use-case actions for current write endpoints.
- Audit coverage for every current domain mutation.
- Notification creation during schedule publication.
- Authenticated notification listing and mark-as-read APIs.
- Registrar Head–only audit-log listing API.
- OpenAPI, data-dictionary, progress, and operational documentation updates.
- MariaDB-backed migration, model, policy, API, transactional rollback, and
  authorization tests.

### 3.2 Excluded

- Frontend notification or audit-log screens. Phase 5 consumes the APIs.
- Machine-learning models, training, feature extraction, prediction jobs, or
  analytics APIs. These remain Phase 9 work.
- Any change under `ml-service/`.
- Attrition interventions, authorized viewers, or prediction cadence; these
  are unresolved PRD §17 decisions.
- `report_exports`. Compliance exports remain part of roadmap Phase 9.
- Enrollment, payment, withdrawal, COM, and grade workflows. Phases 6 and 7
  will build them on the Phase 4 audit/notification foundation.
- A generic duplicated `historical_data` table or data warehouse.
- Audit-log mutation, deletion, or mark-as-reviewed endpoints.
- Notification deletion or bulk mark-as-read.
- Email, SMS, push, or third-party notification delivery.

## 4. Design Approaches Considered

### 4.1 Explicit transactional actions — selected

Each domain use case owns its database transaction and calls `AuditRecorder`
with the exact action, actor, safe before/after values, reason, request ID, and
IP address. Schedule publication creates notifications inside that same
transaction.

Advantages:

- audit semantics are visible at every write boundary;
- action names and mandatory reasons are precise;
- audit and notification failure roll back the business mutation;
- seeders and unrelated Eloquent writes do not generate accidental audit
  noise; and
- tests can prove one exact audit entry per successful operation.

The cost is more use-case action files. That is acceptable because it moves
business transactions out of controllers and follows PRD §7.2.

### 4.2 Eloquent observers — rejected

Observers would reduce call-site code but make auditing implicit, cannot
reliably infer business action names or transition reasons, and risk auditing
seeders and maintenance commands. Supplying request context through global
state would also make tests and queued work harder to reason about.

### 4.3 Request middleware diffing — rejected

Middleware can see requests and responses but cannot reliably describe
multi-table writes, row-level before/after values, or transaction rollback.
It would record HTTP activity rather than authoritative domain events.

## 5. Database Design

Each table receives its own migration, following the repository's one-table
per migration convention. Migrations use explicit foreign-key delete behavior,
business-uniqueness constraints, and only indexes required by the Phase 4
queries.

### 5.1 `audit_logs`

| Column | Type | Null | Rule |
|---|---|---:|---|
| `id` | `BIGINT UNSIGNED` | no | Primary key. |
| `actor_user_id` | `BIGINT UNSIGNED` | no | FK to `users.id`, `RESTRICT` on delete so an actor cannot disappear while referenced by compliance history. |
| `action` | `VARCHAR(100)` | no | Stable machine-readable event name. |
| `auditable_type` | `VARCHAR(100)` | no | Stable domain type such as `section` or `schedule_proposal`; never a PHP class name. |
| `auditable_id` | `BIGINT UNSIGNED` | yes | Domain record ID; nullable only for collection-level privileged reads. |
| `before_values` | `JSON` | yes | Safe fields before the mutation. |
| `after_values` | `JSON` | yes | Safe fields after the mutation or safe read-filter context. |
| `reason` | `TEXT` | yes | Required by the calling Form Request when the business operation requires it. |
| `request_id` | `VARCHAR(128)` | no | Value assigned by `AssignRequestId`. |
| `ip_address` | `VARCHAR(45)` | yes | IPv4 or IPv6 text from Laravel's trusted request context. |
| `created_at`, `updated_at` | `TIMESTAMP` | yes | Standard Laravel timestamps; application code never updates an audit row. |

Indexes:

- `(auditable_type, auditable_id, created_at)` for record history;
- `(actor_user_id, created_at)` for actor history;
- `(action, created_at)` for event filtering;
- `request_id` for correlation; and
- `created_at` for reverse-chronological pagination.

There is no polymorphic foreign key because `auditable_type` spans multiple
tables and deleted-record history must remain queryable.

### 5.2 `notifications`

| Column | Type | Null | Rule |
|---|---|---:|---|
| `id` | `BIGINT UNSIGNED` | no | Primary key. |
| `user_id` | `BIGINT UNSIGNED` | no | FK to `users.id`, `CASCADE` on delete. |
| `type` | `VARCHAR(100)` | no | Stable notification type. |
| `message` | `TEXT` | no | Human-readable message without secrets or unnecessary student data. |
| `read_at` | `TIMESTAMP` | yes | First successful mark-as-read time; never changed afterward. |
| `created_at`, `updated_at` | `TIMESTAMP` | yes | Standard Laravel timestamps. |

Indexes:

- `(user_id, created_at)` for the user's newest-first list; and
- `(user_id, read_at, created_at)` for unread filtering.

Phase 4 intentionally omits arbitrary JSON payloads, delivery channels, and
notification deletion. The portal can navigate using its known module routes
and the stable `type`.

### 5.3 `prediction_runs`

| Column | Type | Null | Rule |
|---|---|---:|---|
| `id` | `BIGINT UNSIGNED` | no | Primary key. |
| `type` | `VARCHAR(100)` | no | `section_demand` or `attrition`. |
| `academic_term_id` | `BIGINT UNSIGNED` | yes | FK to `academic_terms.id`, `RESTRICT` on delete. |
| `model_version` | `VARCHAR(100)` | no | Model artifact version. |
| `feature_schema_version` | `VARCHAR(100)` | no | Versioned input contract. |
| `status` | `VARCHAR(50)` | no | `queued`, `running`, `succeeded`, or `failed`. |
| `metrics` | `JSON` | yes | Model-specific metric names and numeric values. |
| `error_summary` | `TEXT` | yes | Safe operational failure summary without student data. |
| `started_at` | `TIMESTAMP` | yes | Execution start. |
| `completed_at` | `TIMESTAMP` | yes | Success or failure completion. |
| `created_at`, `updated_at` | `TIMESTAMP` | yes | Standard Laravel timestamps. |

Indexes:

- `(type, status, created_at)` for lifecycle and latest-run queries; and
- `(academic_term_id, type, created_at)` for term-scoped freshness queries.

Phase 4 creates the model and casts but no API, seeder, job, or model-service
integration.

### 5.4 `section_demand_forecasts`

| Column | Type | Null | Rule |
|---|---|---:|---|
| `id` | `BIGINT UNSIGNED` | no | Primary key. |
| `prediction_run_id` | `BIGINT UNSIGNED` | no | FK to `prediction_runs.id`, `RESTRICT` on delete. |
| `academic_term_id` | `BIGINT UNSIGNED` | no | FK to `academic_terms.id`, `RESTRICT` on delete. |
| `subject_id` | `BIGINT UNSIGNED` | no | FK to `subjects.id`, `RESTRICT` on delete. |
| `predicted_demand` | `DECIMAL(10,2)` | no | Non-negative forecasted student demand. |
| `suggested_section_count` | `SMALLINT UNSIGNED` | no | Advisory section count. |
| `confidence_lower` | `DECIMAL(10,2)` | yes | Optional lower uncertainty bound. |
| `confidence_upper` | `DECIMAL(10,2)` | yes | Optional upper uncertainty bound. |
| `created_at`, `updated_at` | `TIMESTAMP` | yes | Standard Laravel timestamps. |

Business uniqueness:

- unique `(prediction_run_id, academic_term_id, subject_id)`.

Database checks:

- `predicted_demand >= 0`;
- nullable confidence bounds are non-negative; and
- when both bounds exist, `confidence_upper >= confidence_lower`.

The row is advisory context only. It cannot create, publish, dissolve, or
resize a section.

### 5.5 `attrition_predictions`

| Column | Type | Null | Rule |
|---|---|---:|---|
| `id` | `BIGINT UNSIGNED` | no | Primary key. |
| `prediction_run_id` | `BIGINT UNSIGNED` | no | FK to `prediction_runs.id`, `RESTRICT` on delete. |
| `student_id` | `BIGINT UNSIGNED` | no | FK to `student_profiles.id`, `RESTRICT` on delete. |
| `risk_probability` | `DECIMAL(5,4)` | no | Probability represented from `0.0000` through `1.0000`. |
| `risk_band` | `VARCHAR(50)` | no | Version-controlled output label supplied by the future model contract. |
| `explanations` | `JSON` | yes | Approved plain-language factors; no automatic action instructions. |
| `created_at`, `updated_at` | `TIMESTAMP` | yes | Standard Laravel timestamps. |

Business uniqueness:

- unique `(prediction_run_id, student_id)`.

Database check:

- `risk_probability BETWEEN 0.0000 AND 1.0000`.

There is no Phase 4 route, Resource, Policy, or frontend access to this table.
Phase 9 must define authorized viewers after GRC resolves the PRD §17
attrition-intervention decision.

## 6. Domain Types and Models

The following enums prevent duplicated string vocabularies:

- `PredictionType`: `section_demand`, `attrition`;
- `PredictionRunStatus`: `queued`, `running`, `succeeded`, `failed`; and
- `NotificationType`: initially `schedule_published`.

`AuditLog::action` remains a string backed by named constants in the audit
action catalog because future phases will add many event names. The catalog
rejects ad-hoc action spelling while avoiding one continually expanding PHP
enum tied to every domain.

Models cast:

- all JSON fields to arrays;
- `read_at`, run lifecycle timestamps, and model timestamps to immutable
  datetimes;
- forecast decimals and risk probability to fixed-point strings, never
  floating-point values; and
- prediction type/status and notification type to their enums.

Relationships are added in both directions only when Phase 4 code uses them.
No speculative relationship or query scope is introduced.

## 7. Request Context and Audit Recorder

### 7.1 `AuditRequestContext`

An immutable value object contains:

- `requestId: string`;
- `ipAddress: ?string`.

`AuditRequestContextFactory::fromRequest(Request $request)` reads the request
ID through `AssignRequestId::getOrCreate()` and the trusted Laravel client IP.
Controllers construct this HTTP-boundary value and pass it to use-case
actions. Domain actions do not depend on `Illuminate\Http\Request`.

### 7.2 `AuditRecorder`

The recorder accepts:

- authenticated actor;
- stable action name;
- stable auditable type and optional ID;
- safe before and after arrays;
- optional reason; and
- `AuditRequestContext`.

It creates one `AuditLog` on the caller's active database connection. It does
not open or commit its own transaction. The owning use-case action controls
the business transaction so audit failure rolls back the domain mutation.

The recorder rejects:

- an empty action or auditable type;
- an empty request ID;
- password, token, password-confirmation, or authentication-secret keys in
  before/after payloads; and
- a blank reason when a non-null reason is supplied.

## 8. Existing Mutation Audit Matrix

Every successful current domain mutation receives explicit coverage.
Authentication token creation/revocation and `last_login_at` are excluded:
they are session mechanics, not the Phase 4 domain-write retrofit.

| Existing operation | Audit action | Auditable type | Required captured values |
|---|---|---|---|
| Create curriculum and graph | `curriculum.created` | `curriculum` | Safe curriculum fields plus subject/prerequisite IDs. |
| Update curriculum and replace graph | `curriculum.updated` | `curriculum` | Safe before and after curriculum graph summaries. |
| Create faculty availability | `faculty_availability.created` | `faculty_availability` | Term, day, start, end, professor ID. |
| Update faculty availability | `faculty_availability.updated` | `faculty_availability` | Changed safe fields before and after. |
| Delete faculty availability | `faculty_availability.deleted` | `faculty_availability` | Full safe row in `before_values`; `after_values` null. |
| Create faculty preference | `faculty_subject_preference.created` | `faculty_subject_preference` | Professor, term, subject, rank. |
| Update faculty preference | `faculty_subject_preference.updated` | `faculty_subject_preference` | Changed safe fields before and after. |
| Delete faculty preference | `faculty_subject_preference.deleted` | `faculty_subject_preference` | Full safe row in `before_values`; `after_values` null. |
| Create section | `section.created` | `section` | Term, subject, section code, professor, schedule, capacity, threshold, status. |
| Update section | `section.updated` | `section` | Changed safe fields before and after. |
| Create schedule proposal | `schedule_proposal.created` | `schedule_proposal` | Term, submitter, status. |
| Dean approve | `schedule_proposal.dean_approved` | `schedule_proposal` | Status and decision fields before and after. |
| Dean return | `schedule_proposal.dean_returned` | `schedule_proposal` | Status and decision fields; reason required. |
| Executive approve | `schedule_proposal.executive_approved` | `schedule_proposal` | Status and decision fields before and after. |
| Executive return | `schedule_proposal.executive_returned` | `schedule_proposal` | Status and decision fields; reason required. |
| Publish proposal | `schedule_proposal.published` | `schedule_proposal` | Proposal transition and published section IDs. |
| Publish each planned section | `section.published` | `section` | Status before and after for every changed section. |
| Close proposal | `schedule_proposal.closed` | `schedule_proposal` | Status and decision fields before and after. |
| Provision student account/profile | `student_profile.provisioned` | `student_profile` | New IDs, role, program, curriculum, year level, admission status, standing. Never name, email, or password. |
| List audit logs | `audit_log.list_viewed` | `audit_log` | No auditable ID; safe filter names and pagination values only. |

Unsuccessful authorization, validation, or state-transition requests create
no domain audit row because no authoritative domain operation occurred.
Security logging for repeated rejected access remains structured application
logging rather than a fabricated business event.

## 9. Transaction Refactoring

Current controllers perform several writes directly. Phase 4 moves those
mutations into focused use-case actions so controllers continue to
authenticate, authorize, invoke one use case, and return a Resource.

Each action:

1. receives validated scalar data, authenticated actor, and audit context;
2. begins one database transaction;
3. loads a safe before snapshot when applicable;
4. performs the domain mutation;
5. writes the exact audit row;
6. creates notifications when the use case requires them; and
7. returns the refreshed domain model.

Curriculum creation/update must include both the curriculum row and its
full-replace subject/prerequisite graph in one transaction. Student account
and profile provisioning remains one transaction and adds its audit row to
that boundary. Schedule publication keeps proposal transition, section
publication, per-section audit entries, proposal audit, and notifications in
one transaction.

## 10. Notification Behavior

### 10.1 Schedule publication

When an Executive Director successfully publishes a proposal:

- each unique faculty user assigned to a newly published section receives one
  `schedule_published` notification;
- the proposal's submitting Program Chair receives one
  `schedule_published` notification;
- a person appearing in both sets receives only one notification; and
- no notification is created for a null professor assignment.

The message identifies the academic term without including student data. It
does not claim a teaching assignment beyond what the published section
already records.

The proposal state machine already permits `publish` exactly once from
`executive_approved`, so a repeated request cannot create duplicate
notifications. The transaction also prevents partial recipients.

Future phases explicitly add notifications for enrollment submission,
Registrar decisions, payment confirmation, COM generation, withdrawals, and
grade lifecycle events. Phase 4 does not invent those messages early.

### 10.2 Mark as read

Mark-as-read is idempotent:

- the first successful request sets `read_at`;
- later requests by the same owner return the same original timestamp; and
- any other user receives `403` without learning notification contents.

## 11. API Design

All routes use `auth:sanctum`, `EnsureUserIsActive`, the existing authenticated
throttle, bearer tokens, JSON Resources, the standard error envelope, and
`Cache-Control: no-store, private`.

### 11.1 `GET /api/v1/notifications`

Authorization:

- every authenticated active user may list only their own notifications.

Query parameters:

- `unread_only`: optional boolean, default `false`;
- `per_page`: optional integer from 1 through 100, default 20; and
- `page`: standard positive paginator page.

Ordering:

- `created_at DESC`, then `id DESC`.

Response:

- paginated `NotificationResource` collection preserving links and metadata;
- fields: `type`, `id`, `notification_type`, `message`, `read_at`,
  `created_at`; and
- no `user_id`, because ownership is already the authenticated context.

### 11.2 `PATCH /api/v1/notifications/{notification}/read`

Authorization:

- notification owner only, enforced by `NotificationPolicy`.

Request body:

- no fields.

Response:

- `200` with the updated `NotificationResource`;
- unchanged data and timestamp on retry;
- `401` unauthenticated;
- `403` authenticated non-owner; and
- `404` unknown ID.

### 11.3 `GET /api/v1/audit-logs`

Authorization:

- Registrar Head only through `role:registrar_head` middleware and
  `AuditLogPolicy::viewAny()` defense in depth.

Query parameters:

- `action`: optional exact stable action;
- `auditable_type`: optional exact stable type;
- `actor_user_id`: optional existing user ID;
- `from`: optional ISO date;
- `to`: optional ISO date, inclusive through the end of the date;
- `per_page`: optional integer from 1 through 100, default 20; and
- `page`: standard positive paginator page.

Ordering:

- `created_at DESC`, then `id DESC`.

Response:

- paginated `AuditLogResource` collection;
- actor ID and role label, but no email;
- action, auditable type/ID, safe before/after data, reason, request ID, IP,
  and timestamp; and
- no mutation links.

After the paginator query is materialized, the request records
`audit_log.list_viewed` with safe filter/pagination context. That read event
does not appear in the already-materialized response page.

## 12. Authorization and Privacy

- Notification queries always begin with the authenticated user's
  relationship; route binding alone never grants ownership.
- Audit-log access is restricted to Registrar Head, matching PRD §3.7.
- No Phase 4 route exposes prediction tables.
- No audit payload stores passwords, password confirmation, bearer tokens,
  hashes, full contact data, or unnecessary student identifiers.
- IP addresses appear only in the Registrar-only audit API.
- Prediction explanations must remain approved, plain-language, and
  non-punitive when Phase 9 writes them.
- Predictions never create an enrollment decision, schedule mutation,
  withdrawal, disciplinary action, or public student label.
- All protected responses use no-store private caching.

## 13. Error and Failure Handling

- Migration failures leave Laravel's migration transaction state visible and
  do not suppress database errors.
- If a domain mutation succeeds but its audit insert fails, the entire domain
  transaction rolls back.
- If any publication notification fails, proposal status, section statuses,
  all audit rows, and all notifications roll back together.
- A failed or unauthorized request creates no notification and no domain
  audit row.
- Invalid list filters use the standard `422 VALIDATION_FAILED` envelope.
- Unknown resources use the standard `404 NOT_FOUND` envelope.
- Unauthorized role or ownership checks use `403 FORBIDDEN`.
- Audit responses never expose raw database exceptions.
- Prediction error summaries are safe operational summaries, not stack traces
  or student feature payloads.

## 14. `HISTORICAL DATA` Physical Mapping

The manuscript's `HISTORICAL DATA` store is a logical analytical domain, not a
single duplicate table. Phase 4 records the following mapping:

| Historical data category | Physical source |
|---|---|
| Academic-term boundaries | `academic_terms` |
| Planned and published capacity, threshold, professor, and timetable history | `sections`, `schedule_proposals`, `audit_logs` |
| Faculty constraints and preferences | `faculty_availabilities`, `faculty_subject_preferences`, `audit_logs` |
| Enrollment volume and selection history | `enrollments`, `enrollment_subjects` after Phase 6 writes them |
| Prerequisite outcomes and final academic results | `academic_grades`, `transferee_credits` after Phases 6–7 write them |
| Payment, queue, and completion timing | `queue_tickets`, `payments`, `enrollment_documents` after Phase 7 |
| Withdrawal labels and reasons | `withdrawal_requests` after Phase 7 |
| Behavioral event history and state changes | `audit_logs` |
| Model execution metadata and evaluation | `prediction_runs` |
| Approved analytical outputs | `section_demand_forecasts`, `attrition_predictions` |

Phase 9 will construct reproducible, versioned feature snapshots from these
authoritative sources. It must not train directly from mutable production
queries without recording the data period, feature schema version, exclusions,
and evaluation metadata required by PRD §11.3.

## 15. Testing Strategy

Implementation follows red-green-refactor. Production behavior is not written
before a failing test proves the required change.

### 15.1 Migration tests

- each table has the exact columns, types, nullability, indexes, and foreign
  keys above;
- business-uniqueness constraints reject duplicates;
- delete behavior preserves audit/analytics history and cascades user-owned
  notifications;
- all five migrations roll back and re-run against MariaDB 10.4.32; and
- migration order satisfies every foreign-key dependency.

### 15.2 Model tests

- enum, immutable datetime, JSON array, and fixed-point decimal casts;
- relationships used by the APIs and publication action;
- notification unread/read state behavior; and
- audit rows have no update or delete application path.

### 15.3 Policy and API tests

- anonymous callers receive `401`;
- disabled users remain rejected by the existing middleware;
- notification lists contain only the caller's rows;
- non-owners cannot read notification content through mark-as-read;
- mark-as-read is idempotent and preserves the original timestamp;
- Registrar Head receives paginated audit rows and every other role receives
  `403`;
- audit filters and exact Resources match OpenAPI;
- private no-store caching and request IDs are present; and
- route-inventory tests include exactly the three new endpoints.

### 15.4 Audit retrofit tests

Every row in the mutation matrix receives a feature test proving:

- one successful mutation produces its expected audit action;
- actor, auditable type/ID, request ID, and IP are correct;
- before/after values are accurate and contain no secret keys;
- required reasons are retained;
- rejected operations produce no audit row; and
- forced audit failure rolls back the domain write.

Each test method authenticates as only one actor, preserving the repository's
Sanctum guard-caching constraint.

### 15.5 Publication notification tests

- the submitting Program Chair is notified;
- every unique assigned faculty recipient is notified once;
- unassigned sections create no phantom user;
- a user appearing through multiple sections receives one notification;
- proposal, sections, audit rows, and notifications commit together; and
- injected notification failure rolls back the entire publication.

### 15.6 Quality gate

Before Phase 4 is recorded as complete:

- targeted tests pass after each change;
- the complete Laravel test suite passes against MariaDB;
- migration fresh/rollback verification passes;
- `composer format:check` passes;
- `composer analyse` passes at Larastan level 8;
- `composer audit --locked` reports no advisories;
- OpenAPI semantic lint reports no warnings or errors;
- `git diff --check` passes; and
- `PROGRESS.md` records only checks that actually ran.

Frontend and `ml-service` checks are not rerun for backend-only code unless
their code, configuration, dependency graph, or cross-service contract
changes. Documentation-only root changes do not trigger unrelated service
checks. Their known Phase 3 and paused Phase 9 states remain unchanged.

## 16. Documentation Deliverables

Phase 4 implementation synchronizes:

- `docs/api/openapi.yaml`;
- a new analytics/notifications/audit data-dictionary page;
- the `HISTORICAL DATA` mapping in that page;
- `PROGRESS.md` route, table, test, phase, and completion facts; and
- any operational caution discovered during implementation.

The overall percentage is recomputed only after verified implementation is
merged. Planning or unmerged code does not increase the published completion
score.

## 17. Completion Criteria

Phase 4 is complete only when:

1. all five tables migrate and roll back on MariaDB;
2. the three new endpoints match their OpenAPI contract;
3. notification ownership and Registrar-only audit visibility are proven;
4. every existing domain mutation in the matrix writes the correct audit row;
5. schedule publication creates the exact recipients and remains atomic;
6. all prediction tables remain schema-only and have no public route;
7. `HISTORICAL DATA` has a complete physical-source mapping;
8. every applicable quality check passes freshly;
9. `PROGRESS.md` contains only verified facts; and
10. no commit or push occurs without explicit user authorization.
