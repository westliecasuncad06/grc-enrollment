# Faculty Workforce Page & Specialization Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Program Chair a dedicated "Faculty Workforce" page (split out of Faculty Loading) where they can search professors in their own college, view/edit their workforce profile, assign or approve which subjects a professor may teach, and give Registrar Head read-only access to the same roster across all four colleges.

**Architecture:** Backend adds a `pending|approved|rejected` status to the existing `FacultySpecialization` capability model (mirroring the `WithdrawalRequest` approve/reject pattern already used elsewhere), widens `FacultyMemberPolicy`/`ListFacultyMembers` so Registrar Head can read the faculty directory across colleges, and exposes a new decide endpoint. Frontend extracts the existing Faculty Workforce dialog out of `faculty-loading-workspace.tsx` into a new `FacultyWorkforceWorkspace` page (its own nav entry for both roles) and adds a specialization-management panel to it.

**Tech Stack:** Laravel 11 (PHP 8.3, Sanctum auth, PHPUnit), Next.js/React (TypeScript, TanStack Query, Zod, Vitest + Testing Library).

**Spec:** `docs/superpowers/specs/2026-08-29-faculty-workforce-page-and-specialization-approval-design.md`

## Global Constraints

- Follow the existing `TransitionWithdrawalRequest` shape for any new approve/reject action: row-lock via `lockForUpdate()->firstOrFail()`, guard the current status inside the transaction, require a reason only for reject, record a paired `AuditAction`, send a paired `NotificationType`.
- `decided_by` is never exposed in an API resource — only `status`, `status_label`, `decided_at`, `decision_reason` (matches `EnrollmentChangeRequestResource`'s documented precedent; the decider's identity stays in the audit log only).
- Every Zod object schema in this codebase uses `.strict()` — any new backend response field MUST be added to its matching frontend schema in the same task that changes the backend response, or parsing breaks immediately.
- Run the specific test file(s) touched by each task before moving on; do not batch verification to the end.
- Backend tests in this codebase construct users with plain `User::create([...])` (no factories) and log in via `POST /api/v1/auth/login` to get a bearer token, OR create a token directly with `$user->createToken('name')->plainTextToken`. When a test switches bearer tokens mid-test, call `$this->app['auth']->forgetGuards();` first (see `FacultySpecializationsEndpointTest::test_a_professor_cannot_delete_another_professors_specialization`).

---

## Task 1: `FacultySpecialization` gains an approval status

**Files:**
- Create: `backend/app/Domain/Faculty/FacultySpecializationStatus.php`
- Create: `backend/database/migrations/2026_08_29_000001_add_status_to_faculty_specializations_table.php`
- Modify: `backend/app/Models/FacultySpecialization.php`
- Modify: `backend/app/Domain/Audit/AuditAction.php`
- Test: `backend/tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php`

**Interfaces:**
- Produces: `FacultySpecializationStatus` enum (`Pending`, `Approved`, `Rejected`, each with `->label()`); `FacultySpecialization::$status` cast to it, default DB value `'approved'`; new columns `decided_by` (nullable FK to `users`), `decided_at` (nullable timestamp), `decision_reason` (nullable text); new `AuditAction::FACULTY_SPECIALIZATION_APPROVED` / `FACULTY_SPECIALIZATION_REJECTED` constants.

- [ ] **Step 1: Write the failing test — existing rows default to `approved`, new column is present on the resource shape**

Add to `backend/tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php`, inside the existing test class:

```php
    public function test_a_newly_declared_specialization_is_pending_and_exposes_status_fields(): void
    {
        [, $token] = $this->faculty('faculty.specialization-status@grc.test');
        $subject = $this->subject('IT104', CollegeCode::Ccs);

        $this->withToken($token)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $subject->id,
            'proficiency' => 'primary',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.status_label', 'Pending')
            ->assertJsonPath('data.decided_at', null)
            ->assertJsonPath('data.decision_reason', null);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && php artisan test --filter=test_a_newly_declared_specialization_is_pending_and_exposes_status_fields`
Expected: FAIL — the response has no `status`/`status_label`/`decided_at`/`decision_reason` keys yet (this also fails to compile until the column exists once Step 4 runs migrations, but at this point it fails because the resource doesn't return those keys — `assertJsonPath` fails with a missing-key error).

- [ ] **Step 3: Create the status enum**

```php
<?php

namespace App\Domain\Faculty;

enum FacultySpecializationStatus: string
{
    case Pending = 'pending';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
        };
    }
}
```

- [ ] **Step 4: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A professor's self-declared specialization now requires Program Chair
 * approval before it counts as a real capability signal (see
 * docs/superpowers/specs/2026-08-29-faculty-workforce-page-and-specialization-approval-design.md).
 * Existing rows default to `approved` so nothing the recommendation engine
 * already reads silently disappears behind the new gate.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('faculty_specializations', function (Blueprint $table) {
            $table->string('status', 16)->default('approved')->after('source');
            $table->foreignId('decided_by')->nullable()->after('status')->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable()->after('decided_by');
            $table->text('decision_reason')->nullable()->after('decided_at');
        });
    }

    public function down(): void
    {
        Schema::table('faculty_specializations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('decided_by');
            $table->dropColumn(['status', 'decided_at', 'decision_reason']);
        });
    }
};
```

- [ ] **Step 5: Update the model**

Edit `backend/app/Models/FacultySpecialization.php`:

```php
use App\Domain\Faculty\FacultySpecializationStatus;
use App\Domain\Faculty\SpecializationProficiency;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $professor_id
 * @property int $subject_id
 * @property SpecializationProficiency $proficiency
 * @property string $source
 * @property FacultySpecializationStatus $status
 * @property ?int $decided_by
 * @property ?CarbonImmutable $decided_at
 * @property ?string $decision_reason
 * @property ?string $notes
 * @property ?CarbonImmutable $created_at
 * @property ?CarbonImmutable $updated_at
 * @property-read User $professor
 * @property-read Subject $subject
 */
final class FacultySpecialization extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'professor_id',
        'subject_id',
        'proficiency',
        'source',
        'notes',
        'status',
        'decided_by',
        'decided_at',
        'decision_reason',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'proficiency' => SpecializationProficiency::class,
            'status' => FacultySpecializationStatus::class,
            'decided_at' => 'immutable_datetime',
        ];
    }
```

(leave `professor()`, `subject()`, and `scopeVisibleTo()` untouched in this task — `scopeVisibleTo` is narrowed in Task 4).

- [ ] **Step 6: Add the audit action constants**

Edit `backend/app/Domain/Audit/AuditAction.php` — add two new constants right after `FACULTY_SPECIALIZATION_DELETED` (line 43):

```php
    public const FACULTY_SPECIALIZATION_APPROVED = 'faculty_specialization.approved';

    public const FACULTY_SPECIALIZATION_REJECTED = 'faculty_specialization.rejected';
```

And add both to the `values()` array right after `self::FACULTY_SPECIALIZATION_DELETED,` (around line 221):

```php
            self::FACULTY_SPECIALIZATION_APPROVED,
            self::FACULTY_SPECIALIZATION_REJECTED,
```

- [ ] **Step 7: Update `FacultySpecializationResource` to expose the new fields**

Edit `backend/app/Http/Resources/Api/V1/FacultySpecializationResource.php`:

```php
<?php

namespace App\Http\Resources\Api\V1;

