# Phase 4 Cross-Cutting Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver the verified Phase 4 Laravel backend foundation: immutable
audit history for every current domain mutation and the privileged audit-list
read, user-owned notifications with an idempotent read API, schedule-publication
notifications, and schema-only analytical result storage for later Phase 9
machine learning.

**Architecture:** Keep HTTP concerns in Form Requests, Policies, Controllers,
and Resources. Controllers pass an immutable request-context value object to one
transaction-owning use-case action. Each mutation action writes its business
rows, audit row, and any notification rows in the same MariaDB transaction.
Prediction tables expose models and relationships only; they have no routes,
jobs, seed data, or service integration in this phase.

**Tech Stack:** PHP 8.2, Laravel 12.64, Sanctum 4.3, Eloquent, MariaDB 10.4.32,
PHPUnit 11, Larastan level 8, Laravel Pint, OpenAPI 3.1, Redocly CLI.

**Approved design:** `docs/superpowers/specs/2026-07-29-phase-4-cross-cutting-backend-design.md`

## Global Constraints

- Work only in
  `C:\xampp\htdocs\GRC-ENROLLMENT\.worktrees\phase-4-cross-cutting-backend`.
- Follow red-green-refactor. Run the named failing test before adding each
  production behavior.
- Use MariaDB through `.env.testing`; do not substitute SQLite for database
  behavior.
- Every current mutation is audited explicitly from its use-case action.
  Do not use observers, request middleware diffing, or global request state.
- The use-case action owns the transaction. `AuditRecorder` must not open or
  commit a transaction.
- Never place names, email addresses, phone/address data, passwords, password
  confirmations, tokens, authentication secrets, or raw request bodies in
  audit payloads.
- Preserve the existing API error envelope, `X-Request-ID`, private/no-store
  caching, Sanctum guard, active-user middleware, and authenticated throttle.
- Keep prediction storage advisory and private. Do not add prediction routes,
  seeders, jobs, feature extraction, or `ml-service` changes.
- Do not add frontend work. Phase 5 consumes these APIs.
- Do not stage, commit, merge, or push. `AGENTS.md` requires explicit user
  authorization for those actions. Each task ends with a local review and
  verification checkpoint instead of a commit.
- Do not raise the published system percentage for planning or unmerged work.
  Record only checks actually run in `PROGRESS.md`.
- Each endpoint test authenticates as one actor only. This preserves the
  repository's Sanctum guard-caching test constraint.

---

## File Structure

### Create

```text
backend/app/Actions/Audit/ListAuditLogs.php
backend/app/Actions/Curriculum/CreateCurriculum.php
backend/app/Actions/Curriculum/UpdateCurriculum.php
backend/app/Actions/Faculty/CreateFacultyAvailability.php
backend/app/Actions/Faculty/CreateFacultySubjectPreference.php
backend/app/Actions/Faculty/DeleteFacultyAvailability.php
backend/app/Actions/Faculty/DeleteFacultySubjectPreference.php
backend/app/Actions/Faculty/UpdateFacultyAvailability.php
backend/app/Actions/Faculty/UpdateFacultySubjectPreference.php
backend/app/Actions/Notifications/ListNotifications.php
backend/app/Actions/Notifications/MarkNotificationRead.php
backend/app/Actions/Scheduling/CreateScheduleProposal.php
backend/app/Actions/Scheduling/CreateSection.php
backend/app/Actions/Scheduling/UpdateSection.php
backend/app/Domain/Analytics/PredictionRunStatus.php
backend/app/Domain/Analytics/PredictionType.php
backend/app/Domain/Audit/AuditAction.php
backend/app/Domain/Audit/AuditableType.php
backend/app/Domain/Audit/AuditRequestContext.php
backend/app/Domain/Notifications/NotificationType.php
backend/app/Http/Controllers/Api/V1/AuditLogController.php
backend/app/Http/Controllers/Api/V1/NotificationController.php
backend/app/Http/Requests/Api/V1/AuditLog/IndexAuditLogRequest.php
backend/app/Http/Requests/Api/V1/Notification/IndexNotificationRequest.php
backend/app/Http/Resources/Api/V1/AuditLogResource.php
backend/app/Http/Resources/Api/V1/NotificationResource.php
backend/app/Models/AttritionPrediction.php
backend/app/Models/AuditLog.php
backend/app/Models/Notification.php
backend/app/Models/PredictionRun.php
backend/app/Models/SectionDemandForecast.php
backend/app/Policies/AuditLogPolicy.php
backend/app/Policies/NotificationPolicy.php
backend/app/Support/Audit/AuditRecorder.php
backend/app/Support/Audit/AuditRequestContextFactory.php
backend/app/Support/Audit/CurriculumAuditSnapshot.php
backend/database/migrations/2026_07_29_000001_create_audit_logs_table.php
backend/database/migrations/2026_07_29_000002_create_notifications_table.php
backend/database/migrations/2026_07_29_000003_create_prediction_runs_table.php
backend/database/migrations/2026_07_29_000004_create_section_demand_forecasts_table.php
backend/database/migrations/2026_07_29_000005_create_attrition_predictions_table.php
backend/tests/Feature/Actions/Audit/ListAuditLogsTest.php
backend/tests/Feature/Actions/Audit/AuditRecorderTest.php
backend/tests/Feature/Actions/Curriculum/CurriculumAuditTest.php
backend/tests/Feature/Actions/Faculty/FacultyInputAuditTest.php
backend/tests/Feature/Actions/Identity/ProvisionStudentAuditTest.php
backend/tests/Feature/Actions/Scheduling/ScheduleProposalAuditTest.php
backend/tests/Feature/Actions/Scheduling/SectionAuditTest.php
backend/tests/Feature/Api/V1/AuditLogsEndpointTest.php
backend/tests/Feature/Api/V1/NotificationsEndpointTest.php
backend/tests/Feature/Database/AnalyticsSubstrateMigrationTest.php
backend/tests/Feature/Database/AuditAndNotificationMigrationTest.php
backend/tests/Feature/Models/AuditLogImmutabilityTest.php
backend/tests/Feature/Policies/AuditLogPolicyTest.php
backend/tests/Feature/Policies/NotificationPolicyTest.php
backend/tests/Unit/Domain/Analytics/PredictionRunStatusTest.php
backend/tests/Unit/Domain/Analytics/PredictionTypeTest.php
backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php
backend/tests/Unit/Domain/Notifications/NotificationTypeTest.php
backend/tests/Unit/Models/AttritionPredictionTest.php
backend/tests/Unit/Models/AuditLogTest.php
backend/tests/Unit/Models/NotificationTest.php
backend/tests/Unit/Models/PredictionRunTest.php
backend/tests/Unit/Models/SectionDemandForecastTest.php
backend/tests/Unit/Support/Audit/AuditRequestContextFactoryTest.php
docs/data-dictionary/cross-cutting-backend.md
```

