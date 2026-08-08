# Program Chair Curriculum Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Program Chairs a college-scoped two-step curriculum wizard and a Draft-only, year/semester spreadsheet that can create or reuse subjects safely.

**Architecture:** The Laravel API becomes the authority for Program Chair college access, hidden school-year selection, current-curriculum reuse candidates, and atomic creation of a new subject plus its Draft placement. The React workspace is split into a creation wizard, preview/edit shell, spreadsheet, and row-source dialogs; services and TanStack Query hooks own every API call and cache invalidation.

**Tech Stack:** Laravel 12/PHP 8.4, MySQL, Sanctum, Form Requests, Policies, Actions, API Resources, PHPUnit; Next.js 16/React 19 strict TypeScript, TanStack Query 5, React Hook Form 7, Zod 4, Tailwind CSS 4, shadcn/ui, Vitest 4.

## Global Constraints

- Work only in `C:\xampp\htdocs\GRC-ENROLLMENT\.claude\worktrees\curriculum-approval-workflow`; preserve its unrelated uncommitted approval-workflow changes.
- Use versioned `/api/v1` REST routes, Sanctum bearer authentication, Form Requests, Policies, Actions, Resources, database transactions, audit records, and automated tests.
- Program Chair access is restricted to the authenticated user's assigned college on every list, create, update, source-query, and placement-write path.
- The client never submits editable curriculum status, effective school year, or college; the server derives/owns those values.
- Preserve the existing Draft → Pending Dean Review → Pending Executive Review → Active flow, the manual Archived path, and all Draft locking behavior.
- Preserve 1st–4th Year tabs and 1st/2nd Semester placement. Do not restore the old “Subject to place” or “Add subject placement” controls.
- Keep API calls out of rendering components. Use strict TypeScript, TanStack Query, React Hook Form, Zod, Tailwind CSS, and existing shadcn/ui primitives.
- Update `PROGRESS.md` before substantial work, after every meaningful milestone/failure, and before handoff. Do not commit or push unless the user explicitly authorizes it.
- Run focused checks after each task. Before phase completion, run the applicable broader suites and report the known local MySQL migration-privilege blocker and known unrelated TypeScript fixture errors accurately if they remain.

## Locked file structure

### Backend files

- Modify `backend/app/Models/Program.php` to scope Program Chair program visibility by college.
- Modify `backend/app/Policies/CurriculumPolicy.php` to require college ownership for Program Chair create/update operations.
- Create `backend/app/Actions/Curriculum/ResolveCurriculumEffectiveSchoolYear.php` to resolve the current academic-term school year with the latest-term fallback.
- Modify `backend/app/Http/Requests/Api/V1/Curriculum/StoreCurriculumRequest.php`, `backend/app/Actions/Curriculum/CreateCurriculum.php`, and `backend/app/Http/Controllers/Api/V1/CurriculumController.php` to remove client-controlled effective year and use the resolver.
- Modify `backend/app/Http/Requests/Api/V1/Curriculum/UpdateCurriculumRequest.php` and `backend/app/Actions/Curriculum/UpdateCurriculum.php` to keep effective year immutable after creation.
- Create `backend/app/Actions/Curriculum/ResolveCurrentCurriculumSubjectSource.php` to select only the program's current/latest active curriculum.
- Create `backend/app/Http/Controllers/Api/V1/CurrentCurriculumSubjectController.php` for `GET /programs/{program}/current-curriculum-subjects`.
- Create `backend/app/Http/Requests/Api/V1/Curriculum/StoreCurriculumSubjectPlacementRequest.php`, `backend/app/Actions/Curriculum/AddCurriculumSubjectPlacement.php`, and `backend/app/Http/Controllers/Api/V1/CurriculumSubjectPlacementController.php` for transactional new/existing row creation.
- Modify `backend/routes/api.php`, `backend/app/Domain/Audit/AuditAction.php`, and `backend/app/Domain/Audit/AuditableType.php` for the two authoring endpoints and subject audit vocabulary.
- Extend `backend/tests/Feature/Api/V1/CurriculaEndpointTest.php`, `backend/tests/Feature/Policies/CurriculumPolicyTest.php`, and `backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php`; create focused resolver and authoring endpoint tests under the matching `tests/Unit/Actions/Curriculum` and `tests/Feature/Api/V1` directories.

### Frontend files