use App\Models\FacultySpecialization;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @property-read FacultySpecialization $resource */
final class FacultySpecializationResource extends JsonResource
{
    /** @return array<string, int|string|null> */
    public function toArray(Request $request): array
    {
        return [
            'type' => 'faculty-specialization',
            'id' => $this->resource->id,
            'professor_id' => $this->resource->professor_id,
            'subject_id' => $this->resource->subject_id,
            'proficiency' => $this->resource->proficiency->value,
            'proficiency_label' => $this->resource->proficiency->label(),
            'source' => $this->resource->source,
            'notes' => $this->resource->notes,
            'status' => $this->resource->status->value,
            'status_label' => $this->resource->status->label(),
            'decided_at' => $this->resource->decided_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'decision_reason' => $this->resource->decision_reason,
        ];
    }
}
```

- [ ] **Step 8: Make `CreateFacultySpecialization` set `status = pending` for a self-declaring professor**

This will be fully handled in Task 2 (which also adds `professor_id`/`source` branching) — for now, run the migration and re-run the Step-1 test to confirm the column exists and defaults correctly for the *existing* create path (which still always sets `source: 'declared'` and does not set `status`, so it will pick up the DB default `'approved'`, not `'pending'` yet — this is expected and gets fixed in Task 2).

Run: `cd backend && php artisan migrate`
Expected: migration runs cleanly.

Run: `cd backend && php artisan test --filter=test_a_newly_declared_specialization_is_pending_and_exposes_status_fields`
Expected: FAILS on `status` — actual `approved`, expected `pending`. This is the correct, expected state at the end of Task 1 (the DB column now exists and the resource now serializes it, but the "self-declare starts pending" behavior is Task 2's job). Note this in the task's commit message so Task 2 picks it up as the next failing test.

- [ ] **Step 9: Commit**

```bash
cd backend
git add app/Domain/Faculty/FacultySpecializationStatus.php database/migrations/2026_08_29_000001_add_status_to_faculty_specializations_table.php app/Models/FacultySpecialization.php app/Domain/Audit/AuditAction.php app/Http/Resources/Api/V1/FacultySpecializationResource.php tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php
git commit -m "feat(faculty): add pending/approved/rejected status to FacultySpecialization"
```

---

## Task 2: Program Chair can create a specialization for another professor; self-declared rows start pending

**Files:**
- Modify: `backend/app/Actions/Faculty/CreateFacultySpecialization.php`
- Modify: `backend/app/Http/Requests/Api/V1/FacultySpecialization/StoreFacultySpecializationRequest.php`
- Modify: `backend/app/Http/Controllers/Api/V1/FacultySpecializationController.php`
- Test: `backend/tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php`

**Interfaces:**
- Consumes: `FacultySpecializationStatus` (Task 1).
- Produces: `CreateFacultySpecialization::execute(User $actor, array $validatedData, AuditRequestContext $context): FacultySpecialization` — `$validatedData` may now include `professor_id` (int, optional). `source` values: `'declared'` (self), `'program_chair_assigned'` (Program Chair, new), `'seeded'` (workbook, unchanged elsewhere).

- [ ] **Step 1: Write the failing test — self-declare starts pending**

Run the test already added in Task 1:

Run: `cd backend && php artisan test --filter=test_a_newly_declared_specialization_is_pending_and_exposes_status_fields`
Expected (before this task's implementation): FAIL, `status` is `approved` not `pending`.

- [ ] **Step 2: Write the failing test — Program Chair creates one directly, auto-approved**

Add to `FacultySpecializationsEndpointTest.php`:

```php
    /** @return array{User, string} */
    private function programChair(string $email, CollegeCode $college = CollegeCode::Ccs): array
    {
        $chair = User::create([
            'name' => 'Test Chair',
            'email' => $email,
            'password' => self::PASSWORD,
            'role' => UserRole::ProgramChair,
            'college' => $college,
            'status' => UserStatus::Active,
        ]);

        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => self::PASSWORD,
        ])->json('data.token');

        return [$chair, $token];
    }

    public function test_a_program_chair_assigns_a_specialization_to_a_professor_in_their_college_and_it_is_auto_approved(): void
    {
        [$chair, $chairToken] = $this->programChair('chair.specialization@grc.test', CollegeCode::Ccs);
        [$professor] = $this->faculty('faculty.assigned-by-chair@grc.test', CollegeCode::Ccs);
        $subject = $this->subject('IT105', CollegeCode::Ccs);

        $this->withToken($chairToken)->postJson('/api/v1/faculty-specializations', [
            'professor_id' => $professor->id,
            'subject_id' => $subject->id,
            'proficiency' => 'primary',
        ])->assertCreated()
            ->assertJsonPath('data.professor_id', $professor->id)
            ->assertJsonPath('data.source', 'program_chair_assigned')
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.status_label', 'Approved');
    }

    public function test_a_program_chair_cannot_assign_a_specialization_to_a_professor_outside_their_college(): void
    {
        [, $chairToken] = $this->programChair('chair.specialization-other@grc.test', CollegeCode::Ccs);
        [$otherCollegeProfessor] = $this->faculty('faculty.other-college@grc.test', CollegeCode::Coe);
        $subject = $this->subject('ED102', CollegeCode::Coe);

        $this->withToken($chairToken)->postJson('/api/v1/faculty-specializations', [
            'professor_id' => $otherCollegeProfessor->id,
            'subject_id' => $subject->id,
            'proficiency' => 'primary',
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && php artisan test --filter=FacultySpecializationsEndpointTest`
Expected: the two new tests FAIL — `professor_id` is currently ignored by the action (it always uses `$actor->id`), and the Policy's `create` ability currently rejects Program Chair outright (403, not 422) since `create()` only allows `UserRole::Faculty`. Note: the second new test will fail differently until Task 3 widens the Policy — that's expected; this task's Step 6 re-runs both after Task 3-equivalent Policy work lands. To keep this task's own scope buildable in isolation, also apply the minimal Policy widening here (Task 3 will further refine it with the `decide` ability, but `create` must be widened now for these tests to exercise the Action).

- [ ] **Step 4: Widen `FacultySpecializationPolicy::create`**

Edit `backend/app/Policies/FacultySpecializationPolicy.php`:

```php
    public function create(User $user): bool
    {
        return $user->role === UserRole::Faculty
            || ($user->role === UserRole::ProgramChair && $user->college !== null);
    }
```

- [ ] **Step 5: Update `StoreFacultySpecializationRequest`**

```php
<?php

namespace App\Http\Requests\Api\V1\FacultySpecialization;

use App\Domain\Faculty\SpecializationProficiency;
use App\Domain\Identity\UserRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreFacultySpecializationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $actor = $this->user();
        $isChairAssigning = $actor?->role === UserRole::ProgramChair && $this->filled('professor_id');
        $targetProfessorId = $isChairAssigning ? (int) $this->input('professor_id') : $actor?->id;

        return [
            'professor_id' => [
                'sometimes',
                'integer',
                Rule::exists('users', 'id')->where(
                    fn ($query) => $query->where('role', UserRole::Faculty->value)
                        ->where('college', $actor?->college?->value),
                ),
            ],
            'subject_id' => [
                'required',
                'integer',
                Rule::exists('subjects', 'id')->where(
                    fn ($query) => $query->where('college', $actor?->college?->value),
                ),
                Rule::unique('faculty_specializations', 'subject_id')->where(
                    fn ($query) => $query->where('professor_id', $targetProfessorId),
                ),
            ],
            'proficiency' => ['sometimes', Rule::enum(SpecializationProficiency::class)],
            'notes' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
```

Note: for a Faculty actor, `professor_id` is never sent by the frontend and `$actor?->college?->value` still correctly scopes their own `subject_id` choices (unchanged behavior). For a Program Chair actor, both the `professor_id` existence rule and the `subject_id` college rule use the chair's own college, so a chair can only ever target their own faculty and their own college's subjects — the cross-college rejection test in Step 2 is satisfied by the `professor_id` exists-rule failing (the other-college professor doesn't match `college = $actor->college`).

- [ ] **Step 6: Update `CreateFacultySpecialization`**

```php
<?php

namespace App\Actions\Faculty;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Faculty\FacultySpecializationStatus;
use App\Domain\Faculty\SpecializationProficiency;
use App\Domain\Identity\UserRole;
use App\Models\FacultySpecialization;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;

final class CreateFacultySpecialization
{
    public function __construct(private readonly AuditRecorder $auditRecorder) {}

    /** @param array{professor_id?: int, subject_id: int, proficiency?: string, notes?: ?string} $validatedData */
    public function execute(User $actor, array $validatedData, AuditRequestContext $context): FacultySpecialization
    {
        return DB::transaction(function () use ($actor, $validatedData, $context): FacultySpecialization {
            $isChairAssigning = $actor->role === UserRole::ProgramChair && isset($validatedData['professor_id']);
            $professorId = $isChairAssigning ? (int) $validatedData['professor_id'] : $actor->id;

            $specialization = FacultySpecialization::create([
                'professor_id' => $professorId,
                'subject_id' => $validatedData['subject_id'],
                'proficiency' => $validatedData['proficiency'] ?? SpecializationProficiency::Secondary,
                'source' => $isChairAssigning ? 'program_chair_assigned' : 'declared',
                'notes' => $validatedData['notes'] ?? null,
                'status' => $isChairAssigning ? FacultySpecializationStatus::Approved : FacultySpecializationStatus::Pending,
                'decided_by' => $isChairAssigning ? $actor->id : null,
                'decided_at' => $isChairAssigning ? now() : null,
            ]);
            $specialization->refresh();

            $this->auditRecorder->record(
                $actor,
                AuditAction::FACULTY_SPECIALIZATION_CREATED,
                AuditableType::FACULTY_SPECIALIZATION,
                $specialization->id,
                null,
                self::snapshot($specialization),
                null,
                $context,
            );

            return $specialization;
        });
    }

    /** @return array{professor_id: int, subject_id: int, proficiency: string, source: string, status: string, notes: ?string} */
    public static function snapshot(FacultySpecialization $specialization): array
    {
        return [
            'professor_id' => $specialization->professor_id,
            'subject_id' => $specialization->subject_id,
            'proficiency' => $specialization->proficiency->value,
            'source' => $specialization->source,
            'status' => $specialization->status->value,
            'notes' => $specialization->notes,
        ];
    }
}
```

- [ ] **Step 7: Pass `professor_id` through from the controller**

`FacultySpecializationController::store` already calls `$action->execute($user, $request->validated(), ...)` — `$request->validated()` now includes `professor_id` whenever it was sent, no controller change needed.

- [ ] **Step 8: Move the `POST /faculty-specializations` route so a Program Chair can reach it**

The two new tests in this task POST as a Program Chair, but today `POST /faculty-specializations` sits inside a `Route::middleware('role:faculty')->group(...)` block (`backend/routes/api.php`, around line 369-387) — a Program Chair actor would be rejected with 403 by that middleware before ever reaching the Policy/Action work above. Edit `backend/routes/api.php`:

1. Delete this line from inside the `role:faculty` group (around line 381):

```php
            Route::post('/faculty-specializations', [FacultySpecializationController::class, 'store'])->name('faculty-specializations.store');
```

2. Leave every other line inside that `role:faculty` group unchanged — this includes `Route::delete('/faculty-specializations/{facultySpecialization}', ...)`, which stays exactly where it is (deletion is still Faculty-own-record-only).

3. Immediately after that group's closing `});`, add:

```php
        Route::post('/faculty-specializations', [FacultySpecializationController::class, 'store'])
            ->middleware('role:faculty,program_chair')
            ->name('faculty-specializations.store');
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd backend && php artisan test --filter=FacultySpecializationsEndpointTest`
Expected: all tests in this file PASS, including the Task 1 status test and the two new Task 2 tests.

- [ ] **Step 10: Commit**

```bash
cd backend
git add app/Actions/Faculty/CreateFacultySpecialization.php app/Http/Requests/Api/V1/FacultySpecialization/StoreFacultySpecializationRequest.php app/Policies/FacultySpecializationPolicy.php routes/api.php tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php
git commit -m "feat(faculty): let a Program Chair assign a specialization directly, auto-approved"
```

---

## Task 3: Program Chair can approve/reject a professor's pending specialization

**Files:**
- Create: `backend/app/Actions/Faculty/DecideFacultySpecialization.php`
- Modify: `backend/app/Domain/Notifications/NotificationType.php`
- Modify: `backend/app/Policies/FacultySpecializationPolicy.php`
- Modify: `backend/app/Http/Controllers/Api/V1/FacultySpecializationController.php`
- Create: `backend/app/Http/Requests/Api/V1/FacultySpecialization/DecideFacultySpecializationRequest.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php`

**Interfaces:**
- Consumes: `FacultySpecializationStatus` (Task 1), `AuditAction::FACULTY_SPECIALIZATION_APPROVED`/`REJECTED` (Task 1).
- Produces: `DecideFacultySpecialization::execute(FacultySpecialization $specialization, string $action, User $actor, ?string $reason, AuditRequestContext $context): FacultySpecialization`. New route `PATCH /api/v1/faculty-specializations/{facultySpecialization}`, Policy ability `decide`.

- [ ] **Step 1: Write the failing tests**

Add to `FacultySpecializationsEndpointTest.php`:

```php
    public function test_a_program_chair_approves_a_pending_specialization_in_their_college(): void
    {
        [$chair, $chairToken] = $this->programChair('chair.decide-approve@grc.test', CollegeCode::Ccs);
        [, $facultyToken] = $this->faculty('faculty.decide-approve@grc.test', CollegeCode::Ccs);
        $subject = $this->subject('IT106', CollegeCode::Ccs);

        $specializationId = $this->withToken($facultyToken)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $subject->id,
            'proficiency' => 'secondary',
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();

        $this->withToken($chairToken)->patchJson("/api/v1/faculty-specializations/{$specializationId}", [
            'action' => 'approve',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonPath('data.status_label', 'Approved');

        $this->assertDatabaseHas('faculty_specializations', [
            'id' => $specializationId,
            'status' => 'approved',
            'decided_by' => $chair->id,
        ]);
    }

    public function test_rejecting_a_specialization_requires_a_reason_and_notifies_the_professor(): void
    {
        [, $chairToken] = $this->programChair('chair.decide-reject@grc.test', CollegeCode::Ccs);
        [$professor, $facultyToken] = $this->faculty('faculty.decide-reject@grc.test', CollegeCode::Ccs);
        $subject = $this->subject('IT107', CollegeCode::Ccs);

        $specializationId = $this->withToken($facultyToken)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $subject->id,
            'proficiency' => 'secondary',
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();

        $this->withToken($chairToken)->patchJson("/api/v1/faculty-specializations/{$specializationId}", [
            'action' => 'reject',
        ])->assertUnprocessable()
            ->assertJsonPath('error.errors.reason.0', 'A reason is required for this action.');

        $this->withToken($chairToken)->patchJson("/api/v1/faculty-specializations/{$specializationId}", [
            'action' => 'reject',
            'reason' => 'Not enough evidence of teaching experience.',
        ])->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.decision_reason', 'Not enough evidence of teaching experience.');

        $this->assertDatabaseHas('notifications', [
            'user_id' => $professor->id,
            'type' => 'faculty_specialization_rejected',
        ]);
    }

    public function test_a_program_chair_cannot_decide_a_specialization_outside_their_college(): void
    {
        [, $chairToken] = $this->programChair('chair.decide-other@grc.test', CollegeCode::Ccs);
        [, $otherFacultyToken] = $this->faculty('faculty.decide-other@grc.test', CollegeCode::Coe);
        $subject = $this->subject('ED103', CollegeCode::Coe);

        $specializationId = $this->withToken($otherFacultyToken)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $subject->id,
            'proficiency' => 'secondary',
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();

        $this->withToken($chairToken)->patchJson("/api/v1/faculty-specializations/{$specializationId}", [
            'action' => 'approve',
        ])->assertForbidden();
    }

    public function test_a_specialization_cannot_be_decided_twice(): void
    {
        [, $chairToken] = $this->programChair('chair.decide-twice@grc.test', CollegeCode::Ccs);
        [, $facultyToken] = $this->faculty('faculty.decide-twice@grc.test', CollegeCode::Ccs);
        $subject = $this->subject('IT108', CollegeCode::Ccs);

        $specializationId = $this->withToken($facultyToken)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $subject->id,
            'proficiency' => 'secondary',
        ])->assertCreated()->json('data.id');

        $this->app['auth']->forgetGuards();

        $this->withToken($chairToken)->patchJson("/api/v1/faculty-specializations/{$specializationId}", ['action' => 'approve'])
            ->assertOk();

        $this->withToken($chairToken)->patchJson("/api/v1/faculty-specializations/{$specializationId}", ['action' => 'approve'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && php artisan test --filter=FacultySpecializationsEndpointTest`
Expected: the four new tests FAIL with a 404/405 (no `PATCH /faculty-specializations/{id}` route exists yet).

- [ ] **Step 3: Add the two new `NotificationType` cases**

Edit `backend/app/Domain/Notifications/NotificationType.php`, add after `StudentProfileChangeRejected`:

```php
    case FacultySpecializationApproved = 'faculty_specialization_approved';
    case FacultySpecializationRejected = 'faculty_specialization_rejected';
```

- [ ] **Step 4: Add the `decide` Policy ability**

Edit `backend/app/Policies/FacultySpecializationPolicy.php`, add:

```php
    public function decide(User $user, FacultySpecialization $specialization): bool
    {
        return $user->role === UserRole::ProgramChair
            && $user->college !== null
            && $specialization->professor->college === $user->college;
    }
```

- [ ] **Step 5: Write the `DecideFacultySpecializationRequest`**

```php
<?php

namespace App\Http\Requests\Api\V1\FacultySpecialization;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class DecideFacultySpecializationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'action' => ['required', Rule::in(['approve', 'reject'])],
            'reason' => ['required_if:action,reject', 'nullable', 'string', 'max:1000'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'reason.required_if' => 'A reason is required for this action.',
        ];
    }
}
```

- [ ] **Step 6: Write `DecideFacultySpecialization`**

```php
<?php

namespace App\Actions\Faculty;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Faculty\FacultySpecializationStatus;
use App\Domain\Notifications\NotificationType;
use App\Models\FacultySpecialization;
use App\Models\Notification;
use App\Models\User;
use App\Support\Audit\AuditRecorder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final readonly class DecideFacultySpecialization
{
    /** @var array<string, FacultySpecializationStatus> */
    private const TARGET_STATUS = [
        'approve' => FacultySpecializationStatus::Approved,
        'reject' => FacultySpecializationStatus::Rejected,
    ];

    /** @var array<string, string> */
    private const AUDIT_ACTION = [
        'approve' => AuditAction::FACULTY_SPECIALIZATION_APPROVED,
        'reject' => AuditAction::FACULTY_SPECIALIZATION_REJECTED,
    ];

    /** @var array<string, NotificationType> */
    private const NOTIFICATION_TYPE = [
        'approve' => NotificationType::FacultySpecializationApproved,
        'reject' => NotificationType::FacultySpecializationRejected,
    ];

    private const REASON_REQUIRED_ACTIONS = ['reject'];

    public function __construct(private AuditRecorder $auditRecorder) {}

    public function execute(
        FacultySpecialization $specialization,
        string $action,
        User $actor,
        ?string $reason,
        AuditRequestContext $context,
    ): FacultySpecialization {
        if (! isset(self::TARGET_STATUS[$action])) {
            throw new InvalidArgumentException('Unknown specialization decision.');
        }

        if (
            in_array($action, self::REASON_REQUIRED_ACTIONS, true)
            && ($reason === null || trim($reason) === '')
        ) {
            throw ValidationException::withMessages([
                'reason' => 'A reason is required for this action.',
            ]);
        }

        return DB::transaction(function () use ($specialization, $action, $actor, $reason, $context): FacultySpecialization {
            $locked = FacultySpecialization::query()
                ->whereKey($specialization->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->status !== FacultySpecializationStatus::Pending) {
                throw ValidationException::withMessages([
                    'action' => 'This action requires the specialization to currently be '.
                        "'pending'; it is currently '{$locked->status->value}'.",
                ]);
            }

            $beforeValues = CreateFacultySpecialization::snapshot($locked);

            $locked->update([
                'status' => self::TARGET_STATUS[$action],
                'decided_by' => $actor->id,
                'decided_at' => now(),
                'decision_reason' => $action === 'reject' ? $reason : null,
            ]);
            $locked->refresh();

            $this->auditRecorder->record(
                $actor,
                self::AUDIT_ACTION[$action],
                AuditableType::FACULTY_SPECIALIZATION,
                $locked->id,
                $beforeValues,
                CreateFacultySpecialization::snapshot($locked),
                $action === 'reject' ? $reason : null,
                $context,
            );

            Notification::create([
                'user_id' => $locked->professor_id,
                'type' => self::NOTIFICATION_TYPE[$action],
                'message' => self::notificationMessage($action, $reason),
            ]);

            return $locked;
        });
    }

    private static function notificationMessage(string $action, ?string $reason): string
    {
        return match ($action) {
            'approve' => 'A subject you can teach has been approved by your Program Chair.',
            'reject' => "A subject you declared was not approved by your Program Chair. Reason: {$reason}",
            default => 'Your declared subject status has changed.',
        };
    }
}
```

Note: this reuses `CreateFacultySpecialization::snapshot()` (Task 2) — no new snapshot logic needed since both actions describe the same row shape.

- [ ] **Step 7: Add `update` to the controller**

Edit `backend/app/Http/Controllers/Api/V1/FacultySpecializationController.php`, add:

```php
    public function update(
        DecideFacultySpecializationRequest $request,
        FacultySpecialization $facultySpecialization,
        DecideFacultySpecialization $action,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $user = $this->authenticatedUser($request);
        $this->authorize('decide', $facultySpecialization);

        $specialization = $action->execute(
            $facultySpecialization,
            $request->validated('action'),
            $user,
            $request->validated('reason'),
            $contextFactory->fromRequest($request),
        );

        return $this->privateResponse(FacultySpecializationResource::make($specialization)->response($request));
    }
```

Add the two new imports at the top: `use App\Actions\Faculty\DecideFacultySpecialization;` and `use App\Http\Requests\Api\V1\FacultySpecialization\DecideFacultySpecializationRequest;`.

- [ ] **Step 8: Add the route**

Edit `backend/routes/api.php` — add the new `PATCH` route inside the existing `role:program_chair` group (the same block containing `/faculty-members`, around line 319-334; Task 2, Step 8 already moved `POST /faculty-specializations` to its own standalone `role:faculty,program_chair` route outside this group — this new `PATCH` line is unrelated to that and is Program-Chair-only, so it belongs inside this group):

```php
            Route::patch('/faculty-specializations/{facultySpecialization}', [FacultySpecializationController::class, 'update'])->name('faculty-specializations.update');
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd backend && php artisan test --filter=FacultySpecializationsEndpointTest`
Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
cd backend
git add app/Actions/Faculty/DecideFacultySpecialization.php app/Domain/Notifications/NotificationType.php app/Policies/FacultySpecializationPolicy.php app/Http/Controllers/Api/V1/FacultySpecializationController.php app/Http/Requests/Api/V1/FacultySpecialization/DecideFacultySpecializationRequest.php routes/api.php tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php
git commit -m "feat(faculty): let a Program Chair approve or reject a pending specialization"
```

---

## Task 4: Scope specialization visibility and listing to the Program Chair's own college

**Files:**
- Modify: `backend/app/Models/FacultySpecialization.php`
- Modify: `backend/app/Http/Controllers/Api/V1/FacultySpecializationController.php`
- Test: `backend/tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php`

**Interfaces:**
- Produces: `FacultySpecialization::scopeVisibleTo` now narrows Program Chair to their own college's professors (Registrar Head and other non-learner-scoped roles keep the existing unfiltered behavior). `GET /api/v1/faculty-specializations?professor_id=` filters to one professor (used by the new frontend detail panel and the professor's own preference form).

- [ ] **Step 1: Write the failing tests**

Add to `FacultySpecializationsEndpointTest.php`:

```php
    public function test_a_program_chair_only_sees_specializations_for_their_own_college(): void
    {
        [, $chairToken] = $this->programChair('chair.visibility@grc.test', CollegeCode::Ccs);
        [$ownProfessor, $ownToken] = $this->faculty('faculty.visibility-own@grc.test', CollegeCode::Ccs);
        [, $otherToken] = $this->faculty('faculty.visibility-other@grc.test', CollegeCode::Coe);
        $ownSubject = $this->subject('IT109', CollegeCode::Ccs);
        $otherSubject = $this->subject('ED104', CollegeCode::Coe);

        $this->withToken($ownToken)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $ownSubject->id,
            'proficiency' => 'secondary',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();
        $this->withToken($otherToken)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $otherSubject->id,
            'proficiency' => 'secondary',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($chairToken)->getJson('/api/v1/faculty-specializations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.professor_id', $ownProfessor->id);
    }

    public function test_faculty_specializations_can_be_filtered_by_professor_id(): void
    {
        [, $chairToken] = $this->programChair('chair.filter@grc.test', CollegeCode::Ccs);
        [$firstProfessor, $firstToken] = $this->faculty('faculty.filter-first@grc.test', CollegeCode::Ccs);
        [$secondProfessor, $secondToken] = $this->faculty('faculty.filter-second@grc.test', CollegeCode::Ccs);
        $subject = $this->subject('IT110', CollegeCode::Ccs);

        $this->withToken($firstToken)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $subject->id,
            'proficiency' => 'secondary',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();
        $anotherSubject = $this->subject('IT111', CollegeCode::Ccs);
        $this->withToken($secondToken)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $anotherSubject->id,
            'proficiency' => 'secondary',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($chairToken)->getJson("/api/v1/faculty-specializations?professor_id={$firstProfessor->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.professor_id', $firstProfessor->id);

        self::assertNotSame($firstProfessor->id, $secondProfessor->id);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && php artisan test --filter=FacultySpecializationsEndpointTest`
Expected: `test_a_program_chair_only_sees_specializations_for_their_own_college` FAILS (`assertJsonCount(1, 'data')` sees 2); `test_faculty_specializations_can_be_filtered_by_professor_id` FAILS (the `professor_id` query param is currently ignored, returns both rows).

- [ ] **Step 3: Narrow `scopeVisibleTo`**

Edit `backend/app/Models/FacultySpecialization.php`:

```php
    /**
     * Faculty members see only their own profile. A Program Chair sees only
     * their own college's professors. Other planning roles (e.g. Registrar
     * Head) need the full cross-college teaching-capability picture.
     *
     * @param  Builder<FacultySpecialization>  $query
     * @return Builder<FacultySpecialization>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->role->isLearnerScoped()) {
            return $query->where('professor_id', $user->id);
        }

        if ($user->role === UserRole::ProgramChair) {
            return $query->whereHas(
                'professor',
                fn (Builder $professors) => $professors->where('college', $user->college?->value),
            );
        }

        return $query;
    }
```

Add `use App\Domain\Identity\UserRole;` to the imports.

- [ ] **Step 4: Add the `professor_id` filter to `index`**

Edit `backend/app/Http/Controllers/Api/V1/FacultySpecializationController.php`:

```php
    public function index(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $this->authorize('viewAny', FacultySpecialization::class);

        $specializations = FacultySpecialization::query()
            ->visibleTo($user)
            ->when(
                $request->filled('professor_id'),
                fn ($query) => $query->where('professor_id', (int) $request->query('professor_id')),
            )
            ->orderBy('proficiency')
            ->orderBy('subject_id')
            ->get();

        return $this->privateResponse(FacultySpecializationResource::collection($specializations)->response($request));
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && php artisan test --filter=FacultySpecializationsEndpointTest`
Expected: all tests in this file PASS.

- [ ] **Step 6: Run the full specialization-adjacent suite once to check for fallout**

Run: `cd backend && php artisan test --filter=FacultySpecialization`
Expected: PASS (this also catches `FacultyCurriculumSubjectPreferenceEndpointTest`-style neighbors if their names match the filter; if none match beyond the file already covered, that's fine).

- [ ] **Step 7: Commit**

```bash
cd backend
git add app/Models/FacultySpecialization.php app/Http/Controllers/Api/V1/FacultySpecializationController.php tests/Feature/Api/V1/FacultySpecializationsEndpointTest.php
git commit -m "feat(faculty): scope specialization visibility to the Program Chair's own college"
```

---

## Task 5: Registrar Head can read the faculty directory across all four colleges

**Files:**
- Modify: `backend/app/Policies/FacultyMemberPolicy.php`
- Modify: `backend/app/Actions/Identity/ListFacultyMembers.php`
- Modify: `backend/app/Http/Controllers/Api/V1/FacultyMemberController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/FacultyMembersEndpointTest.php`

**Interfaces:**
- Produces: `ListFacultyMembers::execute(User $actor, AuditRequestContext $context, bool $includeInactive = false, ?string $college = null): Collection` — for `RegistrarHead`, omitting `$college` returns every college; passing it narrows to that one. For `ProgramChair`, behavior is unchanged (always their own college; `$college` is ignored for them). `GET /api/v1/faculty-members?college=coe` (Registrar Head only).

- [ ] **Step 1: Write the failing tests**

The existing `test_every_non_program_chair_role_is_forbidden` test iterates every `UserRole` except `ProgramChair` and expects 403 — this must now exclude `RegistrarHead` too, or it will fail once Registrar Head gains access. Edit `nonChairRoleProvider()` in `backend/tests/Feature/Api/V1/FacultyMembersEndpointTest.php`:

```php
    /**
     * @return iterable<string, array{UserRole}>
     */
    public static function nonChairRoleProvider(): iterable
    {
        foreach (UserRole::cases() as $role) {
            if ($role !== UserRole::ProgramChair && $role !== UserRole::RegistrarHead) {
                yield $role->value => [$role];
            }
        }
    }
```

Add new tests to the same file:

```php
    public function test_registrar_head_sees_faculty_across_every_college_and_can_filter_by_one(): void
    {
        $registrarHead = $this->makeUser('directory-registrar', UserRole::RegistrarHead, 'Registrar Head', UserStatus::Active, null);
        $ccsFaculty = $this->makeUser('directory-ccs', UserRole::Faculty, 'CCS Faculty', UserStatus::Active, CollegeCode::Ccs);
        $coeFaculty = $this->makeUser('directory-coe', UserRole::Faculty, 'COE Faculty', UserStatus::Active, CollegeCode::Coe);

        $this->withToken($this->tokenFor($registrarHead))
            ->getJson('/api/v1/faculty-members')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->withToken($this->tokenFor($registrarHead))
            ->getJson('/api/v1/faculty-members?college=coe')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $coeFaculty->id);

        self::assertNotSame($ccsFaculty->id, $coeFaculty->id);
    }

    public function test_registrar_head_cannot_edit_a_workforce_profile(): void
    {
        $registrarHead = $this->makeUser('workforce-registrar', UserRole::RegistrarHead, 'Registrar Head', UserStatus::Active, null);
        $faculty = $this->makeUser('workforce-registrar-target', UserRole::Faculty, 'Target Faculty', UserStatus::Active, CollegeCode::Ccs);

        $this->withToken($this->tokenFor($registrarHead))
            ->patchJson("/api/v1/faculty-members/{$faculty->id}/workforce-profile", [
                'status' => UserStatus::Disabled->value,
                'employment_type' => 'part_time',
                'reason' => 'Should not be allowed.',
            ])
            ->assertForbidden();
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && php artisan test --filter=FacultyMembersEndpointTest`
Expected: `test_registrar_head_sees_faculty_across_every_college_and_can_filter_by_one` FAILS with 403 (route middleware currently blocks non-`program_chair`); `test_registrar_head_cannot_edit_a_workforce_profile` currently PASSES already (also 403) but keep it as an explicit regression guard once the route regrouping in Step 6 happens (it stays 403 via the Policy, which we are not widening for `updateWorkforceProfile`).

- [ ] **Step 3: Widen `FacultyMemberPolicy::viewAny`**

Edit `backend/app/Policies/FacultyMemberPolicy.php`:

```php
    public function viewAny(User $user): bool
    {
        return ($user->role === UserRole::ProgramChair && $user->college !== null)
            || $user->role === UserRole::RegistrarHead;
    }
```

(leave `updateWorkforceProfile` untouched).

- [ ] **Step 4: Add the college branch to `ListFacultyMembers`**

Edit `backend/app/Actions/Identity/ListFacultyMembers.php`:

```php
    public function execute(
        User $actor,
        AuditRequestContext $context,
        bool $includeInactive = false,
        ?string $college = null,
    ): Collection {
        return DB::transaction(function () use ($actor, $context, $includeInactive, $college): Collection {
            $members = User::query()
                ->where('role', UserRole::Faculty)
                ->when(
                    $actor->role === UserRole::ProgramChair,
                    fn ($query) => $query->where('college', $actor->college?->value),
                )
                ->when(
                    $actor->role === UserRole::RegistrarHead && $college !== null,
                    fn ($query) => $query->where('college', $college),
                )
                ->when(! $includeInactive, fn ($query) => $query->where('status', UserStatus::Active))
                ->orderBy('name')
                ->orderBy('id')
                ->get(['id', 'name', 'college', 'employment_type', 'status']);

            $this->auditRecorder->record(
                $actor,
                AuditAction::FACULTY_DIRECTORY_LIST_VIEWED,
                AuditableType::FACULTY_DIRECTORY,
                null,
                null,
                ['result_count' => $members->count(), 'include_inactive' => $includeInactive],
                null,
                $context,
            );

            return $members;
        });
    }
```

- [ ] **Step 5: Thread the `college` query param through the controller**

Edit `backend/app/Http/Controllers/Api/V1/FacultyMemberController.php`:

```php
        $members = $listFacultyMembers->execute(
            $actor,
            $contextFactory->fromRequest($request),
            $request->boolean('include_inactive'),
            $request->string('college')->value() ?: null,
        );
```

- [ ] **Step 6: Move the `GET /faculty-members` route into a shared role group**

Edit `backend/routes/api.php`. Two precise changes inside the existing `Route::middleware('role:program_chair')->group(function (): void { ... });` block (the one starting at line 319, whose first line today is `Route::get('/faculty-members', FacultyMemberController::class)->name('faculty-members.index');`):

1. Delete this line from inside the group (it is the group's very first line):

```php
            Route::get('/faculty-members', FacultyMemberController::class)->name('faculty-members.index');
```

2. Leave every other line inside that group exactly as it is today — do not reorder, remove, or rewrite any of them (this includes `Route::patch('/faculty-members/{facultyMember}/workforce-profile', ...)`, the curriculum routes, the sections routes, and the rest of the block; Task 3, Step 8 already added `Route::patch('/faculty-specializations/{facultySpecialization}', ...)` to this same group and that line also stays untouched here).

3. Immediately after that group's closing `});`, add a new standalone route:

```php
        Route::get('/faculty-members', FacultyMemberController::class)
            ->middleware('role:program_chair,registrar_head')
            ->name('faculty-members.index');
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && php artisan test --filter=FacultyMembersEndpointTest`
Expected: all tests PASS.

Run: `cd backend && php artisan test --filter=FacultySpecializationsEndpointTest`
Expected: still all PASS (the route move in Step 6 relocates but doesn't remove the `faculty-specializations.update` route).

- [ ] **Step 8: Run the full backend suite once for this batch of route/policy changes**

Run: `cd backend && php artisan test`
Expected: PASS, or only the pre-existing baseline failures already known and unrelated to this work (per project memory: `ProgramVisibility`/migration-step-count baseline — confirm any failure matches that known list before treating it as a regression). This is the checkpoint for every backend route/Policy change across Tasks 1-5.

- [ ] **Step 9: Commit**

```bash
cd backend
git add app/Policies/FacultyMemberPolicy.php app/Actions/Identity/ListFacultyMembers.php app/Http/Controllers/Api/V1/FacultyMemberController.php routes/api.php tests/Feature/Api/V1/FacultyMembersEndpointTest.php
git commit -m "feat(faculty): let Registrar Head read the faculty directory across all colleges"
```

---

## Task 6: Frontend schemas — specialization status fields and Program-Chair inputs

**Files:**
- Modify: `frontend/src/features/schemas/faculty-schema.ts`
- Test: `frontend/src/features/components/portal/faculty-subject-preference-panel.test.tsx`

**Interfaces:**
- Produces: `FacultySpecialization` type gains `status: "pending"|"approved"|"rejected"`, `status_label: string`, `decided_at: string | null`, `decision_reason: string | null`; `source` gains `"program_chair_assigned"`. `FacultySpecializationInput` gains optional `professor_id: number`. New `decideFacultySpecializationInputSchema`/`DecideFacultySpecializationInput` (`action: "approve"|"reject"`, `reason?: string`).

- [ ] **Step 1: Write the failing test — the existing fixture must carry the new required fields**

The existing `specialization` fixture in `faculty-subject-preference-panel.test.tsx` (used by `test_...shows the subject picker...`) will fail to parse once `facultySpecializationSchema` requires the new fields. Update the fixture now so the existing test keeps passing once Step 2 lands:

```ts
const specialization = {
  type: "faculty-specialization",
  id: 9,
  professor_id: 5,
  subject_id: 501,
  proficiency: "primary",
  proficiency_label: "Primary",
  source: "declared",
  notes: null,
  status: "approved",
  status_label: "Approved",
  decided_at: null,
  decision_reason: null,
} as const
```

- [ ] **Step 2: Run the existing test to verify it currently fails against the *new* fixture but *old* schema**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-subject-preference-panel.test.tsx --pool=threads`
Expected: this actually still PASSES right now — `facultySpecializationSchema` is not `.strict()`-rejecting extra fields (extra keys on the fixture object are simply ignored by Zod unless the schema itself is `.strict()`, and `.strict()` rejects *unknown incoming* keys, which is the opposite direction of what changed here). The real failure mode is the other direction: once you flip to Step 3's `status: z.enum(...)` as a *required* field with no default, any fixture *missing* it fails. Since this fixture now includes it, this step should already pass — treat this as a sanity check, not a red-test gate.

- [ ] **Step 3: Update the schemas**

Edit `frontend/src/features/schemas/faculty-schema.ts`:

```ts
export const facultySpecializationSchema = z
  .object({
    type: z.literal("faculty-specialization"),
    id: z.number().int().positive(),
    professor_id: z.number().int().positive(),
    subject_id: z.number().int().positive(),
    proficiency: z.enum(["primary", "secondary"]),
    proficiency_label: z.string().min(1),
    source: z.enum(["declared", "seeded", "program_chair_assigned"]),
    notes: z.string().nullable(),
    status: z.enum(["pending", "approved", "rejected"]),
    status_label: z.string().min(1),
    decided_at: z.string().nullable(),
    decision_reason: z.string().nullable(),
  })
  .strict()

export const facultySpecializationsEnvelopeSchema = z
  .object({ data: z.array(facultySpecializationSchema) })
  .strict()

export const facultySpecializationEnvelopeSchema = z
  .object({ data: facultySpecializationSchema })
  .strict()

export const facultySpecializationInputSchema = z
  .object({
    professor_id: z.number().int().positive().optional(),
    subject_id: z.number().int().positive("Select a subject."),
    proficiency: z.enum(["primary", "secondary"]),
  })
  .strict()

export const decideFacultySpecializationInputSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().min(1).max(1000).optional(),
  })
  .strict()
```

Add near the other exported types:

```ts
export type DecideFacultySpecializationInput = z.infer<
  typeof decideFacultySpecializationInputSchema
>
```

(`FacultySpecialization`/`FacultySpecializationInput` type aliases already exist and pick up the new fields automatically since they're inferred from the schemas above.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-subject-preference-panel.test.tsx --pool=threads`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors introduced by this file (pre-existing unrelated errors, if any, are out of scope).

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/features/schemas/faculty-schema.ts src/features/components/portal/faculty-subject-preference-panel.test.tsx
git commit -m "feat(faculty): add specialization status fields to the frontend schema"
```

---

## Task 7: Frontend services — professor-scoped specialization list, decide, and college-filtered directory

**Files:**
- Modify: `frontend/src/features/services/faculty-service.ts`
- Modify: `frontend/src/features/services/faculty-directory-service.ts`
- Modify: `frontend/src/features/hooks/use-faculty-directory.ts`

**Interfaces:**
- Consumes: `decideFacultySpecializationInputSchema`, `DecideFacultySpecializationInput` (Task 6).
- Produces: `getFacultySpecializations(signal?, professorId?: number)`, `decideFacultySpecialization(id: number, input: DecideFacultySpecializationInput): Promise<FacultySpecialization>`, `getFacultyMembers(signal?, includeInactive = false, college?: string)`, `useFacultyDirectoryQuery(includeInactive = false, college?: string)`.

- [ ] **Step 1: Update `getFacultySpecializations` and add `decideFacultySpecialization`**

Edit `frontend/src/features/services/faculty-service.ts` — replace the existing `getFacultySpecializations` and add a new function right after `createFacultySpecialization`:

```ts
export async function getFacultySpecializations(
  signal?: AbortSignal,
  professorId?: number,
): Promise<readonly FacultySpecialization[]> {
  const path =
    professorId === undefined
      ? FACULTY_SPECIALIZATIONS_PATH
      : `${FACULTY_SPECIALIZATIONS_PATH}?professor_id=${professorId}`
  const payload = await getAuthenticatedJson(path, signal)

  return parseContract(
    facultySpecializationsEnvelopeSchema,
    payload,
    "faculty specialization list",
  ).data
}

export async function decideFacultySpecialization(
  id: number,
  input: DecideFacultySpecializationInput,
): Promise<FacultySpecialization> {
  const payload = await patchAuthenticatedJson(
    `${FACULTY_SPECIALIZATIONS_PATH}/${id}`,
    parseInput(
      decideFacultySpecializationInputSchema,
      input,
      "faculty specialization decision",
    ),
  )

  return parseContract(
    facultySpecializationEnvelopeSchema,
    payload,
    "decided faculty specialization",
  ).data
}
```

Add to the existing import block from `@/features/schemas/faculty-schema`:

```ts
  decideFacultySpecializationInputSchema,
  type DecideFacultySpecializationInput,
```

- [ ] **Step 2: Add a `college` parameter to `getFacultyMembers`**

Edit `frontend/src/features/services/faculty-directory-service.ts`:

```ts
export async function getFacultyMembers(
  signal?: AbortSignal,
  includeInactive = false,
  college?: string,
): Promise<readonly FacultyMember[]> {
  const params = new URLSearchParams()
  if (includeInactive) params.set("include_inactive", "1")
  if (college) params.set("college", college)
  const query = params.toString()
  const payload = await getAuthenticatedJson(
    query ? `${FACULTY_MEMBERS_PATH}?${query}` : FACULTY_MEMBERS_PATH,
    signal,
  )
  const result = facultyMembersEnvelopeSchema.safeParse(payload)
  if (result.success) return result.data.data
  throw new ApiClientError({
    kind: "contract",
    message:
      "The API responded, but its faculty directory did not match the published v1 contract.",
    cause: result.error,
  })
}
```

- [ ] **Step 3: Add a `college` parameter to `useFacultyDirectoryQuery`**

Edit `frontend/src/features/hooks/use-faculty-directory.ts`:

```ts
export const facultyDirectoryQueryKey = (
  userId: string | null,
  includeInactive = false,
  college?: string,
) => ["faculty-directory", userId, includeInactive, college ?? null] as const

export function useFacultyDirectoryQuery(
  includeInactive = false,
  college?: string,
) {
  const { session } = useAuth()
  return useQuery({
    queryKey: facultyDirectoryQueryKey(
      session?.userId ?? null,
      includeInactive,
      college,
    ),
    queryFn: ({ signal }) => getFacultyMembers(signal, includeInactive, college),
    enabled: session !== null,
  })
}
```

- [ ] **Step 4: Typecheck (no behavior test yet — these are pure wiring changes exercised by Tasks 9-10's component tests)**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors. Existing call sites (`useFacultyDirectoryQuery()`, `useFacultyDirectoryQuery(true)` in `faculty-loading-workspace.tsx`, `faculty-assignment-workspace.tsx`, `program-chair-enrollment-workspace.tsx`, `room-detail-dialog.tsx`, `rooms-operations-workspace.tsx`, `schedule-workspace.tsx`) compile unchanged since the new parameter is optional.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/features/services/faculty-service.ts src/features/services/faculty-directory-service.ts src/features/hooks/use-faculty-directory.ts
git commit -m "feat(faculty): add professor/college-scoped fetch and decide functions"
```

---

## Task 8: `FacultyWorkforceWorkspace` — roster, search, college filter, and the workforce-profile dialog (ported)

**Files:**
- Create: `frontend/src/features/components/portal/faculty-workforce-workspace.tsx`
- Create: `frontend/src/features/components/portal/faculty-workforce-workspace.test.tsx`

**Interfaces:**
- Consumes: `useFacultyDirectoryQuery` (Task 7), `updateFacultyWorkforceProfile` (existing, `faculty-directory-service.ts`), `useAuth` (existing, exposes `session.role`, `session.college`).
- Produces: `FacultyWorkforceWorkspace` component (default export style matches the rest of this codebase's named-export workspaces — export as `FacultyWorkforceWorkspace`).

- [ ] **Step 1: Write the failing test**

```tsx
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { FacultyWorkforceWorkspace } from "@/features/components/portal/faculty-workforce-workspace"
import { renderWithSession } from "@/tests/render-app"

const facultyCcs = {
  data: [
    {
      type: "faculty_member",
      id: 12,
      name: "Prof. Reyes",
      college: "ccs",
      status: "active",
      status_label: "Active",
      employment_type: "full_time",
      employment_type_label: "Full-time",
      planning_unit_reference: 33,
      is_assignable: true,
    },
  ],
} as const

const facultyAllColleges = {
  data: [
    ...facultyCcs.data,
    {
      type: "faculty_member",
      id: 40,
      name: "Prof. Santos",
      college: "coe",
      status: "active",
      status_label: "Active",
      employment_type: "part_time",
      employment_type_label: "Part-time",
      planning_unit_reference: null,
      is_assignable: true,
    },
  ],
} as const

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  return input instanceof URL ? input.toString() : input.url
}

function mockFetch(fetchMock: ReturnType<typeof vi.fn>, facultyPayload: unknown) {
  fetchMock.mockImplementation((input) => {
    const url = requestUrl(input)
    const body = url.includes("/faculty-members")
      ? facultyPayload
      : url.includes("/faculty-specializations")
        ? { data: [] }
        : { data: [] }
    return Promise.resolve(new Response(JSON.stringify(body)))
  })
}

describe("FacultyWorkforceWorkspace", () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal("fetch", fetchMock))
  afterEach(() => vi.unstubAllGlobals())

  it("lets a Program Chair search the roster, open a professor, and edit their workforce profile", async () => {
    mockFetch(fetchMock, facultyCcs)
    const user = userEvent.setup()
    renderWithSession(<FacultyWorkforceWorkspace />, {
      session: {
        userId: "chair-1",
        displayName: "Program Chair",
        role: "program_chair",
        college: "ccs",
        signedInAt: "2026-08-09T00:00:00Z",
      },
    })

    await user.type(await screen.findByLabelText("Search faculty by name"), "Reyes")
    expect(await screen.findByText("Prof. Reyes")).toBeInTheDocument()

    await user.click(screen.getByText("Prof. Reyes"))
    const dialog = await screen.findByRole("dialog", { name: "Prof. Reyes" })
    expect(within(dialog).getByLabelText("Account status")).toBeInTheDocument()
    expect(
      within(dialog).queryByText("You have read-only access."),
    ).not.toBeInTheDocument()
  })

  it("gives Registrar Head a read-only view with a college filter and no edit access", async () => {
    mockFetch(fetchMock, facultyAllColleges)
    const user = userEvent.setup()
    renderWithSession(<FacultyWorkforceWorkspace />, {
      session: {
        userId: "registrar-1",
        displayName: "Registrar Head",
        role: "registrar_head",
        college: null,
        signedInAt: "2026-08-09T00:00:00Z",
      },
    })

    expect(await screen.findByText("Prof. Reyes")).toBeInTheDocument()
    expect(screen.getByText("Prof. Santos")).toBeInTheDocument()
    expect(screen.getByLabelText("College")).toBeInTheDocument()

    await user.click(screen.getByText("Prof. Santos"))
    const dialog = await screen.findByRole("dialog", { name: "Prof. Santos" })
    expect(within(dialog).queryByLabelText("Account status")).not.toBeInTheDocument()
    expect(within(dialog).getByText("You have read-only access.")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-workforce-workspace.test.tsx --pool=threads`
Expected: FAIL — the module does not exist yet.

- [ ] **Step 3: Write the component**

```tsx
"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { FacultyWorkforceSpecializationsPanel } from "@/features/components/portal/faculty-workforce-specializations-panel"
import { WorkspaceField } from "@/features/components/portal/workspace-field"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Button } from "@/features/components/ui/button"
import { Input } from "@/features/components/ui/input"
import { useFacultyDirectoryQuery } from "@/features/hooks/use-faculty-directory"
import { updateFacultyWorkforceProfile } from "@/features/services/faculty-directory-service"
import type { FacultyMember } from "@/features/schemas/scheduling-schema"

const COLLEGE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "All colleges" },
  { value: "ccs", label: "College of Computer Studies" },
  { value: "coe", label: "College of Education" },
  { value: "coa", label: "College of Accountancy" },
  { value: "cbae", label: "College of Business Administration and Entrepreneurship" },
]

export function FacultyWorkforceWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const canManage = session?.role === "program_chair"
  const [search, setSearch] = useState("")
  const [collegeFilter, setCollegeFilter] = useState("")
  const facultyQuery = useFacultyDirectoryQuery(
    true,
    canManage ? undefined : collegeFilter || undefined,
  )
  const [selected, setSelected] = useState<FacultyMember | null>(null)
  const [draft, setDraft] = useState({
    status: "active" as "active" | "disabled",
    employment_type: "part_time" as "full_time" | "part_time",
    reason: "",
  })

  const saveWorkforceProfile = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Choose a faculty member to edit.")
      return updateFacultyWorkforceProfile(selected.id, {
        status: draft.status,
        employment_type: draft.employment_type,
        reason: draft.reason || undefined,
      })
    },
    onSuccess: () => {
      setSelected(null)
      void queryClient.invalidateQueries({ queryKey: ["faculty-directory"] })
    },
  })

  const openProfessor = (member: FacultyMember) => {
    setSelected(member)
    setDraft({
      status: member.status,
      employment_type: member.employment_type ?? "part_time",
      reason: "",
    })
  }

  const visibleFaculty = (facultyQuery.data ?? []).filter((member) =>
    member.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <WorkspacePage
      title="Faculty Workforce"
      description="Search professors, review their profile, and manage which subjects they can teach."
      lastUpdated={facultyQuery.dataUpdatedAt}
    >
      <AsyncBoundary query={facultyQuery} loadingLabel="Loading faculty…">
        {() => (
          <div className="grid gap-5">
            <Card>
              <CardHeader>
                <CardTitle level={2}>Faculty roster</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <label className="grid gap-2 text-sm font-medium">
                    Search
                    <Input
                      aria-label="Search faculty by name"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name"
                    />
                  </label>
                  {!canManage && (
                    <label className="grid gap-2 text-sm font-medium">
                      College
                      <select
                        aria-label="College"
                        value={collegeFilter}
                        onChange={(event) => setCollegeFilter(event.target.value)}
                        className="h-9 rounded-md border bg-background px-2"
                      >
                        {COLLEGE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="grid gap-2">
                  {visibleFaculty.map((member) => (
                    <button
                      type="button"
                      key={member.id}
                      onClick={() => openProfessor(member)}
                      className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-accent"
                    >
                      <span>{member.name}</span>
                      <Badge variant={member.is_assignable ? "secondary" : "destructive"}>
                        {member.status_label}
                      </Badge>
                    </button>
                  ))}
                  {visibleFaculty.length === 0 && (
                    <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                      No faculty match your search.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </AsyncBoundary>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.name ?? "Faculty member"}</DialogTitle>
            <DialogDescription>
              {canManage
                ? "Review this professor's profile and the subjects they may teach."
                : "Review this professor's profile and the subjects they may teach."}
            </DialogDescription>
          </DialogHeader>

          {!canManage && (
            <p className="text-sm text-muted-foreground">You have read-only access.</p>
          )}

          {canManage && selected && (
            <div className="grid gap-4">
              <WorkspaceField label="Account status">
                <select
                  aria-label="Account status"
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({ ...draft, status: event.target.value as "active" | "disabled" })
                  }
                  className="h-9 rounded-md border bg-background px-2"
                >
                  <option value="active">Active</option>
                  <option value="disabled">Inactive</option>
                </select>
              </WorkspaceField>
              <WorkspaceField label="Employment type">
                <select
                  aria-label="Employment type"
                  value={draft.employment_type}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      employment_type: event.target.value as "full_time" | "part_time",
                    })
                  }
                  className="h-9 rounded-md border bg-background px-2"
                >
                  <option value="full_time">Full-time (33-unit reference)</option>
                  <option value="part_time">Part-time</option>
                </select>
              </WorkspaceField>
              <WorkspaceField
                label={
                  selected.status === "active" && draft.status === "disabled"
                    ? "Reason for making this account inactive"
                    : "Change note (optional)"
                }
              >
                <Input
                  value={draft.reason}
                  onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
                  placeholder="Record the reason for this change"
                />
              </WorkspaceField>
              {saveWorkforceProfile.error instanceof Error && (
                <p className="text-sm text-destructive">{saveWorkforceProfile.error.message}</p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => void saveWorkforceProfile.mutateAsync()}
                  disabled={
                    saveWorkforceProfile.isPending ||
                    (selected.status === "active" &&
                      draft.status === "disabled" &&
                      !draft.reason.trim())
                  }
                >
                  {saveWorkforceProfile.isPending ? "Saving…" : "Save workforce profile"}
                </Button>
              </DialogFooter>
            </div>
          )}

          {selected && (
            <FacultyWorkforceSpecializationsPanel
              professorId={selected.id}
              college={selected.college}
              canManage={canManage}
            />
          )}
        </DialogContent>
      </Dialog>
    </WorkspacePage>
  )
}
```

This task references `FacultyWorkforceSpecializationsPanel`, built in Task 9 — this task's own test mocks `/faculty-specializations` to return `{ data: [] }`, so the panel renders its empty state and does not block this task's assertions. Do not implement the panel's internals in this task.

- [ ] **Step 4: Create a minimal stub for `FacultyWorkforceSpecializationsPanel` so Task 8 compiles standalone**

```tsx
"use client"

export function FacultyWorkforceSpecializationsPanel(_props: {
  professorId: number
  college: string | null
  canManage: boolean
}) {
  return null
}
```

Save this at `frontend/src/features/components/portal/faculty-workforce-specializations-panel.tsx`. Task 9 replaces this entire file with the real implementation via TDD — this stub only exists so this task's test can run in isolation.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-workforce-workspace.test.tsx --pool=threads`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/features/components/portal/faculty-workforce-workspace.tsx src/features/components/portal/faculty-workforce-workspace.test.tsx src/features/components/portal/faculty-workforce-specializations-panel.tsx
git commit -m "feat(faculty): add FacultyWorkforceWorkspace roster and workforce-profile dialog"
```

---

## Task 9: `FacultyWorkforceSpecializationsPanel` — list, add, approve, reject

**Files:**
- Modify: `frontend/src/features/components/portal/faculty-workforce-specializations-panel.tsx` (replaces Task 8's stub)
- Modify: `frontend/src/features/components/portal/faculty-workforce-workspace.test.tsx`

**Interfaces:**
- Consumes: `getFacultySpecializations`, `createFacultySpecialization`, `decideFacultySpecialization` (Task 7), `useSubjectsQuery` (existing, `@/features/hooks/use-reference-data`), `SearchableCombobox` (existing).
- Produces: `FacultyWorkforceSpecializationsPanel({ professorId, college, canManage }): JSX.Element`.

- [ ] **Step 1: Write the failing tests**

Add to `faculty-workforce-workspace.test.tsx`, replacing the `mockFetch` helper to also serve subjects and specializations, and adding new test cases:

```tsx
const subjectsCcs = {
  data: [
    { type: "subject", id: 501, code: "IT101", title: "Intro to Computing", units: 3, status: "active", status_label: "Active", is_completion_only: false, college: "ccs" },
  ],
} as const

const pendingSpecialization = {
  type: "faculty-specialization",
  id: 77,
  professor_id: 12,
  subject_id: 501,
  proficiency: "primary",
  proficiency_label: "Primary",
  source: "declared",
  notes: null,
  status: "pending",
  status_label: "Pending",
  decided_at: null,
  decision_reason: null,
} as const

function mockFetch(
  fetchMock: ReturnType<typeof vi.fn>,
  facultyPayload: unknown,
  specializationsPayload: unknown = { data: [] },
) {
  fetchMock.mockImplementation((input, init) => {
    const url = requestUrl(input)
    if (url.includes("/faculty-members")) return Promise.resolve(new Response(JSON.stringify(facultyPayload)))
    if (url.includes("/subjects")) return Promise.resolve(new Response(JSON.stringify(subjectsCcs)))
    if (url.includes("/faculty-specializations") && (!init || init.method === undefined))
      return Promise.resolve(new Response(JSON.stringify(specializationsPayload)))
    if (url.includes("/faculty-specializations") && init?.method === "POST")
      return Promise.resolve(new Response(JSON.stringify({ data: { ...pendingSpecialization, status: "approved", status_label: "Approved", source: "program_chair_assigned" } }), { status: 201 }))
    if (url.match(/\/faculty-specializations\/\d+$/) && init?.method === "PATCH")
      return Promise.resolve(new Response(JSON.stringify({ data: { ...pendingSpecialization, status: "approved", status_label: "Approved" } })))
    return Promise.resolve(new Response(JSON.stringify({ data: [] })))
  })
}
```

```tsx
  it("shows a Program Chair the specialization list and lets them approve a pending row", async () => {
    mockFetch(fetchMock, facultyCcs, { data: [pendingSpecialization] })
    const user = userEvent.setup()
    renderWithSession(<FacultyWorkforceWorkspace />, {
      session: {
        userId: "chair-1",
        displayName: "Program Chair",
        role: "program_chair",
        college: "ccs",
        signedInAt: "2026-08-09T00:00:00Z",
      },
    })

    await user.click(await screen.findByText("Prof. Reyes"))
    const dialog = await screen.findByRole("dialog", { name: "Prof. Reyes" })

    expect(await within(dialog).findByText("IT101 — Intro to Computing")).toBeInTheDocument()
    expect(within(dialog).getByText("Pending")).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Approve" }))

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "PATCH",
      )
      expect(patchCall).toBeDefined()
    })
  })

  it("requires a reason before rejecting a pending specialization", async () => {
    mockFetch(fetchMock, facultyCcs, { data: [pendingSpecialization] })
    const user = userEvent.setup()
    renderWithSession(<FacultyWorkforceWorkspace />, {
      session: {
        userId: "chair-1",
        displayName: "Program Chair",
        role: "program_chair",
        college: "ccs",
        signedInAt: "2026-08-09T00:00:00Z",
      },
    })

    await user.click(await screen.findByText("Prof. Reyes"))
    const dialog = await screen.findByRole("dialog", { name: "Prof. Reyes" })

    await user.click(within(dialog).getByRole("button", { name: "Reject" }))
    expect(within(dialog).getByRole("button", { name: "Confirm rejection" })).toBeDisabled()

    await user.type(within(dialog).getByLabelText("Reason for rejection"), "Needs more evidence.")
    expect(within(dialog).getByRole("button", { name: "Confirm rejection" })).toBeEnabled()
  })

  it("does not show manage controls for a Registrar Head viewing the panel", async () => {
    mockFetch(fetchMock, facultyAllColleges, { data: [pendingSpecialization] })
    const user = userEvent.setup()
    renderWithSession(<FacultyWorkforceWorkspace />, {
      session: {
        userId: "registrar-1",
        displayName: "Registrar Head",
        role: "registrar_head",
        college: null,
        signedInAt: "2026-08-09T00:00:00Z",
      },
    })

    await user.click(await screen.findByText("Prof. Reyes"))
    const dialog = await screen.findByRole("dialog", { name: "Prof. Reyes" })

    expect(await within(dialog).findByText("IT101 — Intro to Computing")).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: "Add subject" })).not.toBeInTheDocument()
  })