### Modify

```text
backend/app/Actions/Curriculum/SynchronizeCurriculumSubjects.php
backend/app/Actions/Identity/ProvisionStudent.php
backend/app/Actions/Scheduling/TransitionScheduleProposal.php
backend/app/Http/Controllers/Api/V1/CurriculumController.php
backend/app/Http/Controllers/Api/V1/FacultyAvailabilityController.php
backend/app/Http/Controllers/Api/V1/FacultySubjectPreferenceController.php
backend/app/Http/Controllers/Api/V1/ScheduleProposalController.php
backend/app/Http/Controllers/Api/V1/SectionController.php
backend/app/Http/Controllers/Api/V1/StudentProfileController.php
backend/app/Models/User.php
backend/routes/api.php
backend/tests/Feature/Api/V1/ApiSurfaceTest.php
backend/tests/Feature/Api/V1/CurriculaEndpointTest.php
backend/tests/Feature/Api/V1/FacultyAvailabilitiesEndpointTest.php
backend/tests/Feature/Api/V1/FacultySubjectPreferencesEndpointTest.php
backend/tests/Feature/Api/V1/ScheduleProposalsEndpointTest.php
backend/tests/Feature/Api/V1/SectionsEndpointTest.php
backend/tests/Feature/Api/V1/StudentProfilesEndpointTest.php
docs/api/openapi.yaml
PROGRESS.md
```

---

## Task 1: Define the Stable Domain Vocabulary

**Files:**

- Create: `backend/app/Domain/Analytics/PredictionType.php`
- Create: `backend/app/Domain/Analytics/PredictionRunStatus.php`
- Create: `backend/app/Domain/Notifications/NotificationType.php`
- Create: `backend/app/Domain/Audit/AuditAction.php`
- Create: `backend/app/Domain/Audit/AuditableType.php`
- Test: `backend/tests/Unit/Domain/Analytics/PredictionTypeTest.php`
- Test: `backend/tests/Unit/Domain/Analytics/PredictionRunStatusTest.php`
- Test: `backend/tests/Unit/Domain/Notifications/NotificationTypeTest.php`
- Test: `backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php`

- [ ] **Step 1: Write the enum and vocabulary tests**

Assert the exact backed values:

```php
self::assertSame(
    ['section_demand', 'attrition'],
    array_column(PredictionType::cases(), 'value'),
);
self::assertSame(
    ['queued', 'running', 'succeeded', 'failed'],
    array_column(PredictionRunStatus::cases(), 'value'),
);
self::assertSame(
    ['schedule_published'],
    array_column(NotificationType::cases(), 'value'),
);
```

Assert that `AuditAction::values()` contains exactly the twenty approved
actions and that `AuditableType::values()` contains:

```php
[
    'curriculum',
    'faculty_availability',
    'faculty_subject_preference',
    'section',
    'schedule_proposal',
    'student_profile',
    'audit_log',
]
```

- [ ] **Step 2: Run the tests and confirm red**

Run:

```powershell
cd backend
php artisan test --filter='PredictionTypeTest|PredictionRunStatusTest|NotificationTypeTest|AuditVocabularyTest'
```

Expected: failures because the four domain classes do not exist.

- [ ] **Step 3: Implement backed enums and final vocabulary classes**

Use string-backed enums. Implement `AuditAction` and `AuditableType` as final
constant catalogs with `values(): list<string>`; do not introduce labels or
speculative values.

The action constants must map to:

```php
public const CURRICULUM_CREATED = 'curriculum.created';
public const CURRICULUM_UPDATED = 'curriculum.updated';
public const FACULTY_AVAILABILITY_CREATED = 'faculty_availability.created';
public const FACULTY_AVAILABILITY_UPDATED = 'faculty_availability.updated';
public const FACULTY_AVAILABILITY_DELETED = 'faculty_availability.deleted';
public const FACULTY_SUBJECT_PREFERENCE_CREATED = 'faculty_subject_preference.created';
public const FACULTY_SUBJECT_PREFERENCE_UPDATED = 'faculty_subject_preference.updated';
public const FACULTY_SUBJECT_PREFERENCE_DELETED = 'faculty_subject_preference.deleted';
public const SECTION_CREATED = 'section.created';
public const SECTION_UPDATED = 'section.updated';
public const SCHEDULE_PROPOSAL_CREATED = 'schedule_proposal.created';
public const SCHEDULE_PROPOSAL_DEAN_APPROVED = 'schedule_proposal.dean_approved';
public const SCHEDULE_PROPOSAL_DEAN_RETURNED = 'schedule_proposal.dean_returned';
public const SCHEDULE_PROPOSAL_EXECUTIVE_APPROVED = 'schedule_proposal.executive_approved';
public const SCHEDULE_PROPOSAL_EXECUTIVE_RETURNED = 'schedule_proposal.executive_returned';
public const SCHEDULE_PROPOSAL_PUBLISHED = 'schedule_proposal.published';
public const SECTION_PUBLISHED = 'section.published';
public const SCHEDULE_PROPOSAL_CLOSED = 'schedule_proposal.closed';
public const STUDENT_PROFILE_PROVISIONED = 'student_profile.provisioned';
public const AUDIT_LOG_LIST_VIEWED = 'audit_log.list_viewed';
```

- [ ] **Step 4: Run green and format**

Run:

```powershell
php artisan test --filter='PredictionTypeTest|PredictionRunStatusTest|NotificationTypeTest|AuditVocabularyTest'
vendor\bin\pint app\Domain tests\Unit\Domain
```

Expected: all targeted tests pass and Pint reports no remaining changes.

- [ ] **Step 5: Review checkpoint**

Confirm `rg -n "prediction|notification|audit" backend/routes` finds no new
route and `git diff --check` passes.

---

## Task 2: Add Audit and Notification Storage

**Files:**

- Create:
  `backend/database/migrations/2026_07_29_000001_create_audit_logs_table.php`
- Create:
  `backend/database/migrations/2026_07_29_000002_create_notifications_table.php`
- Create:
  `backend/tests/Feature/Database/AuditAndNotificationMigrationTest.php`

- [ ] **Step 1: Write the schema contract tests**

Use `RefreshDatabase`. Assert both tables and exact columns. Add behavioral
tests that:

- reject deletion of a user referenced by `audit_logs`;
- cascade a deleted user's `notifications`;
- reject a `request_id` longer than 128 characters;
- allow a null `auditable_id`, null before/after values, null reason, and null
  IP;