- Modify `frontend/src/features/schemas/curriculum-schema.ts` and create `frontend/src/features/schemas/curriculum-schema.test.ts` for the new create, replacement, and placement contracts.
- Modify `frontend/src/features/services/curriculum-service.ts` and `frontend/src/features/services/curriculum-service.test.ts` for source lookup and placement mutations.
- Create `frontend/src/features/hooks/use-curriculum-authoring.ts` and its test to own query keys, candidate lookup, mutations, and invalidation.
- Create `frontend/src/features/components/portal/curriculum-creation-wizard.tsx` and test for the two-step Program → Name flow.
- Create `frontend/src/features/components/portal/curriculum-subject-spreadsheet.tsx` and `frontend/src/features/components/portal/curriculum-subject-row-dialog.tsx`, with focused tests for the editable grid and row source chooser.
- Refactor `frontend/src/features/components/portal/curriculum-workspace.tsx` and `frontend/src/features/components/portal/curriculum-workspace.test.tsx` into the orchestration shell while preserving the approval preview/submit behavior.

---

### Task 1: Enforce college ownership and server-owned curriculum school year

**Files:**

- Create: `backend/app/Actions/Curriculum/ResolveCurriculumEffectiveSchoolYear.php`
- Create: `backend/tests/Unit/Actions/Curriculum/ResolveCurriculumEffectiveSchoolYearTest.php`
- Modify: `backend/app/Models/Program.php`
- Modify: `backend/app/Policies/CurriculumPolicy.php`
- Modify: `backend/app/Http/Requests/Api/V1/Curriculum/StoreCurriculumRequest.php`
- Modify: `backend/app/Http/Requests/Api/V1/Curriculum/UpdateCurriculumRequest.php`
- Modify: `backend/app/Actions/Curriculum/CreateCurriculum.php`
- Modify: `backend/app/Actions/Curriculum/UpdateCurriculum.php`
- Modify: `backend/app/Http/Controllers/Api/V1/CurriculumController.php`
- Modify: `backend/tests/Feature/Api/V1/CurriculaEndpointTest.php`
- Modify: `backend/tests/Feature/Policies/CurriculumPolicyTest.php`

**Interfaces:**

- Consumes: `academic_term_current_slots.id = 1`, `AcademicTerm`, `Program::college`, `Curriculum::program`, and `CurriculumStatus::Draft`.
- Produces: `ResolveCurriculumEffectiveSchoolYear::execute(): string`; a create payload containing `program_id`, `name`, and `subjects`; Program Chair policy checks that require the matching college.

- [ ] **Step 1: Write failing policy, program-list, and creation contract tests**

  Add tests that create CCS and COE programs plus Program Chairs assigned to each college. Assert that CCS can list/create only CCS curricula, a Chair with no college receives no authorable programs and cannot create, and a direct PATCH to a COE curriculum by a CCS Chair is forbidden. Add a create test that sends a forged `effective_school_year: "1999-2000"` but receives the current term's school year instead.

  ```php
  $term = AcademicTerm::create([
      'school_year' => '2026-2027',
      'semester' => '1st',
      'status' => AcademicTermStatus::SemesterOngoing,
  ]);
  DB::table('academic_term_current_slots')->where('id', 1)->update([
      'academic_term_id' => $term->id,
  ]);

  $response = $this->withToken($ccsChairToken)->postJson('/api/v1/curricula', [
      'program_id' => $ccsProgram->id,
      'name' => 'BSCS Curriculum',
      'effective_school_year' => '1999-2000',
      'subjects' => [],
  ]);

  $response->assertCreated()
      ->assertJsonPath('data.effective_school_year', '2026-2027');
  ```

- [ ] **Step 2: Run the focused tests and confirm the RED state**

  Run:

  ```powershell
  php artisan test tests/Feature/Api/V1/CurriculaEndpointTest.php tests/Feature/Policies/CurriculumPolicyTest.php
  ```

  Expected: the new college-isolation and server-derived-year assertions fail because the current policy is role-only and the request accepts the browser-supplied year.

- [ ] **Step 3: Implement the current/latest term resolver**

  Add `ResolveCurriculumEffectiveSchoolYear` with this public interface:

  ```php
  final class ResolveCurriculumEffectiveSchoolYear
  {
      public function execute(): string;
  }
  ```

  Resolve `academic_term_current_slots.id = 1` first. When it has a valid term ID, return that term's `school_year`. Otherwise, query `AcademicTerm` with the same ordering as `AcademicTermController::index()` (`school_year` descending, then `semester` ascending) and return the first row's school year. If neither exists, throw `ValidationException::withMessages(['academic_term' => 'A current or latest academic term is required before creating a curriculum.'])`.

- [ ] **Step 4: Make Program Chair authorization college-aware**

  In `Program::scopeVisibleTo`, add a Program Chair branch before learner filtering: return an empty query when `college` is null; otherwise add `where('college', $user->college->value)`. In `CurriculumPolicy`, make `create()` require Program Chair plus a non-null college, add `createForProgram(User $user, Program $program): bool`, and make `update(User $user, Curriculum $curriculum): bool` require the same matching college check already used by `submit()`.

  ```php
  public function createForProgram(User $user, Program $program): bool
  {
      return $this->create($user)
          && $program->college !== null
          && $program->college === $user->college;
  }
  ```