```

Add `waitFor` to the existing `import { screen, within } from "@testing-library/react"` line (`import { screen, waitFor, within } from "@testing-library/react"`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-workforce-workspace.test.tsx --pool=threads`
Expected: the three new tests FAIL — the stub panel renders nothing.

- [ ] **Step 3: Write the real panel**

```tsx
"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import { Input } from "@/features/components/ui/input"
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useSubjectsQuery } from "@/features/hooks/use-reference-data"
import {
  createFacultySpecialization,
  decideFacultySpecialization,
  getFacultySpecializations,
} from "@/features/services/faculty-service"

const STATUS_BADGE_VARIANT: Record<string, "secondary" | "warning" | "destructive"> = {
  approved: "secondary",
  pending: "warning",
  rejected: "destructive",
}

interface FacultyWorkforceSpecializationsPanelProps {
  professorId: number
  college: string | null
  canManage: boolean
}

export function FacultyWorkforceSpecializationsPanel({
  professorId,
  college,
  canManage,
}: FacultyWorkforceSpecializationsPanelProps) {
  const queryClient = useQueryClient()
  const specializationsQuery = useQuery({
    queryKey: ["faculty-workforce-specializations", professorId],
    queryFn: ({ signal }) => getFacultySpecializations(signal, professorId),
    enabled: professorId > 0,
  })
  const subjectsQuery = useSubjectsQuery()
  const [newSubjectId, setNewSubjectId] = useState("")
  const [newProficiency, setNewProficiency] = useState<"primary" | "secondary">("secondary")
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const invalidate = () =>
    void queryClient.invalidateQueries({
      queryKey: ["faculty-workforce-specializations", professorId],
    })

  const addSpecialization = useMutation({
    mutationFn: () =>
      createFacultySpecialization({
        professor_id: professorId,
        subject_id: Number(newSubjectId),
        proficiency: newProficiency,
      }),
    onSuccess: () => {
      setNewSubjectId("")
      invalidate()
    },
  })

  const decide = useMutation({
    mutationFn: ({ id, action, reason }: { id: number; action: "approve" | "reject"; reason?: string }) =>
      decideFacultySpecialization(id, { action, reason }),
    onSuccess: () => {
      setRejectingId(null)
      setRejectReason("")
      invalidate()
    },
  })

  const subjectsById = new Map(
    (subjectsQuery.data ?? []).map((subject) => [subject.id, subject]),
  )
  const existingSubjectIds = new Set(
    (specializationsQuery.data ?? []).map((row) => row.subject_id),
  )
  const subjectOptions = (subjectsQuery.data ?? [])
    .filter((subject) => subject.college === college && !existingSubjectIds.has(subject.id))
    .map((subject) => ({ value: String(subject.id), label: `${subject.code} — ${subject.title}` }))

  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-semibold">Subjects this professor can teach</h3>
      <div className="overflow-x-auto rounded-md border">
        <Table aria-label="Subject specializations">
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Proficiency</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(specializationsQuery.data ?? []).map((row) => {
              const subject = subjectsById.get(row.subject_id)
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    {subject ? `${subject.code} — ${subject.title}` : `Subject #${row.subject_id}`}
                  </TableCell>
                  <TableCell>{row.proficiency_label}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{row.status_label}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      {row.status === "pending" && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => decide.mutate({ id: row.id, action: "approve" })}
                          >
                            Approve
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="ml-2"
                            onClick={() => setRejectingId(row.id)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {(specializationsQuery.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 4 : 3} className="text-center text-muted-foreground">
                  No subjects declared yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canManage && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="grid gap-2 text-sm font-medium">
            Add subject
            <SearchableCombobox
              id="workforce-add-subject"
              label="Add subject"
              options={subjectOptions}
              value={newSubjectId}
              onValueChange={setNewSubjectId}
              placeholder="Search code or title"
              emptyMessage="No matching subject."
            />
          </label>
          <select
            aria-label="Proficiency"
            value={newProficiency}
            onChange={(event) => setNewProficiency(event.target.value as "primary" | "secondary")}
            className="h-9 rounded-md border bg-background px-2"
          >
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
          </select>
          <Button
            type="button"
            onClick={() => void addSpecialization.mutateAsync()}
            disabled={!newSubjectId || addSpecialization.isPending}
          >
            Add subject
          </Button>
        </div>
      )}

      <AlertDialog open={rejectingId !== null} onOpenChange={(open) => !open && setRejectingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this subject</AlertDialogTitle>
            <AlertDialogDescription>
              <label className="grid gap-2 text-sm font-medium">
                Reason for rejection
                <Input
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Explain why this is not approved"
                />
              </label>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={decide.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={decide.isPending || !rejectReason.trim()}
              onClick={() =>
                rejectingId !== null &&
                decide.mutate({ id: rejectingId, action: "reject", reason: rejectReason })
              }
            >
              Confirm rejection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

Note: `AlertDialogAction`'s default rendered element is a `Button`-styled element whose accessible name comes from its children text ("Confirm rejection") — matches the existing `faculty-specialization-list.tsx` precedent for this same primitive.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-workforce-workspace.test.tsx --pool=threads`
Expected: all tests in the file PASS (Task 8's two tests plus Task 9's three).

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/features/components/portal/faculty-workforce-specializations-panel.tsx src/features/components/portal/faculty-workforce-workspace.test.tsx
git commit -m "feat(faculty): add subject specialization list, add, approve, and reject to the workforce panel"
```

---

## Task 10: Register the new "Faculty Workforce" nav module for both roles

**Files:**
- Modify: `frontend/src/features/portal/role-capabilities.ts`
- Modify: `frontend/src/features/portal/module-registry.tsx`
- Test: `frontend/src/features/portal/role-capabilities.test.ts`
- Test: `frontend/src/features/portal/module-registry.test.tsx`

**Interfaces:**
- Consumes: `FacultyWorkforceWorkspace` (Task 8).
- Produces: `ConnectedModuleId` gains `"faculty-workforce"`; both `program_chair` and `registrar_head` role definitions gain a `portalModule("faculty-workforce", "Faculty Workforce", ...)` entry.

- [ ] **Step 1: Write the failing tests**

`role-capabilities.test.ts` enforces an exact, ordered module-id list per role via `toEqual` against an `expectedModuleIds` map. Edit `frontend/src/features/portal/role-capabilities.test.ts`: insert `"faculty-workforce"` into `expectedModuleIds.program_chair` right after `"faculty-loading"`, and into `expectedModuleIds.registrar_head` right after `"rooms"`:

```ts
  program_chair: [
    "program-chair-enrollment",
    "subjects-prerequisites",
    "schedule",
    "faculty-loading",
    "faculty-workforce",
    "rooms",
    "schedule-proposals",
    "program-chair-analytics",
    "faculty-invitations",
  ],
```

```ts
  registrar_head: [
    "academic-terms",
    "grade-approvals",
    "academic-transcripts",
    "cor-records",
    "overrides-voids",
    "enrollment-change-requests",
    "attrition-analytics",
    "registrar-analytics",
    "compliance-reports",
    "audit-logs",
    "policy-settings",
    "rooms",
    "faculty-workforce",
    "staff-invitations",
  ],
```

`module-registry.test.tsx`'s `"dispatches every role-owned connected module ID"` test renders every connected module's component with an all-`{data: []}`-mocked `fetch` and asserts its accessible region name — via `migratedRegionNames[moduleId]` for any module built on `WorkspacePage` (which `FacultyWorkforceWorkspace` is, per Task 8 — its `<h2>` heading is its `WorkspacePage title="Faculty Workforce"` prop). Edit `frontend/src/features/portal/module-registry.test.tsx`, add to `migratedRegionNames` (anywhere in the object, e.g. right after the `"faculty-loading": "Faculty Loading",` line):

```ts
  "faculty-workforce": "Faculty Workforce",
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/features/portal/role-capabilities.test.ts src/features/portal/module-registry.test.tsx --pool=threads`
Expected: FAIL — module id not present.

- [ ] **Step 3: Add the icon import and module entries in `role-capabilities.ts`**

`Users` is already imported (used elsewhere in this file). Insert into `program_chair.modules`, immediately after the `"faculty-loading"` entry (after its closing `),` around line 155):

```ts
      portalModule(
        "faculty-workforce",
        "Faculty Workforce",
        "Search professors in your college, manage their workforce status, and approve which subjects they may teach.",
        Users,
      ),
```

Insert into `registrar_head.modules`, immediately after the `"rooms"` entry (after its closing `),` around line 335):

```ts
      portalModule(
        "faculty-workforce",
        "Faculty Workforce",
        "View faculty across every college and the subjects they are approved to teach.",
        Users,
      ),