- preserve JSON objects inserted into `before_values` and `after_values`; and
- query MariaDB `information_schema.statistics` to prove the five audit indexes
  and two notification indexes named below exist.

Use these names:

```text
audit_logs_auditable_history_index
audit_logs_actor_history_index
audit_logs_action_history_index
audit_logs_request_id_index
audit_logs_created_at_index
notifications_user_created_index
notifications_user_unread_created_index
```

- [ ] **Step 2: Run the migration test and confirm red**

Run:

```powershell
cd backend
php artisan test --filter=AuditAndNotificationMigrationTest
```

Expected: `Schema::hasTable()` assertions fail because neither table exists.

- [ ] **Step 3: Implement the two reversible migrations**

Create `audit_logs` exactly as approved:

```php
$table->id();
$table->foreignId('actor_user_id')->constrained('users')->restrictOnDelete();
$table->string('action', 100);
$table->string('auditable_type', 100);
$table->unsignedBigInteger('auditable_id')->nullable();
$table->json('before_values')->nullable();
$table->json('after_values')->nullable();
$table->text('reason')->nullable();
$table->string('request_id', 128);
$table->string('ip_address', 45)->nullable();
$table->timestamps();
```

Create `notifications` exactly as approved:

```php
$table->id();
$table->foreignId('user_id')->constrained()->cascadeOnDelete();
$table->string('type', 100);
$table->text('message');
$table->timestamp('read_at')->nullable();
$table->timestamps();
```

Add the named indexes from Step 1. Each `down()` uses only its precise
`Schema::dropIfExists()` target.

- [ ] **Step 4: Run green and verify a real rollback/reapply**

Run:

```powershell
php artisan test --filter=AuditAndNotificationMigrationTest
php artisan migrate:fresh --env=testing
php artisan migrate:rollback --step=2 --env=testing
php artisan migrate --env=testing
```

Expected: tests pass; rollback removes only these latest two tables at this
point; reapply succeeds.

- [ ] **Step 5: Review checkpoint**

Run `git diff --check` and inspect both `down()` methods for exact table names.

---

## Task 3: Add the Schema-Only Machine-Learning Substrate

**Files:**

- Create:
  `backend/database/migrations/2026_07_29_000003_create_prediction_runs_table.php`
- Create:
  `backend/database/migrations/2026_07_29_000004_create_section_demand_forecasts_table.php`
- Create:
  `backend/database/migrations/2026_07_29_000005_create_attrition_predictions_table.php`
- Create:
  `backend/tests/Feature/Database/AnalyticsSubstrateMigrationTest.php`

- [ ] **Step 1: Write failing schema and constraint tests**

Assert exact columns, foreign-key delete restrictions, business uniqueness,
and these database rejection cases:

```text
predicted_demand = -0.01
confidence_lower = -0.01
confidence_upper = -0.01
confidence_lower = 20.00 with confidence_upper = 19.99
risk_probability = -0.0001
risk_probability = 1.0001
```

Also prove duplicate `(prediction_run_id, academic_term_id, subject_id)` and
duplicate `(prediction_run_id, student_id)` rows fail.

- [ ] **Step 2: Run the migration test and confirm red**

Run:

```powershell
cd backend
php artisan test --filter=AnalyticsSubstrateMigrationTest
```

Expected: failures because the three tables do not exist.

- [ ] **Step 3: Implement `prediction_runs`**

Use the approved columns and named indexes:

```text
prediction_runs_type_status_created_index
prediction_runs_term_type_created_index
```

`academic_term_id` is nullable and `RESTRICT` on delete.

- [ ] **Step 4: Implement the two result tables**

Use `DECIMAL(10,2)` for demand and confidence values and `DECIMAL(5,4)` for
risk. Use `UNSIGNED SMALLINT` for `suggested_section_count`. Add the approved
foreign keys with `RESTRICT` delete behavior and named unique constraints.

Because this Laravel schema version has no MariaDB `CHECK` helper, add these
named constraints after table creation:

```sql
ALTER TABLE section_demand_forecasts
ADD CONSTRAINT section_forecasts_demand_nonnegative CHECK (predicted_demand >= 0),
ADD CONSTRAINT section_forecasts_lower_nonnegative CHECK (confidence_lower IS NULL OR confidence_lower >= 0),
ADD CONSTRAINT section_forecasts_upper_nonnegative CHECK (confidence_upper IS NULL OR confidence_upper >= 0),
ADD CONSTRAINT section_forecasts_bounds_ordered CHECK (
  confidence_lower IS NULL OR confidence_upper IS NULL OR confidence_upper >= confidence_lower
)
```

```sql
ALTER TABLE attrition_predictions
ADD CONSTRAINT attrition_predictions_risk_range
CHECK (risk_probability BETWEEN 0.0000 AND 1.0000)
```

`down()` drops the tables in reverse dependency order; dropping each table also
drops its named checks.

- [ ] **Step 5: Run green and rollback all five Phase 4 migrations**

Run:

```powershell
php artisan test --filter=AnalyticsSubstrateMigrationTest
php artisan migrate:fresh --env=testing
php artisan migrate:rollback --step=5 --env=testing
php artisan migrate --env=testing
```

Expected: all constraint tests pass and all five migrations roll back/reapply.

- [ ] **Step 6: Prove the substrate has no public behavior**

Run:

```powershell
rg -n "PredictionRun|SectionDemandForecast|AttritionPrediction" app\Http routes database\seeders
```

Expected: no route, controller, HTTP request/resource, job, or seeder match.

---

## Task 4: Add Models, Casts, Relationships, and Audit Immutability

**Files:**

- Create: `backend/app/Models/AuditLog.php`
- Create: `backend/app/Models/Notification.php`
- Create: `backend/app/Models/PredictionRun.php`
- Create: `backend/app/Models/SectionDemandForecast.php`
- Create: `backend/app/Models/AttritionPrediction.php`
- Modify: `backend/app/Models/User.php`
- Create: `backend/tests/Unit/Models/AuditLogTest.php`
- Create: `backend/tests/Unit/Models/NotificationTest.php`
- Create: `backend/tests/Unit/Models/PredictionRunTest.php`
- Create: `backend/tests/Unit/Models/SectionDemandForecastTest.php`
- Create: `backend/tests/Unit/Models/AttritionPredictionTest.php`
- Create: `backend/tests/Feature/Models/AuditLogImmutabilityTest.php`

- [ ] **Step 1: Write failing cast and relationship tests**

Cover:

- audit JSON arrays and immutable timestamps;
- notification enum and immutable `read_at`;
- prediction type/status enums, JSON metrics, and immutable lifecycle fields;
- fixed-point decimal strings (`decimal:2`, `decimal:4`);
- `AuditLog::actor()`, `Notification::user()`;
- `PredictionRun::academicTerm()`, `sectionDemandForecasts()`,
  `attritionPredictions()`;
- each result model's approved `belongsTo` relationships; and
- `User::auditLogs()` and `User::notifications()`.

- [ ] **Step 2: Run model tests and confirm red**

Run:

```powershell
cd backend
php artisan test --testsuite=Unit --filter='AuditLogTest|NotificationTest|PredictionRunTest|SectionDemandForecastTest|AttritionPredictionTest'
```

Expected: class-not-found failures.

- [ ] **Step 3: Implement the five models**

Use explicit fillable lists and PHPDoc properties. Cast new model timestamps to
`immutable_datetime`. The relevant cast map must include:

```php
// AuditLog
'before_values' => 'array',
'after_values' => 'array',
'created_at' => 'immutable_datetime',
'updated_at' => 'immutable_datetime',

// Notification
'type' => NotificationType::class,
'read_at' => 'immutable_datetime',

// PredictionRun
'type' => PredictionType::class,
'status' => PredictionRunStatus::class,
'metrics' => 'array',
'started_at' => 'immutable_datetime',
'completed_at' => 'immutable_datetime',

// SectionDemandForecast
'predicted_demand' => 'decimal:2',
'confidence_lower' => 'decimal:2',
'confidence_upper' => 'decimal:2',
'suggested_section_count' => 'integer',

// AttritionPrediction
'risk_probability' => 'decimal:4',
'explanations' => 'array',
```

Do not add query scopes, accessors, APIs, or domain behavior to prediction
models.

- [ ] **Step 4: Write the failing immutability test**

Persist an audit row, then assert both operations throw `LogicException` and
the stored row remains unchanged:

```php
$auditLog->update(['action' => AuditAction::CURRICULUM_UPDATED]);
$auditLog->delete();
```

Use separate test methods so the first exception does not prevent the second
assertion.

- [ ] **Step 5: Enforce application-level immutability**

In `AuditLog::booted()`, register `updating` and `deleting` callbacks that throw
a clear `LogicException('Audit logs are immutable.')`. Do not block initial
creation.

- [ ] **Step 6: Run green and static formatting**

Run:

```powershell
php artisan test --filter='AuditLogTest|NotificationTest|PredictionRunTest|SectionDemandForecastTest|AttritionPredictionTest|AuditLogImmutabilityTest'
vendor\bin\pint app\Models tests\Unit\Models tests\Feature\Models
```

Expected: targeted tests pass.

---

## Task 5: Build Request Context and the Audit Recorder

**Files:**

- Create: `backend/app/Domain/Audit/AuditRequestContext.php`
- Create: `backend/app/Support/Audit/AuditRequestContextFactory.php`
- Create: `backend/app/Support/Audit/AuditRecorder.php`
- Create:
  `backend/tests/Unit/Support/Audit/AuditRequestContextFactoryTest.php`
- Create: `backend/tests/Feature/Actions/Audit/AuditRecorderTest.php`

- [ ] **Step 1: Write failing request-context tests**

Construct Laravel requests and prove:

- a valid incoming `X-Request-ID` is retained;
- an invalid ID is replaced through `AssignRequestId::getOrCreate()`;
- the request ID is stored in the request attributes; and
- IPv4, IPv6, and null IP values map to `AuditRequestContext`.

- [ ] **Step 2: Implement the immutable context**

Use:

```php
final readonly class AuditRequestContext
{
    public function __construct(
        public string $requestId,
        public ?string $ipAddress,
    ) {}
}
```

The factory contract is:

```php
public function fromRequest(Request $request): AuditRequestContext
```

It calls `AssignRequestId::getOrCreate($request)` and `$request->ip()`.

- [ ] **Step 3: Write failing recorder tests**

Prove `AuditRecorder::record()`:

- stores the exact actor, action, type, ID, safe arrays, reason, request ID,
  and IP;
- accepts null before/after/reason/IP;
- rejects an unknown action;
- rejects blank action, type, request ID, and non-null blank reason;
- recursively rejects keys containing `password`, `token`, or `secret`;
- recursively rejects contact keys `email`, `phone`, `mobile`, and `address`;
  and
- does not begin or commit a transaction.

For recursive rejection, test nested keys such as:

```php
['profile' => ['password_confirmation' => 'unsafe']]
['actor' => ['email' => 'unsafe@grc.test']]
```

- [ ] **Step 4: Run recorder/context tests and confirm red**

Run:

```powershell
cd backend
php artisan test --filter='AuditRequestContextFactoryTest|AuditRecorderTest'
```

Expected: missing-class failures.

- [ ] **Step 5: Implement `AuditRecorder`**

Use this exact public contract:

```php
public function record(
    User $actor,
    string $action,
    string $auditableType,
    ?int $auditableId,
    ?array $beforeValues,
    ?array $afterValues,
    ?string $reason,
    AuditRequestContext $context,
): AuditLog
```

Validate against `AuditAction::values()`, non-empty stable type, and non-empty
request ID. Normalize payload keys to lowercase snake-like text before checking
for secret/contact fragments. Create one `AuditLog`; do not call
`DB::transaction()`.

- [ ] **Step 6: Run green and review the data boundary**

Run:

```powershell
php artisan test --filter='AuditRequestContextFactoryTest|AuditRecorderTest'
vendor\bin\pint app\Domain\Audit app\Support\Audit tests\Unit\Support\Audit tests\Feature\Actions\Audit
rg -n "password|email|phone|token|secret" app\Support\Audit tests\Feature\Actions\Audit
```

Expected: tests pass. Every grep hit is a validation rule or negative test, not
a persisted payload example.

---

## Task 6: Implement the User-Owned Notification API

**Files:**

- Create: `backend/app/Policies/NotificationPolicy.php`
- Create:
  `backend/app/Http/Requests/Api/V1/Notification/IndexNotificationRequest.php`
- Create: `backend/app/Actions/Notifications/ListNotifications.php`
- Create: `backend/app/Actions/Notifications/MarkNotificationRead.php`
- Create:
  `backend/app/Http/Resources/Api/V1/NotificationResource.php`
- Create:
  `backend/app/Http/Controllers/Api/V1/NotificationController.php`
- Modify: `backend/routes/api.php`
- Create:
  `backend/tests/Feature/Policies/NotificationPolicyTest.php`
- Create:
  `backend/tests/Feature/Api/V1/NotificationsEndpointTest.php`

- [ ] **Step 1: Write failing policy tests**