- [ ] **Step 5: Remove editable effective year from create/update actions**

  Remove `effective_school_year` from both Form Request validation rules and from the frontend-facing controller payloads. In `CurriculumController::store`, load the requested `Program`, authorize `createForProgram` with `[Curriculum::class, $program]`, and pass only program ID/name to `CreateCurriculum`. Inject `ResolveCurriculumEffectiveSchoolYear` into `CreateCurriculum` and set the model field from `execute()` inside its transaction. In `UpdateCurriculum`, stop assigning effective year; only `name` and synchronized subject placements remain mutable.

  ```php
  $curriculum = Curriculum::create([
      'program_id' => $validatedData['program_id'],
      'name' => $validatedData['name'],
      'effective_school_year' => $this->effectiveSchoolYear->execute(),
      'status' => CurriculumStatus::Draft,
  ]);
  ```

- [ ] **Step 6: Add unit tests for current, fallback, and missing-term resolution**

  Cover these exact cases in `ResolveCurriculumEffectiveSchoolYearTest`:

  ```php
  public function test_it_uses_the_current_slot_term_school_year(): void;
  public function test_it_falls_back_to_the_first_term_in_existing_list_order(): void;
  public function test_it_rejects_creation_when_no_academic_term_exists(): void;
  ```

  The fallback test creates two terms with different school years and asserts the higher school year wins. The missing-term test expects a validation error keyed by `academic_term`.

- [ ] **Step 7: Run the Task 1 regression set**

  Run:

  ```powershell
  php artisan test tests/Unit/Actions/Curriculum/ResolveCurriculumEffectiveSchoolYearTest.php tests/Feature/Api/V1/CurriculaEndpointTest.php tests/Feature/Policies/CurriculumPolicyTest.php tests/Feature/Api/V1/CurriculumEndpointLockTest.php
  ```

  Expected: PASS. Confirm existing Draft-lock tests still prove a non-Draft curriculum cannot be edited.

- [ ] **Step 8: Record the milestone without committing**

  Update `PROGRESS.md` with the exact focused command/result. Do not run `git commit` or `git push` because the user has not authorized either action.

### Task 2: Add current-curriculum subject sourcing and atomic row creation

**Files:**

- Create: `backend/app/Actions/Curriculum/ResolveCurrentCurriculumSubjectSource.php`
- Create: `backend/app/Actions/Curriculum/AddCurriculumSubjectPlacement.php`
- Create: `backend/app/Http/Controllers/Api/V1/CurrentCurriculumSubjectController.php`
- Create: `backend/app/Http/Controllers/Api/V1/CurriculumSubjectPlacementController.php`
- Create: `backend/app/Http/Requests/Api/V1/Curriculum/StoreCurriculumSubjectPlacementRequest.php`
- Create: `backend/tests/Unit/Actions/Curriculum/ResolveCurrentCurriculumSubjectSourceTest.php`
- Create: `backend/tests/Feature/Api/V1/CurriculumSubjectAuthoringEndpointTest.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Domain/Audit/AuditAction.php`
- Modify: `backend/app/Domain/Audit/AuditableType.php`
- Modify: `backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php`

**Interfaces:**

- Consumes: `ResolveCurriculumEffectiveSchoolYear::execute()`, a selected `Program`, active `Curriculum` versions, `Subject`, `CurriculumSubject`, `SubjectStatus::Active`, and `AuditRecorder`.
- Produces: `ResolveCurrentCurriculumSubjectSource::execute(Program $program): ?Curriculum`; `POST /api/v1/curricula/{curriculum}/subject-placements`; `GET /api/v1/programs/{program}/current-curriculum-subjects`.

- [ ] **Step 1: Write failing source-resolution and endpoint tests**

  Create one selected program with an old active curriculum, a current-term active curriculum, and a newer mismatched active curriculum. Assert the GET endpoint returns only subject IDs from the current-term curriculum. Add a fallback test with no matching school year that returns the latest active curriculum. Assert requests by another college's Chair are forbidden and old subject IDs are rejected by the placement endpoint.

  ```php
  $this->withToken($chairToken)
      ->getJson("/api/v1/programs/{$program->id}/current-curriculum-subjects")
      ->assertOk()
      ->assertJsonPath('data.0.id', $currentSubject->id)
      ->assertJsonMissing(['id' => $oldSubject->id]);

  $this->withToken($chairToken)
      ->postJson("/api/v1/curricula/{$draft->id}/subject-placements", [
          'source' => 'existing',
          'subject_id' => $oldSubject->id,
          'year_level' => 1,
          'semester' => '1st',
      ])
      ->assertUnprocessable();
  ```