```

- [ ] **Step 4: Wire the module in `module-registry.tsx`**

Add the import near the other workspace imports:

```ts
import { FacultyWorkforceWorkspace } from "@/features/components/portal/faculty-workforce-workspace"
```

Add `"faculty-workforce"` to the `ConnectedModuleId` union (after `"faculty-loading"`):

```ts
  | "faculty-workforce"
```

Add `"faculty-workforce"` to the `connectedModuleIds` array (after `"faculty-loading"`):

```ts
  "faculty-workforce",
```

Add a wrapper and registry entry (after the `facultyLoadingWorkspace` wrapper, around line 164):

```ts
const facultyWorkforceWorkspace: PortalModuleComponent = () => (
  <FacultyWorkforceWorkspace />
)
```

```ts
  "faculty-workforce": facultyWorkforceWorkspace,
```

(placed in `connectedModuleRegistry`, right after `"faculty-loading": facultyLoadingWorkspace,`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/portal/role-capabilities.test.ts src/features/portal/module-registry.test.tsx --pool=threads`
Expected: PASS.

- [ ] **Step 6: Manually sanity-check the route resolves**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/features/portal/role-capabilities.ts src/features/portal/module-registry.tsx src/features/portal/role-capabilities.test.ts src/features/portal/module-registry.test.tsx
git commit -m "feat(faculty): add Faculty Workforce nav entry for Program Chair and Registrar Head"
```

---

## Task 11: Strip the old Faculty Workforce dialog out of Faculty Loading

**Files:**
- Modify: `frontend/src/features/components/portal/faculty-loading-workspace.tsx`
- Modify: `frontend/src/features/components/portal/faculty-loading-workspace.test.tsx`

**Interfaces:**
- Produces: `FacultyLoadingWorkspace` no longer renders a "Faculty Workforce" button or either of its two dialogs; the load report, threshold, term selector, and Subject/Professor filters are otherwise unchanged.

- [ ] **Step 1: Remove the now-obsolete test**

In `frontend/src/features/components/portal/faculty-loading-workspace.test.tsx`, delete the entire `it("opens the Faculty Workforce table in a modal and edits a profile from within it", ...)` test block (this behavior now lives in `faculty-workforce-workspace.test.tsx`, Task 8).

- [ ] **Step 2: Run the remaining tests to confirm they still pass before touching the component**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-loading-workspace.test.tsx --pool=threads`
Expected: PASS (4 remaining tests) — this confirms the test file itself is still valid before the component changes.