Assert `viewAny()` allows an active authenticated user and `update()` is true
only when `notification.user_id === user.id`.

- [ ] **Step 2: Write failing endpoint tests**

Cover:

- anonymous list/read requests return `401`;
- disabled users are rejected;
- list returns only the caller's rows;
- newest `created_at`, then highest `id`, appears first;
- `unread_only=true` excludes read rows;
- `per_page` defaults to 20 and accepts 1–100;
- invalid `unread_only`, `page`, or `per_page` returns the standard `422`;
- response has pagination `links` and `meta`;
- resource exact keys are `type`, `id`, `notification_type`, `message`,
  `read_at`, and `created_at`, with no `user_id`;
- owner mark-as-read sets one UTC timestamp;
- a retry preserves the first timestamp;
- non-owner receives `403` and no notification content;
- unknown ID returns `404`; and
- responses include `X-Request-ID` and `Cache-Control: no-store, private`.

- [ ] **Step 3: Run tests and confirm red**

Run:

```powershell
cd backend
php artisan test --filter='NotificationPolicyTest|NotificationsEndpointTest'
```

Expected: policy/controller/route class-not-found or route-not-found failures.

- [ ] **Step 4: Implement validation, actions, policy, and Resource**

`IndexNotificationRequest` rules:

```php
return [
    'unread_only' => ['sometimes', 'boolean'],
    'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
    'page' => ['sometimes', 'integer', 'min:1'],
];
```

`ListNotifications::execute(User $user, bool $unreadOnly, int $perPage)`
returns a length-aware paginator scoped by `user_id`, optionally
`whereNull('read_at')`, ordered by `created_at DESC, id DESC`.

`MarkNotificationRead::execute(Notification $notification)` uses one database
transaction and `lockForUpdate()`. It sets `read_at = now()` only when the
locked row's `read_at` is null, then returns the refreshed row.

- [ ] **Step 5: Implement controller and routes**

Add under the existing authenticated/active/throttled group:

```php
Route::get('/notifications', [NotificationController::class, 'index'])
    ->name('notifications.index');
Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead'])
    ->name('notifications.read');
```

The controller authorizes, invokes one action, returns the Resource, and sets
private/no-store caching.

- [ ] **Step 6: Run green**

Run:

```powershell
php artisan test --filter='NotificationPolicyTest|NotificationsEndpointTest'
vendor\bin\pint app\Actions\Notifications app\Policies\NotificationPolicy.php app\Http\Controllers\Api\V1\NotificationController.php app\Http\Requests\Api\V1\Notification app\Http\Resources\Api\V1\NotificationResource.php tests\Feature\Policies\NotificationPolicyTest.php tests\Feature\Api\V1\NotificationsEndpointTest.php
```

Expected: all targeted tests pass.

---

## Task 7: Implement the Registrar Head Audit-Log API

**Files:**

- Create: `backend/app/Policies/AuditLogPolicy.php`
- Create:
  `backend/app/Http/Requests/Api/V1/AuditLog/IndexAuditLogRequest.php`
- Create: `backend/app/Actions/Audit/ListAuditLogs.php`
- Create: `backend/app/Http/Resources/Api/V1/AuditLogResource.php`
- Create: `backend/app/Http/Controllers/Api/V1/AuditLogController.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/Policies/AuditLogPolicyTest.php`
- Create: `backend/tests/Feature/Actions/Audit/ListAuditLogsTest.php`
- Create: `backend/tests/Feature/Api/V1/AuditLogsEndpointTest.php`

- [ ] **Step 1: Write failing Policy and validation tests**

Assert only `UserRole::RegistrarHead` passes `viewAny()`/`view()`. Validate:

```php
'action' => ['sometimes', Rule::in(AuditAction::values())],
'auditable_type' => ['sometimes', Rule::in(AuditableType::values())],
'actor_user_id' => ['sometimes', 'integer', Rule::exists('users', 'id')],
'from' => ['sometimes', 'date_format:Y-m-d'],
'to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from'],
'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
'page' => ['sometimes', 'integer', 'min:1'],
```

- [ ] **Step 2: Write failing list-action tests**

Prove filters apply exactly, `to` includes the end of its date, ordering is
`created_at DESC, id DESC`, actor is eager-loaded, and one
`audit_log.list_viewed` row is written after the page is materialized.

Assert the read audit row has:

```php
[
    'action' => AuditAction::AUDIT_LOG_LIST_VIEWED,
    'auditable_type' => AuditableType::AUDIT_LOG,
    'auditable_id' => null,
    'before_values' => null,
    'after_values' => [
        'action' => $filters['action'] ?? null,
        'auditable_type' => $filters['auditable_type'] ?? null,
        'actor_user_id' => $filters['actor_user_id'] ?? null,
        'from' => $filters['from'] ?? null,
        'to' => $filters['to'] ?? null,
        'page' => $filters['page'] ?? 1,
        'per_page' => $filters['per_page'] ?? 20,
    ],
]
```

The just-created read event must not appear in the returned paginator.

- [ ] **Step 3: Write failing endpoint tests**

Cover anonymous `401`, every non-Registrar role `403`, Registrar success,
pagination metadata, every filter, invalid values `422`, exact Resource keys,
absence of actor email/name, request ID, and private/no-store caching.

The exact resource fields are:

```text
type
id
actor_user_id
actor_role
actor_role_label
action
auditable_type
auditable_id
before_values
after_values
reason
request_id
ip_address
created_at
```

- [ ] **Step 4: Run red**

Run:

```powershell
cd backend
php artisan test --filter='AuditLogPolicyTest|ListAuditLogsTest|AuditLogsEndpointTest'
```

Expected: missing classes/routes.

- [ ] **Step 5: Implement action, Resource, controller, and route**

`ListAuditLogs::execute()` accepts the actor, validated filter array, and
`AuditRequestContext`, runs the paginator query first, then calls
`AuditRecorder`. Wrap query materialization and read-audit creation in one
read/write transaction so a recorder failure returns no misleading success.

Add:

```php
Route::middleware('role:registrar_head')->group(function (): void {
    Route::get('/audit-logs', AuditLogController::class)
        ->name('audit-logs.index');
});
```

The invokable controller performs Policy defense in depth and invokes only
`ListAuditLogs`.

- [ ] **Step 6: Run green**

Run:

```powershell
php artisan test --filter='AuditLogPolicyTest|ListAuditLogsTest|AuditLogsEndpointTest'
vendor\bin\pint app\Actions\Audit app\Policies\AuditLogPolicy.php app\Http\Controllers\Api\V1\AuditLogController.php app\Http\Requests\Api\V1\AuditLog app\Http\Resources\Api\V1\AuditLogResource.php tests\Feature\Actions\Audit tests\Feature\Policies\AuditLogPolicyTest.php tests\Feature\Api\V1\AuditLogsEndpointTest.php
```