- [ ] **Step 2: Run the focused authoring test file and confirm RED**

  Run:

  ```powershell
  php artisan test tests/Feature/Api/V1/CurriculumSubjectAuthoringEndpointTest.php tests/Unit/Actions/Curriculum/ResolveCurrentCurriculumSubjectSourceTest.php
  ```

  Expected: FAIL because neither authoring route nor source resolver exists.

- [ ] **Step 3: Implement the current/latest active curriculum resolver**

  `ResolveCurrentCurriculumSubjectSource::execute(Program $program): ?Curriculum` must first call `ResolveCurriculumEffectiveSchoolYear`. Query `Curriculum` for the program with `status = active` and a matching `effective_school_year`. If none matches, query active curricula in the existing curriculum list order (`effective_school_year` descending, then `name` ascending) and return the first. Eager-load `subjectPlacements.subject` before returning. Do not query Draft, Pending, or Archived versions.

  ```php
  return Curriculum::query()
      ->where('program_id', $program->id)
      ->where('status', CurriculumStatus::Active)
      ->orderByDesc('effective_school_year')
      ->orderBy('name')
      ->with('subjectPlacements.subject')
      ->first();
  ```

- [ ] **Step 4: Add the college-authorized source endpoint**

  Implement `CurrentCurriculumSubjectController::__invoke(Request $request, Program $program, ResolveCurrentCurriculumSubjectSource $resolver): JsonResponse`. Authenticate the request, authorize the Program Chair against the selected program through `createForProgram`, resolve the source, and return `SubjectResource::collection($source?->subjectPlacements->pluck('subject')->unique('id')->values() ?? collect())` with `Cache-Control: no-store, private`.

- [ ] **Step 5: Add transactional new/existing Draft placement creation**

  `StoreCurriculumSubjectPlacementRequest` uses a strict source discriminator:

  ```php
  'source' => ['required', Rule::in(['new', 'existing'])],
  'year_level' => ['required', 'integer', 'min:1', 'max:4'],
  'semester' => ['required', Rule::enum(SemesterSlot::class)],
  'subject_id' => ['required_if:source,existing', 'integer', 'exists:subjects,id'],
  'code' => ['required_if:source,new', 'string', 'max:255'],
  'title' => ['required_if:source,new', 'string', 'max:255'],
  'units' => ['required_if:source,new', 'numeric', 'min:0'],
  ```

  In `AddCurriculumSubjectPlacement::execute`, require Draft status, load the curriculum program, and use a database transaction. For `new`, create `Subject` with server-derived college, `SubjectStatus::Active`, and validated code/title/units. For `existing`, resolve source eligibility and reject any ID absent from its placed subjects. Reject an ID already present in the Draft. Create `CurriculumSubject` with `is_required => true`, empty prerequisites, the active Year-tab value, and selected semester. Reload the same Curriculum resource relations used by `CurriculumController`.

- [ ] **Step 6: Record audit vocabulary and route both mutations through policies**

  Add `SUBJECT_CREATED = 'subject.created'` and `SUBJECT = 'subject'` to the audit vocabulary/value arrays. For `source: new`, record a subject-created audit snapshot with `id`, `college`, `code`, `title`, `units`, and `status`; for both sources, record the curriculum before/after snapshot under `CURRICULUM_UPDATED`. The controller authorizes `update` on the Draft before invoking the action. Add routes inside the existing authenticated Program Chair group:

  ```php
  Route::get('/programs/{program}/current-curriculum-subjects', CurrentCurriculumSubjectController::class);
  Route::post('/curricula/{curriculum}/subject-placements', CurriculumSubjectPlacementController::class);
  ```

- [ ] **Step 7: Extend endpoint tests through all failure paths**

  Add assertions for: a new subject is saved with the Chair's college and its placement exists; duplicate `(college, code)` is validation failure with no placement; duplicate Draft placement is validation failure; a pending-review curriculum rejects placement; a source-less program returns `data: []`; and a successful new-subject call produces both expected audit records.

- [ ] **Step 8: Run the Task 2 regression set**

  Run:

  ```powershell
  php artisan test tests/Unit/Actions/Curriculum/ResolveCurrentCurriculumSubjectSourceTest.php tests/Feature/Api/V1/CurriculumSubjectAuthoringEndpointTest.php tests/Feature/Api/V1/CurriculaEndpointTest.php tests/Feature/Api/V1/CurriculumEndpointLockTest.php tests/Unit/Domain/Audit/AuditVocabularyTest.php
  ```

  Expected: PASS.