- [ ] **Step 3: Remove the dialog code and its state/mutations from the component**

Edit `frontend/src/features/components/portal/faculty-loading-workspace.tsx`:

- Remove the `PencilLine`, `Users` icon imports if no longer used elsewhere in the file (check remaining usages first — `Users` was only used by the "Faculty Workforce" button and its dialog table icon; `PencilLine` was only used by the per-row Edit button; both become unused).
- Remove `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` imports if no longer used elsewhere in the file (they were only used by the workforce table).
- Remove `workforceQuery`, `workforceOpen`, `workforceEditing`, `workforceDraft`, `visibleWorkforce`, `saveWorkforceProfile`, `openWorkforceProfile`.
- Remove `workforceQuery.isPending`/`isError`/`error`/`refetch()` from the `query` aggregate object (mirrors the earlier `subjectsQuery` removal already done in this codebase's history — same shape).
- Remove the "Faculty Workforce" `Button` from the Faculty Load Report `CardHeader` (keep the `Badge` showing `{visibleFaculty.length} professors`).
- Remove both `<Dialog>` blocks (the workforce list dialog and the edit-profile dialog) entirely.

- [ ] **Step 4: Run tests to verify they still pass**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-loading-workspace.test.tsx --pool=threads`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no unused-import or unused-variable errors for this file.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/features/components/portal/faculty-loading-workspace.tsx src/features/components/portal/faculty-loading-workspace.test.tsx
git commit -m "refactor(faculty): remove the Faculty Workforce dialog from Faculty Loading, now its own page"
```

---

## Task 12: Show approval status on a professor's own declared specializations

**Files:**
- Modify: `frontend/src/features/components/portal/faculty-specialization-list.tsx`
- Modify: `frontend/src/features/components/portal/faculty-subject-preference-panel.test.tsx`

**Interfaces:**
- Consumes: `FacultySpecialization.status`/`status_label` (Task 6).
- Produces: the "Declared specializations" table gains a Status column.

- [ ] **Step 1: Write the failing test**

Add to `faculty-subject-preference-panel.test.tsx`, a new case alongside the existing "shows the subject picker..." test:

```tsx
  it("shows the approval status of a declared specialization", async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation((input) => {
      const requestUrl = url(input)
      if (requestUrl.endsWith("/faculty-preference-catalog"))
        return Promise.resolve(new Response(JSON.stringify(catalog)))
      if (requestUrl.endsWith("/faculty-specializations"))
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [{ ...specialization, status: "pending", status_label: "Pending" }],
            }),
          ),
        )
      return Promise.resolve(new Response(JSON.stringify({ data: [] })))
    })
    renderWithSession(<FacultyInputWorkspace />, { session })

    await user.click(await screen.findByRole("tab", { name: "Subject preferences" }))

    expect(
      within(
        screen.getByRole("table", { name: "Declared specializations" }),
      ).getByText("Pending"),
    ).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-subject-preference-panel.test.tsx --pool=threads`
Expected: FAIL — no "Pending" text rendered anywhere yet.

- [ ] **Step 3: Add the Status column**

Edit `frontend/src/features/components/portal/faculty-specialization-list.tsx` — in the "Declared specializations" `Table` (the second one in the file), add a `Status` column:

```tsx
                <Table aria-label="Declared specializations">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Proficiency</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows
                      .filter((row) => row.source === "declared")
                      .map((row) => {
                        const subject = subjectsById.get(row.subject_id)

                        return (
                          <TableRow key={row.id}>
                            <TableCell>
                              {subject
                                ? `${subject.code} — ${subject.title}`
                                : `Subject #${row.subject_id}`}
                            </TableCell>
                            <TableCell>{row.proficiency_label}</TableCell>
                            <TableCell>{row.status_label}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                aria-label="Remove specialization"
                                onClick={() => onRemoveSpecialization(row)}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </TableBody>
                </Table>
```

(only the `<TableHead>Status</TableHead>` and `<TableCell>{row.status_label}</TableCell>` lines are new; everything else in this block is unchanged, shown here for exact placement).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/features/components/portal/faculty-subject-preference-panel.test.tsx --pool=threads`
Expected: PASS (all tests in the file, including the new one).

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/features/components/portal/faculty-specialization-list.tsx src/features/components/portal/faculty-subject-preference-panel.test.tsx
git commit -m "feat(faculty): show approval status on a professor's declared specializations"
```

---

## Task 13: Notification presentation for the new approval notifications

**Files:**
- Modify: `frontend/src/features/lib/notification-presentation.ts`

**Interfaces:**
- Produces: `PRESENTATION_BY_TYPE` gains entries for `faculty_specialization_approved`/`faculty_specialization_rejected`; `notificationDestinationPath` routes both, for the `faculty` role, to `/portal/availability-preferences`.

- [ ] **Step 1: Add the presentation entries**

Edit `frontend/src/features/lib/notification-presentation.ts` — add to `PRESENTATION_BY_TYPE`, after `enrollment_change_request_rejected`:

```ts
  faculty_specialization_approved: {
    label: "Subject approved",
    tone: "success",
    icon: BadgeCheck,
  },
  faculty_specialization_rejected: {
    label: "Subject not approved",
    tone: "destructive",
    icon: Ban,
  },
```

- [ ] **Step 2: Add the destination path case**

Edit the `switch` in `notificationDestinationPath`, add before `default:`:

```ts
    case "faculty_specialization_approved":
    case "faculty_specialization_rejected":
      return role === "faculty" ? "/portal/availability-preferences" : null
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add src/features/lib/notification-presentation.ts
git commit -m "feat(faculty): present the specialization approval/rejection notifications"
```

---

## Task 14: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full backend suite**

Run: `cd backend && php artisan test`
Expected: PASS, or only pre-existing baseline failures unrelated to this work (per project memory, the `ProgramVisibility`/migration-step-count baseline — cross-check any failure's test name against that known list before treating it as a regression from this plan).

- [ ] **Step 2: Run the full frontend suite**

Run: `cd frontend && npx vitest run --pool=threads`
Expected: PASS, or only the pre-existing `curriculum-workspace`/`schedule-decision-workspace`/`curriculum-schema` baseline (9 tests, per project memory) — confirm the failing test names match that known list exactly.

- [ ] **Step 3: Manually verify in the browser**

Log in as the seeded `chair.ccs@grc.test` / `password` account, open "Faculty Workforce" from the nav, search for a professor, open their detail dialog, edit their workforce status, add a subject specialization directly (confirm it shows "Approved" immediately), then — logged in as a seeded faculty account in the same college — declare a new subject preference with a proficiency and confirm it shows "Pending" both in their own view and in the Program Chair's Faculty Workforce panel, then approve or reject it as the Program Chair and confirm the badge updates. Log in as `registrar-head.seed@grc.test` (or the seeded Registrar Head identity — check `docs/testing/SEEDED_IDENTITIES.md` for the exact email) and confirm "Faculty Workforce" shows all four colleges with a working College filter and no edit/approve controls anywhere.

- [ ] **Step 4: Report completion**

No commit for this task — it is verification-only. If Steps 1-3 all pass, the feature is complete.