Expected: all targeted tests pass.

---

## Task 8: Audit Faculty Availability and Subject Preferences

**Files:**

- Create the six `backend/app/Actions/Faculty/*.php` files listed in the file
  map.
- Modify:
  `backend/app/Http/Controllers/Api/V1/FacultyAvailabilityController.php`
- Modify:
  `backend/app/Http/Controllers/Api/V1/FacultySubjectPreferenceController.php`
- Create:
  `backend/tests/Feature/Actions/Faculty/FacultyInputAuditTest.php`
- Modify:
  `backend/tests/Feature/Api/V1/FacultyAvailabilitiesEndpointTest.php`
- Modify:
  `backend/tests/Feature/Api/V1/FacultySubjectPreferencesEndpointTest.php`

- [ ] **Step 1: Write failing successful-mutation audit tests**

For all six operations, assert one exact action, actor, auditable type/ID,
request ID, IP, and safe snapshot. Availability snapshots contain only:

```text
professor_id, academic_term_id, day_of_week, starts_at_time, ends_at_time
```

Preference snapshots contain only:

```text
professor_id, academic_term_id, subject_id, rank
```

Create has null `before_values`; delete has null `after_values`; update has both.

- [ ] **Step 2: Write failing rejection and rollback tests**

Prove authorization/validation failures create no audit row. Force
`AuditLog::creating` to throw from the Laravel event dispatcher and call each
action family; assert the availability/preference create, update, or delete is
rolled back.

- [ ] **Step 3: Run red**

Run:

```powershell
cd backend
php artisan test --filter='FacultyInputAuditTest|FacultyAvailabilitiesEndpointTest|FacultySubjectPreferencesEndpointTest'
```

Expected: new audit assertions fail while existing endpoint behavior remains
green.

- [ ] **Step 4: Implement the six transaction-owning actions**

Each action receives:

```php
User $actor,
array $validatedData, // create/update only
FacultyAvailability|FacultySubjectPreference $model, // update/delete only
AuditRequestContext $context,
```

Each action starts one `DB::transaction()`, captures safe snapshots explicitly,
performs the mutation, records the audit row, and returns the refreshed model
for create/update. Delete returns `void`.

- [ ] **Step 5: Make controllers thin**

Inject `AuditRequestContextFactory` and exactly one use-case action into each
write method. Preserve authorization before action invocation and preserve
existing response codes/Resources. Remove direct `create()`, `update()`, and
`delete()` calls from both controllers.

- [ ] **Step 6: Run green and check controller boundaries**

Run:

```powershell
php artisan test --filter='FacultyInputAuditTest|FacultyAvailabilitiesEndpointTest|FacultySubjectPreferencesEndpointTest'
rg -n "::create\\(|->update\\(|->delete\\(|DB::transaction" app\Http\Controllers\Api\V1\FacultyAvailabilityController.php app\Http\Controllers\Api\V1\FacultySubjectPreferenceController.php
vendor\bin\pint app\Actions\Faculty app\Http\Controllers\Api\V1\FacultyAvailabilityController.php app\Http\Controllers\Api\V1\FacultySubjectPreferenceController.php tests\Feature\Actions\Faculty
```

Expected: tests pass and the controller grep has no mutation/transaction match.

---

## Task 9: Audit Curriculum Graph and Section Mutations

**Files:**

- Create: `backend/app/Support/Audit/CurriculumAuditSnapshot.php`
- Create: `backend/app/Actions/Curriculum/CreateCurriculum.php`
- Create: `backend/app/Actions/Curriculum/UpdateCurriculum.php`
- Modify:
  `backend/app/Actions/Curriculum/SynchronizeCurriculumSubjects.php`
- Create: `backend/app/Actions/Scheduling/CreateSection.php`
- Create: `backend/app/Actions/Scheduling/UpdateSection.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CurriculumController.php`
- Modify: `backend/app/Http/Controllers/Api/V1/SectionController.php`
- Create:
  `backend/tests/Feature/Actions/Curriculum/CurriculumAuditTest.php`
- Create:
  `backend/tests/Feature/Actions/Scheduling/SectionAuditTest.php`
- Modify: `backend/tests/Feature/Api/V1/CurriculaEndpointTest.php`
- Modify: `backend/tests/Feature/Api/V1/SectionsEndpointTest.php`

- [ ] **Step 1: Write failing curriculum audit tests**

The deterministic curriculum snapshot is:

```php
[
    'program_id' => 1,
    'name' => 'BSCS 2026',
    'effective_school_year' => '2026-2027',
    'status' => 'draft',
    'subjects' => [
        [
            'subject_id' => 10,
            'year_level' => 1,
            'semester' => '1st',
            'is_required' => true,
            'prerequisites' => [
                [
                    'prerequisite_subject_id' => 9,
                    'minimum_grade' => '2.50',
                ],
            ],
        ],
    ],
]
```

Sort subjects and prerequisites by ID before recording. Test create/update,
graph replacement, rejected requests, and forced audit failure rolling back the
curriculum row and its entire placement/prerequisite graph.

- [ ] **Step 2: Write failing section audit tests**

Snapshot only:

```text
academic_term_id, subject_id, section_code, professor_id, schedule_days,
starts_at_time, ends_at_time, room, capacity, viability_threshold,
enrolled_count, status
```

Test create/update, before/after status enum values as strings, rejected
requests, and forced audit failure rollback.

- [ ] **Step 3: Run red**

Run:

```powershell
cd backend
php artisan test --filter='CurriculumAuditTest|SectionAuditTest|CurriculaEndpointTest|SectionsEndpointTest'
```

Expected: audit assertions fail.

- [ ] **Step 4: Implement curriculum transaction boundaries**

Change `SynchronizeCurriculumSubjects::execute()` to perform only the graph
replacement and require its caller's transaction. `CreateCurriculum` and
`UpdateCurriculum` each own one outer transaction containing:

```text
curriculum row write
full graph synchronization
fresh deterministic graph snapshot
AuditRecorder::record()
```

`UpdateCurriculum` captures the fully loaded graph snapshot before any write.

- [ ] **Step 5: Implement section actions**

`CreateSection` and `UpdateSection` own their transactions and explicitly map
the approved safe fields. Do not include related user or subject text.

- [ ] **Step 6: Refactor both controllers**

Each write method authenticates, authorizes, builds context, calls one action,
and returns its existing Resource/status code. Remove direct writes.

- [ ] **Step 7: Run green and boundary grep**