- [ ] **Step 9: Record the milestone without committing**

  Update `PROGRESS.md` with the test output. Do not commit or push.

### Task 3: Publish the frontend authoring contracts, service calls, and query hooks

**Files:**

- Create: `frontend/src/features/schemas/curriculum-schema.test.ts`
- Create: `frontend/src/features/hooks/use-curriculum-authoring.ts`
- Create: `frontend/src/features/hooks/use-curriculum-authoring.test.tsx`
- Modify: `frontend/src/features/schemas/curriculum-schema.ts`
- Modify: `frontend/src/features/services/curriculum-service.ts`
- Modify: `frontend/src/features/services/curriculum-service.test.ts`

**Interfaces:**

- Consumes: the Task 1 create/replace contract, Task 2 GET/POST endpoints, `Subject`, `Curriculum`, `useAuth`, and TanStack Query's `useQuery`, `useMutation`, and `useQueryClient`.
- Produces: `StoreCurriculumInput` without `effective_school_year`; `CurriculumSubjectPlacementInput`; `getCurrentCurriculumSubjects`; `addCurriculumSubjectPlacement`; `useCurrentCurriculumSubjectsQuery`; `useAddCurriculumSubjectPlacementMutation`.

- [ ] **Step 1: Write failing schema and service tests**

  Add Zod tests proving a creation payload with only `program_id`, `name`, and `subjects` parses, while payloads containing `effective_school_year` or `status` fail strict parsing. Add placement tests for both variants and service tests that assert these exact requests:

  ```ts
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/programs/42/current-curriculum-subjects'),
    expect.objectContaining({ method: 'GET' }),
  )

  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/api/v1/curricula/7/subject-placements'),
    expect.objectContaining({ method: 'POST' }),
  )
  ```

- [ ] **Step 2: Run the focused frontend tests and confirm RED**

  Run:

  ```powershell
  npm test -- --run src/features/schemas/curriculum-schema.test.ts src/features/services/curriculum-service.test.ts src/features/hooks/use-curriculum-authoring.test.tsx
  ```

  Expected: FAIL because the new schemas, service functions, and hooks do not yet exist.

- [ ] **Step 3: Define strict authoring schemas and remove hidden header fields**

  In `curriculum-schema.ts`, change `StoreCurriculumInput` to this shape:

  ```ts
  export const storeCurriculumInputSchema = z
    .object({
      program_id: z.number().int().positive('Select a program.'),
      name: z.string().trim().min(1, 'Enter a curriculum name.'),
      subjects: z.array(curriculumSubjectInputSchema),
    })
    .strict()
  ```

  Remove `effective_school_year` from `curriculumReplacementSchema`, `toCurriculumReplacement`, and the editable values used by the Manage form. Add a strict discriminated union named `curriculumSubjectPlacementInputSchema` with `source: 'existing'` and `source: 'new'` variants that exactly match Task 2.

- [ ] **Step 4: Add service functions with runtime contract parsing**

  Add these functions to `curriculum-service.ts`; each must call the authenticated API helper and parse the response with existing Zod resource schemas:

  ```ts
  export async function getCurrentCurriculumSubjects(
    programId: number,
    signal?: AbortSignal,
  ): Promise<readonly Subject[]>

  export async function addCurriculumSubjectPlacement(
    curriculumId: number,
    input: CurriculumSubjectPlacementInput,
  ): Promise<Curriculum>
  ```

  Import `subjectsEnvelopeSchema` and `Subject` from `reference-data-schema`; do not add a rendering-component fetch.

- [ ] **Step 5: Add isolated TanStack Query hooks**

  Create `use-curriculum-authoring.ts`. Scope candidate query keys by authenticated user and program ID, and invalidate the exact curricula query after a successful placement. For a new-subject mutation, also invalidate `subjectsQueryKey` so all later subject reads observe it.

  ```ts
  export const currentCurriculumSubjectsQueryKey = (
    userId: string | null,
    programId: number | null,
  ) => ['current-curriculum-subjects', userId, programId] as const
  ```

- [ ] **Step 6: Run the Task 3 regression set**

  Run:

  ```powershell
  npm test -- --run src/features/schemas/curriculum-schema.test.ts src/features/services/curriculum-service.test.ts src/features/hooks/use-curriculum-authoring.test.tsx
  npm run typecheck
  ```

  Expected: all focused Vitest files pass. If `npm run typecheck` still reports only the documented readonly fixture errors in `curriculum-view.test.tsx`, record those exact pre-existing errors and confirm no new authoring errors appear.