Run:

```powershell
php artisan test --filter='CurriculumAuditTest|SectionAuditTest|CurriculaEndpointTest|SectionsEndpointTest'
rg -n "::create\\(|->update\\(|DB::transaction" app\Http\Controllers\Api\V1\CurriculumController.php app\Http\Controllers\Api\V1\SectionController.php
vendor\bin\pint app\Actions\Curriculum app\Actions\Scheduling\CreateSection.php app\Actions\Scheduling\UpdateSection.php app\Support\Audit\CurriculumAuditSnapshot.php app\Http\Controllers\Api\V1\CurriculumController.php app\Http\Controllers\Api\V1\SectionController.php tests\Feature\Actions\Curriculum tests\Feature\Actions\Scheduling\SectionAuditTest.php
```

Expected: tests pass and controllers contain no direct mutation/transaction.

---

## Task 10: Audit the Schedule Lifecycle and Notify on Publication

**Files:**

- Create:
  `backend/app/Actions/Scheduling/CreateScheduleProposal.php`
- Modify:
  `backend/app/Actions/Scheduling/TransitionScheduleProposal.php`
- Modify:
  `backend/app/Http/Controllers/Api/V1/ScheduleProposalController.php`
- Create:
  `backend/tests/Feature/Actions/Scheduling/ScheduleProposalAuditTest.php`
- Modify:
  `backend/tests/Feature/Api/V1/ScheduleProposalsEndpointTest.php`

- [ ] **Step 1: Write failing proposal creation/transition audit tests**

Cover `schedule_proposal.created` and all six transition mappings:

```php
private const AUDIT_ACTION_FOR_TRANSITION = [
    'dean_approve' => AuditAction::SCHEDULE_PROPOSAL_DEAN_APPROVED,
    'dean_return' => AuditAction::SCHEDULE_PROPOSAL_DEAN_RETURNED,
    'executive_approve' => AuditAction::SCHEDULE_PROPOSAL_EXECUTIVE_APPROVED,
    'executive_return' => AuditAction::SCHEDULE_PROPOSAL_EXECUTIVE_RETURNED,
    'publish' => AuditAction::SCHEDULE_PROPOSAL_PUBLISHED,
    'close' => AuditAction::SCHEDULE_PROPOSAL_CLOSED,
];
```

Safe proposal snapshots contain only:

```text
academic_term_id, submitted_by, status, decided_by, decided_at,
decision_reason
```

Return actions retain the required reason. Rejected transitions create no
audit row.

- [ ] **Step 2: Write failing per-section publication audit tests**

Create multiple planned sections plus an already-published section in the same
term. Prove only rows changed from `planned` to `published` receive exactly one
`section.published` audit row, with planned/published before/after status.

- [ ] **Step 3: Write failing notification-recipient tests**

Prove publication notifies:

- the submitting Program Chair;
- every unique assigned faculty user on newly published sections;
- no user for a null professor;
- one row when the same faculty teaches multiple sections; and
- one row when a recipient is both submitter and assigned professor.

Assert exact `NotificationType::SchedulePublished` and a message containing
only the term's school year/semester, not student or contact data.

- [ ] **Step 4: Write failing atomicity tests**

Use event listeners to throw during:

- an `AuditLog::creating` event after the proposal/section writes begin; and
- a `Notification::creating` event after proposal/section/audit writes begin.

In both cases assert proposal status, every section status, audit count, and
notification count all roll back.

- [ ] **Step 5: Run red**

Run:

```powershell
cd backend
php artisan test --filter='ScheduleProposalAuditTest|ScheduleProposalsEndpointTest'
```

Expected: new audit/notification assertions fail.

- [ ] **Step 6: Implement proposal creation action**

`CreateScheduleProposal::execute()` accepts term ID, submitter, and context;
creates the draft proposal and its creation audit in one transaction.

- [ ] **Step 7: Expand the transition action**

Use this contract:

```php
public function execute(
    ScheduleProposal $proposal,
    string $action,
    User $actingUser,
    ?string $reason,
    AuditRequestContext $context,
): ScheduleProposal
```

Inside one transaction:

1. capture the proposal before snapshot;
2. update the proposal;
3. for `publish`, load planned sections in stable ID order;
4. update each section individually so its exact before/after snapshot is
   available;
5. write one `section.published` audit row per changed section;
6. write the proposal transition audit with `published_section_ids`;
7. collect `submitted_by` and non-null `professor_id` values, `unique()`, and
   create one notification per recipient; and
8. return the refreshed proposal.

Do not use the current bulk section update because it cannot provide exact
row-level audit snapshots.

- [ ] **Step 8: Refactor controller and run green**

The controller builds context, invokes `CreateScheduleProposal` or
`TransitionScheduleProposal`, and retains its current Policy mapping.

Run:

```powershell
php artisan test --filter='ScheduleProposalAuditTest|ScheduleProposalsEndpointTest'
vendor\bin\pint app\Actions\Scheduling app\Http\Controllers\Api\V1\ScheduleProposalController.php tests\Feature\Actions\Scheduling\ScheduleProposalAuditTest.php tests\Feature\Api\V1\ScheduleProposalsEndpointTest.php
```

Expected: schedule tests pass with exact recipients and rollback behavior.

---

## Task 11: Audit Atomic Student Provisioning Without Personal Data

**Files:**

- Modify: `backend/app/Actions/Identity/ProvisionStudent.php`
- Modify: `backend/app/Http/Controllers/Api/V1/StudentProfileController.php`
- Create:
  `backend/tests/Feature/Actions/Identity/ProvisionStudentAuditTest.php`
- Modify:
  `backend/tests/Feature/Api/V1/StudentProfilesEndpointTest.php`

- [ ] **Step 1: Write failing success and privacy tests**

Assert `student_profile.provisioned` records only:

```php
[
    'user_id' => $profile->user_id,
    'student_profile_id' => $profile->id,
    'role' => 'student',
    'program_id' => $profile->program_id,
    'curriculum_id' => $profile->curriculum_id,
    'year_level' => $profile->year_level,
    'admission_status' => 'admitted',
    'academic_standing' => 'good',
]
```

Assert the serialized audit row does not contain submitted name, email,
password, password confirmation, or student number.

- [ ] **Step 2: Write failing rollback/rejection tests**

Force audit creation to throw and prove neither the `users` nor
`student_profiles` row commits. Prove authorization/validation failures create
no audit row.

- [ ] **Step 3: Run red**

Run:

```powershell
cd backend
php artisan test --filter='ProvisionStudentAuditTest|StudentProfilesEndpointTest'
```

Expected: audit assertions fail while pre-existing provisioning tests pass.