- [ ] **Step 7: Record the milestone without committing**

  Update `PROGRESS.md`; do not commit or push.

### Task 4: Build the two-step creation wizard and Draft preview/edit boundary

**Files:**

- Create: `frontend/src/features/components/portal/curriculum-creation-wizard.tsx`
- Create: `frontend/src/features/components/portal/curriculum-creation-wizard.test.tsx`
- Modify: `frontend/src/features/components/portal/curriculum-workspace.tsx`
- Modify: `frontend/src/features/components/portal/curriculum-workspace.test.tsx`

**Interfaces:**

- Consumes: `StoreCurriculumInput`, `createCurriculum`, `useProgramsQuery`, authenticated session college, and the existing curriculum list query.
- Produces: `CurriculumCreationWizard` with `open`, `programs`, `college`, `onOpenChange`, and `onCreated` props; a workspace that selects the returned Draft and enters read-only preview before edit mode.

- [ ] **Step 1: Write failing component tests for the guided creation flow**

  Add a wizard test with a Program Chair session (`college: 'ccs'`) and a mocked `/programs` response containing only CCS programs. Assert the center CTA opens a dialog, the Program step precedes the Name step, Back restores Program selection, Cancel closes without a POST, and Proceed sends no effective year/status field.

  ```tsx
  await user.click(screen.getByRole('button', { name: /create new curriculum/i }))
  await user.click(screen.getByRole('option', { name: /BS Computer Science/i }))
  await user.click(screen.getByRole('button', { name: /next/i }))
  await user.type(screen.getByLabelText(/curriculum name/i), 'BSCS 2026 Curriculum')
  await user.click(screen.getByRole('button', { name: /proceed/i }))

  expect(JSON.parse(postBody)).toEqual({
    program_id: 1,
    name: 'BSCS 2026 Curriculum',
    subjects: [],
  })
  ```

- [ ] **Step 2: Run the wizard/workspace tests and confirm RED**

  Run:

  ```powershell
  npm test -- --run src/features/components/portal/curriculum-creation-wizard.test.tsx src/features/components/portal/curriculum-workspace.test.tsx
  ```

  Expected: FAIL because the current workspace exposes header form fields rather than a two-step dialog.

- [ ] **Step 3: Implement `CurriculumCreationWizard` with accessible step state**

  Use existing Dialog, Button, Input, Select/Command, Field, and FieldError primitives. Hold only `step`, `programId`, and `name` locally. Step 1 shows the authenticated college code as context and its supplied program list. Step 2 validates a non-empty name. Invoke an injected `onCreate({ program_id, name, subjects: [] })`; disable Proceed during the request; surface API errors with the established request-error pattern.

- [ ] **Step 4: Refactor workspace header into CTA, selector, preview, and edit state**

  Replace the embedded New curriculum header form with a centered CTA when no selection exists and a normal existing-curriculum selector when data exists. On successful wizard creation, update/invalidate the curricula query, select the returned curriculum ID, reset values from it, and set `isEditing` to false. Render the Draft badge read-only. Remove every editable Effective school year and Status control.

  ```tsx
  const [isEditing, setIsEditing] = useState(false)

  <Button
    type="button"
    onClick={() => setIsEditing(true)}
    disabled={selectedCurriculum?.status !== 'draft'}
  >
    Edit curriculum
  </Button>
  ```

- [ ] **Step 5: Preserve approval behavior and lock semantics**

  Keep the existing return-reason banner, Submit for Dean Review preview dialog, transition mutation, and non-Draft lock behavior. When a Draft becomes pending, set `isEditing` to false. The center CTA and wizard are rendered only for Program Chairs; reviewers remain on their existing read-only approval workspace.

- [ ] **Step 6: Run the Task 4 regression set**

  Run:

  ```powershell
  npm test -- --run src/features/components/portal/curriculum-creation-wizard.test.tsx src/features/components/portal/curriculum-workspace.test.tsx src/features/components/portal/curriculum-approvals-workspace.test.tsx
  npx eslint src/features/components/portal/curriculum-creation-wizard.tsx src/features/components/portal/curriculum-workspace.tsx
  ```

  Expected: PASS, including the existing Dean/Executive review coverage.

- [ ] **Step 7: Record the milestone without committing**

  Update `PROGRESS.md`; do not commit or push.

### Task 5: Implement the year-scoped spreadsheet and new/existing row chooser

**Files:**

- Create: `frontend/src/features/components/portal/curriculum-subject-spreadsheet.tsx`
- Create: `frontend/src/features/components/portal/curriculum-subject-spreadsheet.test.tsx`
- Create: `frontend/src/features/components/portal/curriculum-subject-row-dialog.tsx`
- Create: `frontend/src/features/components/portal/curriculum-subject-row-dialog.test.tsx`
- Modify: `frontend/src/features/components/portal/curriculum-workspace.tsx`
- Modify: `frontend/src/features/components/portal/curriculum-workspace.test.tsx`

**Interfaces:**

- Consumes: active `yearLevel`, Draft subject placements, `useCurrentCurriculumSubjectsQuery`, `useAddCurriculumSubjectPlacementMutation`, and the existing autosave replacement mutation.
- Produces: `CurriculumSubjectSpreadsheet` controlled by `placements`, `yearLevel`, `disabled`, and `onChange`; `CurriculumSubjectRowDialog` that emits one `CurriculumSubjectPlacementInput` only after user selection/entry.

- [ ] **Step 1: Write failing spreadsheet tests for all four years and both semesters**

  Add workspace tests that click 1st through 4th Year and see only their matching rows. Assert an editable Draft exposes `Subject Code`, `Description`, `Units`, `Semester`, `Prerequisite`, and `Add subject row`, but does not expose “Subject to place” or “Add subject placement.” Assert a Semester selector displays 1st Semester and 2nd Semester while writing the corresponding `1st` or `2nd` value into the autosave payload.

  ```tsx
  await user.click(screen.getByRole('tab', { name: /3rd year/i }))
  expect(screen.getByText('CS301')).toBeInTheDocument()
  expect(screen.queryByText('CS101')).not.toBeInTheDocument()
  expect(screen.queryByLabelText(/subject to place/i)).not.toBeInTheDocument()
  ```

- [ ] **Step 2: Write failing row-source chooser tests**

  Test the Add subject row dialog's two actions. The Existing branch must search candidates from the mocked current-curriculum endpoint, select a code, and auto-fill its Code, Description, and Units in the returned row. The New branch must enter code/title/units, POST `source: 'new'`, and show the returned subject row. Add the source-empty message and API duplicate-code error assertions.

  ```tsx
  await user.click(screen.getByRole('button', { name: /add subject row/i }))
  await user.click(screen.getByRole('button', { name: /use existing subject/i }))
  await user.type(screen.getByPlaceholderText(/search subjects/i), 'data')
  await user.click(screen.getByRole('option', { name: /CS102.*Data Structures/i }))
  expect(await screen.findByDisplayValue('CS102')).toBeInTheDocument()
  ```

- [ ] **Step 3: Run the focused component tests and confirm RED**

  Run:

  ```powershell
  npm test -- --run src/features/components/portal/curriculum-subject-spreadsheet.test.tsx src/features/components/portal/curriculum-subject-row-dialog.test.tsx src/features/components/portal/curriculum-workspace.test.tsx
  ```

  Expected: FAIL because the old placement select/button is still the only add flow.

- [ ] **Step 4: Implement the controlled spreadsheet**

  Render rows filtered by `placement.year_level === yearLevel`. Keep the explicit table headers and render Code/Description/Units from the selected subject resource. The Semester cell displays “1st Semester” and “2nd Semester” while storing the domain values `1st` and `2nd`. The Prerequisite cell uses the existing prerequisite editor logic restricted to current Draft subjects, excludes its own subject, uses the existing `defaultMinimumGrade` for new edges, and delegates final cycle validation to the existing autosave API. Keep a final remove-row button with an accessible name.

- [ ] **Step 5: Implement the row-source dialog without component-level fetches**

  `CurriculumSubjectRowDialog` receives candidate query state and placement mutation callbacks as props. In Existing mode, present a searchable Command/Popover list and submit:

  ```ts
  {
    source: 'existing',
    subject_id: selected.id,
    year_level: activeYear,
    semester: selectedSemester,
  }
  ```

  In New mode, validate Code, Description, and Units with React Hook Form/Zod and submit:

  ```ts
  {
    source: 'new',
    code: values.code.trim(),
    title: values.title.trim(),
    units: values.units,
    year_level: activeYear,
    semester: values.semester,
  }
  ```

  On success, close the dialog, use the returned curriculum to reset the workspace form, and expose the new row in the active Year tab. On error, leave dialog values intact and render its API validation message.

- [ ] **Step 6: Connect spreadsheet edits to the existing autosave state**

  Pass form placement values and `setPlacements` through the spreadsheet. Retain the existing debounced PATCH behavior for semester updates, prerequisites, and removals. Display Saving, Saved, and Retry/error text near the table. Disable Add subject row, row edits, and dialogs whenever `isLocked` is true.