- [ ] **Step 4: Extend the existing transaction**

Change the public contract to:

```php
public function handle(
    array $data,
    User $actor,
    AuditRequestContext $context,
): StudentProfile
```

After both rows are created, write the exact safe audit payload inside the
existing transaction, then return the profile.

- [ ] **Step 5: Refactor controller and run green**

Authenticate once, retain the actor, build context, and pass both to
`ProvisionStudent`.

Run:

```powershell
php artisan test --filter='ProvisionStudentAuditTest|StudentProfilesEndpointTest'
vendor\bin\pint app\Actions\Identity\ProvisionStudent.php app\Http\Controllers\Api\V1\StudentProfileController.php tests\Feature\Actions\Identity\ProvisionStudentAuditTest.php tests\Feature\Api\V1\StudentProfilesEndpointTest.php
```

Expected: all targeted tests pass and the audit JSON contains no personal or
authentication data.

---

## Task 12: Synchronize Route Inventory, OpenAPI, and Data Documentation

**Files:**

- Modify: `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`
- Modify: `docs/api/openapi.yaml`
- Create: `docs/data-dictionary/cross-cutting-backend.md`
- Modify: `PROGRESS.md`

- [ ] **Step 1: Update the route-inventory test first**

Add exactly:

```text
GET|HEAD api/v1/audit-logs
GET|HEAD api/v1/notifications
PATCH api/v1/notifications/{notification}/read
```

Add all three route names to the authenticated list. Assert only
`api.v1.audit-logs.index` has `role:registrar_head`; notification routes must
not carry a role middleware.

- [ ] **Step 2: Run the route test**

Run:

```powershell
cd backend
php artisan test --filter=ApiSurfaceTest
```

Expected: pass only when the implemented route surface is exactly 29 routes.

- [ ] **Step 3: Extend OpenAPI 3.1**

Document the exact three paths, bearer security, query validation, pagination
envelopes, Resources, `401/403/404/422/429/500` envelopes as applicable,
`X-Request-ID`, and private/no-store response behavior.

Add reusable schemas:

```text
Notification
PaginatedNotificationCollection
AuditLog
PaginatedAuditLogCollection
PaginationLinks
PaginationMeta
```

Do not add any prediction endpoint or expose `user_id` in `Notification`.

- [ ] **Step 4: Write the cross-cutting data dictionary**

Document all five tables, column semantics, FK delete behavior, indexes,
business uniqueness, checks, enum values, retention/immutability expectations,
and the complete approved `HISTORICAL DATA` physical mapping. State explicitly:

- prediction tables are schema-only in Phase 4;
- analytical output is advisory;
- student-level attrition data has no API;
- `report_exports` remains Phase 9; and
- no generic `historical_data` duplicate table exists.

- [ ] **Step 5: Lint and structurally inspect the API contract**

Run:

```powershell
cd ..
npx --yes @redocly/cli@latest lint docs/api/openapi.yaml
cd backend
php artisan route:list --path=api/v1
```

Expected: Redocly reports no warnings/errors and route list contains exactly
29 routes.

- [ ] **Step 6: Update `PROGRESS.md` with verified facts only**

Record:

- five new tables and three new endpoints;
- exact new test/assertion totals only after the full suite runs;
- completed audit matrix and publication recipients only after their tests
  pass;
- prediction storage as schema-only, with ML still last in Phase 9; and
- Phase 4 as verified in the worktree/pending integration.

Keep the page-top overall progress at 36% until this implementation is merged.
Do not mark frontend portals or ML complete.

---

## Task 13: Run the Complete Phase 4 Verification Gate

**Files:**

- Modify only files required to fix failures caused by Phase 4.
- Modify: `PROGRESS.md` if actual command results differ from recorded facts.

- [ ] **Step 1: Run focused Phase 4 tests**

Run:

```powershell
cd backend
php artisan test --filter='Audit|Notification|Prediction|CurriculumAudit|FacultyInputAudit|SectionAudit|ScheduleProposalAudit|ProvisionStudentAudit|ApiSurfaceTest'
```

Expected: every new and directly affected test passes.

- [ ] **Step 2: Run the complete backend suite**

Run:

```powershell
composer test
```

Expected: zero failures. Record the exact test and assertion totals.

- [ ] **Step 3: Re-prove migration reversibility on MariaDB**

Run:

```powershell
php artisan migrate:fresh --env=testing
php artisan migrate:rollback --step=5 --env=testing
php artisan migrate --env=testing
php artisan test --filter='AuditAndNotificationMigrationTest|AnalyticsSubstrateMigrationTest'
```

Expected: fresh, five-step rollback, reapply, and migration tests all pass.

- [ ] **Step 4: Run static quality and security gates**

Run:

```powershell
composer format:check
composer analyse
composer audit --locked
cd ..
npx --yes @redocly/cli@latest lint docs/api/openapi.yaml
git diff --check
```

Expected:

```text
Pint: clean
Larastan: no errors
Composer audit: no advisories
Redocly: no warnings/errors
git diff --check: no output
```

- [ ] **Step 5: Inspect the final public and ML boundaries**

Run:

```powershell
cd backend
php artisan route:list --path=api/v1
rg -n "PredictionRun|SectionDemandForecast|AttritionPrediction" app\Http routes database\seeders
rg -n "::create\\(|->update\\(|->delete\\(|DB::transaction" app\Http\Controllers\Api\V1\CurriculumController.php app\Http\Controllers\Api\V1\FacultyAvailabilityController.php app\Http\Controllers\Api\V1\FacultySubjectPreferenceController.php app\Http\Controllers\Api\V1\ScheduleProposalController.php app\Http\Controllers\Api\V1\SectionController.php app\Http\Controllers\Api\V1\StudentProfileController.php
```

Expected:

- exactly 29 API routes;
- no prediction controller/request/resource/route/seeder;
- no direct mutation or transaction in the six refactored controllers.

- [ ] **Step 6: Reconcile documentation and inspect the diff**

Update `PROGRESS.md` only if Step 2–4 produced facts different from the current
text. Then run:

```powershell
cd ..
git status --short
git diff --stat
git diff -- PROGRESS.md docs/api/openapi.yaml docs/data-dictionary/cross-cutting-backend.md
git diff --check
```

Expected: only intended Phase 4, approved planning, password-seeder, and
documentation changes appear. No generated caches, dependency directories,
credentials, or environment files are tracked.

- [ ] **Step 7: Stop at the integration boundary**

Report:

- exact verification results;
- any remaining caveat;
- the unchanged 36% published progress pending merge; and
- that no stage, commit, merge, or push occurred.

Wait for explicit user authorization before any integration action.