- [ ] **Step 7: Run the Task 5 regression set**

  Run:

  ```powershell
  npm test -- --run src/features/components/portal/curriculum-subject-spreadsheet.test.tsx src/features/components/portal/curriculum-subject-row-dialog.test.tsx src/features/components/portal/curriculum-workspace.test.tsx src/features/components/portal/curriculum-approvals-workspace.test.tsx
  npx prettier --check src/features/components/portal/curriculum-subject-spreadsheet.tsx src/features/components/portal/curriculum-subject-row-dialog.tsx src/features/components/portal/curriculum-workspace.tsx
  ```

  Expected: PASS.

- [ ] **Step 8: Record the milestone without committing**

  Update `PROGRESS.md`; do not commit or push.

### Task 6: Run cross-feature verification and prepare the handoff

**Files:**

- Modify: `PROGRESS.md`
- Verify: all Task 1–5 files, existing approval-workflow files, and this plan's tests.

**Interfaces:**

- Consumes: completed backend REST contracts, frontend data hooks/components, and existing approval workflow.
- Produces: evidence-backed verification record with no claim of success for a command that did not pass.

- [ ] **Step 1: Run focused backend authoring and approval regressions**

  Run:

  ```powershell
  php artisan test tests/Unit/Actions/Curriculum/ResolveCurriculumEffectiveSchoolYearTest.php tests/Unit/Actions/Curriculum/ResolveCurrentCurriculumSubjectSourceTest.php tests/Feature/Api/V1/CurriculaEndpointTest.php tests/Feature/Api/V1/CurriculumSubjectAuthoringEndpointTest.php tests/Feature/Api/V1/CurriculumEndpointLockTest.php tests/Feature/Api/V1/CurriculumTransitionEndpointTest.php tests/Feature/Policies/CurriculumPolicyTest.php tests/Unit/Domain/Curriculum/PrerequisiteCycleDetectorTest.php tests/Unit/Domain/Audit/AuditVocabularyTest.php
  ```

  Expected: PASS.

- [ ] **Step 2: Run frontend feature regressions and static checks**

  Run:

  ```powershell
  npm test -- --run src/features/schemas/curriculum-schema.test.ts src/features/services/curriculum-service.test.ts src/features/hooks/use-curriculum-authoring.test.tsx src/features/components/portal/curriculum-creation-wizard.test.tsx src/features/components/portal/curriculum-subject-spreadsheet.test.tsx src/features/components/portal/curriculum-subject-row-dialog.test.tsx src/features/components/portal/curriculum-workspace.test.tsx src/features/components/portal/curriculum-approvals-workspace.test.tsx
  npm run typecheck
  npm run build
  ```

  Expected: focused tests and build PASS. If typecheck retains only the two documented unrelated readonly fixture errors in `curriculum-view.test.tsx`, record that it has no new failures instead of calling the typecheck green.

- [ ] **Step 3: Run applicable broader suites**

  Run:

  ```powershell
  php artisan test
  npm test
  git diff --check
  ```

  Expected: the test suites pass unless an already documented environmental failure/time limit occurs. For the local `php artisan migrate` ALTER-permission problem on migration `2026_08_07_000004_add_decision_columns_to_curricula`, report the exact database-permission blocker; do not modify database grants or claim the migration was applied.

- [ ] **Step 4: Perform manual acceptance checks in the local app**

  Verify these exact flows while signed in as a CCS Program Chair: the program wizard lists no COE program; Proceed creates an empty Draft using the active/current term; 1st–4th Year tabs and both semesters work; New subject persists and appears in the selected year; Existing subject search omits old versions; a pending-review curriculum has no editable grid; and the existing Dean/Executive approval module still opens its read-only curriculum preview.

- [ ] **Step 5: Record final verification and handoff without committing**

  Update `PROGRESS.md` with every command/result, any remaining external blocker, and the changed-file summary. Do not commit, push, merge the isolated worktree into main, or change MySQL privileges unless the user explicitly requests each action.

## Plan self-review

- **Spec coverage:** Task 1 covers college-only programs, server-selected school year, removal of editable status/effective-year fields, and Draft creation. Task 2 covers current/latest candidate selection, atomic new/existing subject placement, audit, and server validation. Tasks 3–5 cover strict client contracts, wizard, preview/edit behavior, four Year tabs, two Semester choices, spreadsheet rows, search/autofill, prerequisites, autosave, and locked states. Task 6 covers broader regressions and manual acceptance.
- **Placeholder scan:** The plan names every endpoint, action, request, component, query key, test file, request payload, and command; no deferred placeholders remain.
- **Type consistency:** `ResolveCurriculumEffectiveSchoolYear`, `ResolveCurrentCurriculumSubjectSource`, `CurriculumSubjectPlacementInput`, `getCurrentCurriculumSubjects`, and `addCurriculumSubjectPlacement` retain the same names and parameter shapes throughout the tasks.
