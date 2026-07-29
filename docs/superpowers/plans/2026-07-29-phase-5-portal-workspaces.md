# Phase 5 Portal Workspaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 13 Phase 5 portal modules functional for Admission Staff, Faculty, Program Chair, Dean, Executive Director, and Registrar Head, with shared active-term and notification experiences.

**Architecture:** Keep `/portal/[moduleId]` and dispatch connected module IDs through a typed registry after the existing role check. Laravel gains one audited, least-privilege faculty-directory read endpoint; all remaining portal work consumes existing v1 resources through strict Zod schemas, services, and TanStack Query hooks.

**Tech Stack:** Laravel 12/PHP 8.2/MariaDB, Next.js 16 App Router/React 19/TypeScript 6, TanStack Query, React Hook Form, Zod, shadcn/ui, Sonner 2.0.7, Vitest, PHPUnit, OpenAPI.

## Global Constraints

- Keep Next.js client-rendered only: no server-side authorized-data fetch, API proxy, cookie, session, or CSRF flow.
- All frontend API calls live in `frontend/src/features/services`; all responses parse through strict Zod schemas.
- Laravel Controllers authorize, invoke one Action where a transaction/audit boundary exists, and return Resources; use Form Requests and Policies/Gates consistently.
- Faculty-directory output contains no email, credential, token, or unrelated user fields. Its audit payload contains only `result_count`.
- The generated admission credential is never `password`, never persisted in browser storage, and is cleared when its success receipt closes or unmounts.
- Preserve the existing unrelated dirty edit to `docs/superpowers/plans/2026-07-27-mariadb-identity-sanctum-auth.md`.
- Do not implement ML, enrollment, grades, payments, withdrawals, COM, reports, profile/password recovery, help, or report-issue APIs.
- Update `PROGRESS.md` and `HANDOFF.md` after each completed milestone; do not claim a check passed unless it was run.

---

## File Structure

| Area | Responsibility |
|---|---|
| `backend/app/Actions/Identity/ListFacultyMembers.php` | Active Faculty query and private audit transaction. |
| `backend/app/Http/Controllers/Api/V1/FacultyMemberController.php` and Resource | Program Chair-only faculty directory contract. |
| `frontend/src/features/schemas/` | Exact Zod envelopes and input schemas by API domain. |
| `frontend/src/features/services/` and `hooks/` | Parsed API access, query keys, mutations, and invalidation. |
| `frontend/src/features/portal/module-registry.tsx` | Maps the 13 connected module IDs to isolated portal components. |
| `frontend/src/features/components/portal/` | Shared portal state views and role workspace components. |

### Task 1: Add the audited faculty directory API

**Files:**
- Create: `backend/app/Actions/Identity/ListFacultyMembers.php`
- Create: `backend/app/Http/Controllers/Api/V1/FacultyMemberController.php`
- Create: `backend/app/Http/Resources/Api/V1/FacultyMemberResource.php`
- Create: `backend/app/Policies/FacultyMemberPolicy.php`
- Create: `backend/tests/Feature/Api/V1/FacultyMembersEndpointTest.php`
- Modify: `backend/app/Domain/Audit/AuditAction.php`, `backend/app/Domain/Audit/AuditableType.php`, `backend/app/Providers/AppServiceProvider.php`, `backend/routes/api.php`, `backend/tests/Unit/Domain/Audit/AuditVocabularyTest.php`, `backend/tests/Feature/Api/V1/ApiSurfaceTest.php`, `docs/api/openapi.yaml`

**Interfaces:**
- Produces `GET /api/v1/faculty-members` with `data: FacultyMember[]`; each resource has exactly `type`, `id`, `name`, `status`, `status_label`.
- Produces `FacultyMemberPolicy::viewAny(User $user): bool` and `ListFacultyMembers::execute(User $actor, AuditRequestContext $context): Collection<int, User>`.
- Adds `AuditAction::FACULTY_DIRECTORY_LIST_VIEWED = 'faculty_directory.list_viewed'` and `AuditableType::FACULTY_DIRECTORY = 'faculty_directory'`.

- [ ] **Step 1: Write failing API and vocabulary tests**

```php
$this->withToken($chairToken)->getJson('/api/v1/faculty-members')
    ->assertOk()
    ->assertHeader('Cache-Control', 'no-store, private')
    ->assertJsonPath('data.0.type', 'faculty_member');

self::assertSame(['type', 'id', 'name', 'status', 'status_label'], array_keys($response->json('data.0')));
$response->assertDontSee($faculty->email);
self::assertDatabaseHas('audit_logs', [
    'actor_user_id' => $chair->id,
    'action' => AuditAction::FACULTY_DIRECTORY_LIST_VIEWED,
    'auditable_type' => AuditableType::FACULTY_DIRECTORY,
    'after_values->result_count' => 2,
]);
```

Cover anonymous 401, all eight non-chair roles 403, active-faculty-only,
`name` then `id` ordering, exact resource keys, no email, and an injected
`AuditLog::creating` failure that returns 500 with no successful directory
payload.

- [ ] **Step 2: Run the new test to verify it fails**

Run: `cd backend; php artisan test --filter=FacultyMembersEndpointTest`

Expected: FAIL because the route and controller do not exist.

- [ ] **Step 3: Implement the policy, audit vocabulary, Action, Resource, controller, route, and OpenAPI path**

```php
// ListFacultyMembers::execute()
return DB::transaction(function () use ($actor, $context): Collection {
    $members = User::query()
        ->where('role', UserRole::Faculty)
        ->where('status', UserStatus::Active)
        ->orderBy('name')
        ->orderBy('id')
        ->get(['id', 'name', 'status']);

    $this->auditRecorder->record(
        $actor, AuditAction::FACULTY_DIRECTORY_LIST_VIEWED,
        AuditableType::FACULTY_DIRECTORY, null, null,
        ['result_count' => $members->count()], null, $context,
    );

    return $members;
});
```

Register `view-faculty-directory` in `AppServiceProvider::boot()` with
`FacultyMemberPolicy::viewAny`, authorize it in the controller, and wrap the
route in the existing authenticated/active/throttled group plus
`role:program_chair`. Document the exact schema and error responses in
OpenAPI.

- [ ] **Step 4: Run the focused backend checks**

Run: `cd backend; php artisan test --filter='FacultyMembersEndpointTest|AuditVocabularyTest|ApiSurfaceTest'`

Expected: PASS; route inventory increases from 29 to 30.

- [ ] **Step 5: Record the milestone**

Update `HANDOFF.md` and `PROGRESS.md` with the exact focused result and the
30-route inventory. Commit only if the user has explicitly authorized commits.

### Task 2: Build the shared API client, error mapping, and UI primitives

**Files:**
- Modify: `frontend/package.json`, `frontend/package-lock.json`, `frontend/src/app/providers.tsx`, `frontend/src/features/services/api-client.ts`, `frontend/src/features/services/api-client.test.ts`
- Create: `frontend/src/features/lib/api-form-errors.ts`, `frontend/src/features/lib/api-form-errors.test.ts`, `frontend/src/features/components/ui/table.tsx`, `frontend/src/features/components/ui/select.tsx`, `frontend/src/features/components/ui/dialog.tsx`, `frontend/src/features/components/ui/alert-dialog.tsx`, `frontend/src/features/components/ui/pagination.tsx`, `frontend/src/features/components/ui/toaster.tsx`

**Interfaces:**
- Produces `patchAuthenticatedJson(path: string, body: unknown, signal?: AbortSignal): Promise<unknown>` and `deleteAuthenticatedJson(path: string, signal?: AbortSignal): Promise<unknown>`.
- Produces `applyApiFieldErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>): boolean` which maps `ApiClientError.fieldErrors` to named RHF fields and returns false for non-422 errors.

- [ ] **Step 1: Write failing client and field-error tests**

```ts
await patchAuthenticatedJson('/api/v1/notifications/7/read', {})
expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
  method: 'PATCH', credentials: 'omit', cache: 'no-store',
}))

expect(applyApiFieldErrors(validationError, setError)).toBe(true)
expect(setError).toHaveBeenCalledWith('email', expect.objectContaining({
  message: 'The email has already been taken.',
}))
```

Also assert DELETE accepts `204`, bearer injection remains present, and 401
still invokes the registered unauthorized handler.

- [ ] **Step 2: Run the narrow tests to verify they fail**

Run: `cd frontend; npm test -- src/features/services/api-client.test.ts src/features/lib/api-form-errors.test.ts`

Expected: FAIL because PATCH/DELETE exports and the mapper do not exist.

- [ ] **Step 3: Install Sonner and implement the client/primitives**

Run: `cd frontend; npm install sonner@^2.0.7`

Extend the internal request method union to `GET | POST | PATCH | DELETE`, add
`fieldErrors?: Record<string, string[]>` to `ApiClientError`, preserve the
parsed error envelope's `errors`, mount `<Toaster />` once in `Providers`, and
add the shadcn-compatible primitives using the already installed `radix-ui`
package and project `cn()` helper.

- [ ] **Step 4: Run the client and primitive tests**

Run: `cd frontend; npm test -- src/features/services/api-client.test.ts src/features/services/api-client.auth.test.ts src/features/lib/api-form-errors.test.ts`

Expected: PASS with no direct browser-storage access outside `auth-token.ts`.

- [ ] **Step 5: Record the milestone**

Update `HANDOFF.md` and `PROGRESS.md`; commit only with explicit user
authorization.

### Task 3: Connect the portal shell, reference data, notifications, and module registry

**Files:**
- Create: `frontend/src/features/schemas/reference-data-schema.ts`, `frontend/src/features/schemas/notification-schema.ts`, `frontend/src/features/services/reference-data-service.ts`, `frontend/src/features/services/notification-service.ts`, `frontend/src/features/hooks/use-reference-data.ts`, `frontend/src/features/hooks/use-notifications.ts`, `frontend/src/features/portal/module-registry.tsx`, `frontend/src/features/components/portal/portal-notification-sheet.tsx`
- Modify: `frontend/src/features/components/layouts/portal-shell.tsx`, `frontend/src/features/components/pages/portal-overview-page.tsx`, `frontend/src/features/components/pages/portal-module-page.tsx`, `frontend/src/features/portal/role-capabilities.ts`
- Test: `frontend/src/features/services/notification-service.test.ts`, `frontend/src/features/components/portal/portal-notification-sheet.test.tsx`, `frontend/src/features/portal/module-registry.test.tsx`, `frontend/src/features/components/layouts/portal-shell.test.tsx`

**Interfaces:**
- Produces `useAcademicTermsQuery()`, `useProgramsQuery()`, `useSubjectsQuery()`, `useNotificationsQuery(options)`, and `useMarkNotificationReadMutation()`.
- Produces `phaseFiveModuleRegistry: Readonly<Record<PhaseFiveModuleId, PortalModuleComponent>>`, where `PhaseFiveModuleId` is the explicit union of the 13 Phase 5 IDs.

- [ ] **Step 1: Write failing schema/service/shell tests**

```ts
expect(notificationEnvelopeSchema.parse(payload).data[0]).toMatchObject({
  id: 7, notification_type: 'schedule_published', read_at: null,
})

await user.click(screen.getByRole('button', { name: /notifications/i }))
expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Mark notification as read' }))
expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/notifications/7/read'), expect.objectContaining({ method: 'PATCH' }))
```

Test active-term selection (`status === 'active'`), no-active-term fallback,
unread count, pagination, unread filter, non-owner-safe API error rendering,
and that phase-five IDs dispatch to components while every remaining module
keeps the existing preview state.

- [ ] **Step 2: Run the new frontend tests to verify they fail**

Run: `cd frontend; npm test -- src/features/services/notification-service.test.ts src/features/components/portal/portal-notification-sheet.test.tsx src/features/portal/module-registry.test.tsx`

Expected: FAIL because the schemas, hooks, Sheet, and registry do not exist.

- [ ] **Step 3: Implement parsed reference/notification clients and shared shell UI**

```ts
export const notificationQueryKey = (options: NotificationListOptions) =>
  ['notifications', options.unread ?? false, options.page ?? 1, options.perPage ?? 20] as const

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
```

Replace the disabled Bell preview control with the Sheet. Show active-term text
in the shell and portal overview. Keep profile, password, help, and issue
controls disabled with their existing honest labels. Remove preview-only copy
only for module IDs supplied by the registry.

- [ ] **Step 4: Run shared portal tests**

Run: `cd frontend; npm test -- src/features/components/layouts/portal-shell.test.tsx src/features/components/pages/portal-module-page.test.tsx src/features/components/pages/portal-overview-page.test.tsx src/features/components/portal/portal-notification-sheet.test.tsx`

Expected: PASS; roles still cannot render another role's module.

- [ ] **Step 5: Record the milestone**

Update `HANDOFF.md` and `PROGRESS.md`; commit only with explicit user
authorization.

### Task 4: Deliver the Admission Staff provisioning workspace

**Files:**
- Create: `frontend/src/features/schemas/admission-schema.ts`, `frontend/src/features/services/admission-service.ts`, `frontend/src/features/hooks/use-student-provisioning.ts`, `frontend/src/features/components/portal/admission-provisioning-workspace.tsx`, `frontend/src/features/lib/temporary-credential.ts`
- Test: `frontend/src/features/services/admission-service.test.ts`, `frontend/src/features/components/portal/admission-provisioning-workspace.test.tsx`, `frontend/src/features/lib/temporary-credential.test.ts`

**Interfaces:**
- Produces `generateTemporaryCredential(): string`, a 20-character browser-generated credential containing at least one upper-case letter, lower-case letter, digit, and symbol.
- Produces `provisionStudent(input: ProvisionStudentInput): Promise<StudentProfile>` for `POST /api/v1/student-profiles`.

- [ ] **Step 1: Write failing credential, form, and receipt tests**

```ts
const credential = generateTemporaryCredential()
expect(credential).toHaveLength(20)
expect(credential).toMatch(/[A-Z]/)
expect(credential).toMatch(/[a-z]/)
expect(credential).toMatch(/[0-9]/)
expect(credential).toMatch(/[^A-Za-z0-9]/)

await user.click(screen.getByRole('button', { name: 'Create student account' }))
await screen.findByText('Student account created')
expect(screen.getByText(credential)).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Close credential receipt' }))
expect(screen.queryByText(credential)).not.toBeInTheDocument()
```

Cover the exact seven request fields, program/curriculum selection, 422 mapping,
copy feedback, duplicate-submit disabled state, and a connection-failure retry.

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd frontend; npm test -- src/features/lib/temporary-credential.test.ts src/features/services/admission-service.test.ts src/features/components/portal/admission-provisioning-workspace.test.tsx`

Expected: FAIL because the workspace and provision service do not exist.

- [ ] **Step 3: Implement one focused three-step workspace**

Use the same component for `student-accounts`, `admission-status`, and
`credential-issuance`, with the route ID selecting the initial heading. The
status step displays the API-guaranteed initial values `admitted` and `good`
as read-only outcome text; it does not invent an update API. Submit only
`name`, `email`, generated `password`, `student_number`, `program_id`,
`curriculum_id`, and `year_level`.

- [ ] **Step 4: Run the Admission Staff checks**

Run: `cd frontend; npm test -- src/features/components/portal/admission-provisioning-workspace.test.tsx src/features/portal/module-registry.test.tsx`

Expected: PASS; non-admission roles retain the scoped module-not-found state.

- [ ] **Step 5: Record the milestone**

Update `HANDOFF.md` and `PROGRESS.md`; commit only with explicit user
authorization.

### Task 5: Deliver Faculty availability, preferences, and teaching schedule

**Files:**
- Create: `frontend/src/features/schemas/faculty-schema.ts`, `frontend/src/features/services/faculty-service.ts`, `frontend/src/features/hooks/use-faculty-input.ts`, `frontend/src/features/components/portal/faculty-input-workspace.tsx`, `frontend/src/features/components/portal/teaching-schedule-workspace.tsx`
- Test: `frontend/src/features/services/faculty-service.test.ts`, `frontend/src/features/components/portal/faculty-input-workspace.test.tsx`, `frontend/src/features/components/portal/teaching-schedule-workspace.test.tsx`

**Interfaces:**
- Produces CRUD services for `/faculty-availabilities` and `/faculty-subject-preferences`, plus `useFacultyAvailabilitiesQuery()` and `useFacultySubjectPreferencesQuery()`.
- Produces `getFacultyTeachingSchedule(sections, subjects, terms): TeachingScheduleRow[]` with `sectionId`, subject code/title, term label, days, time, room, and status label.

- [ ] **Step 1: Write failing CRUD and schedule tests**

```ts
await user.click(screen.getByRole('button', { name: 'Remove availability' }))
await user.click(screen.getByRole('button', { name: 'Confirm removal' }))
expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/faculty-availabilities/4'), expect.objectContaining({ method: 'DELETE' }))

expect(getFacultyTeachingSchedule(sections, subjects, terms)[0]).toMatchObject({
  subjectCode: 'CS101', termLabel: '2026-2027 · 1st', statusLabel: 'Published',
})
```

Cover day values 1–7, `HH:mm:ss` validation, end-after-start, unique-rank 422,
edit/delete confirmation, empty lists, and mobile schedule cards.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npm test -- src/features/services/faculty-service.test.ts src/features/components/portal/faculty-input-workspace.test.tsx src/features/components/portal/teaching-schedule-workspace.test.tsx`

Expected: FAIL because the faculty schemas, services, and components do not exist.

- [ ] **Step 3: Implement Faculty workspaces**

Use React Hook Form forms and alert-dialog confirmation for deletion. Invalidate
only the matching faculty query keys after each mutation. Read sections,
subjects, and terms through parsed reference hooks; do not call a roster or
grade endpoint because neither belongs to Phase 5.

- [ ] **Step 4: Run Faculty checks**

Run: `cd frontend; npm test -- src/features/components/portal/faculty-input-workspace.test.tsx src/features/components/portal/teaching-schedule-workspace.test.tsx src/features/components/layouts/portal-shell.test.tsx`

Expected: PASS; the Faculty role sees only API-scoped schedule data.

- [ ] **Step 5: Record the milestone**

Update `HANDOFF.md` and `PROGRESS.md`; commit only with explicit user
authorization.

### Task 6: Deliver Program Chair curriculum and prerequisite workspaces

**Files:**
- Create: `frontend/src/features/schemas/curriculum-schema.ts`, `frontend/src/features/services/curriculum-service.ts`, `frontend/src/features/hooks/use-curricula.ts`, `frontend/src/features/components/portal/curriculum-workspace.tsx`, `frontend/src/features/components/portal/prerequisite-editor.tsx`
- Test: `frontend/src/features/services/curriculum-service.test.ts`, `frontend/src/features/components/portal/curriculum-workspace.test.tsx`, `frontend/src/features/components/portal/prerequisite-editor.test.tsx`

**Interfaces:**
- Produces `createCurriculum(input: StoreCurriculumInput)` and `replaceCurriculum(id: number, input: UpdateCurriculumInput)`.
- Produces `toCurriculumReplacement(values: CurriculumEditorValues): UpdateCurriculumInput`, preserving every subject placement and prerequisite edge.

- [ ] **Step 1: Write failing full-replace tests**

```ts
expect(toCurriculumReplacement(editorValues).subjects).toEqual([
  { subject_id: 11, year_level: 1, semester: '1st', is_required: true,
    prerequisites: [{ prerequisite_subject_id: 4, minimum_grade: '75' }] },
])

await user.click(screen.getByRole('button', { name: 'Save curriculum' }))
expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/curricula/9'), expect.objectContaining({ method: 'PATCH' }))
```

Cover create versus replace payloads, duplicate placement prevention, preserved
graph data when editing metadata, backend prerequisite-cycle 422 beside the
graph, and discard-unsaved-edits confirmation.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npm test -- src/features/services/curriculum-service.test.ts src/features/components/portal/curriculum-workspace.test.tsx src/features/components/portal/prerequisite-editor.test.tsx`

Expected: FAIL because curriculum client and editor functions do not exist.

- [ ] **Step 3: Implement the Program Chair curriculum components**

Use `/programs`, `/subjects`, and `/curricula` as parsed reference data. The
Curriculum route owns name/program/effective-year/status selection; the
Subjects & Prerequisites route loads a selected curriculum and edits the same
full graph. The update form always sends all required metadata and `subjects`.

- [ ] **Step 4: Run Program Chair curriculum checks**

Run: `cd frontend; npm test -- src/features/components/portal/curriculum-workspace.test.tsx src/features/components/portal/prerequisite-editor.test.tsx src/features/portal/module-registry.test.tsx`

Expected: PASS; only Program Chair can render either workspace.

- [ ] **Step 5: Record the milestone**

Update `HANDOFF.md` and `PROGRESS.md`; commit only with explicit user
authorization.

### Task 7: Deliver Program Chair sections, faculty assignment, and proposals

**Files:**
- Create: `frontend/src/features/schemas/scheduling-schema.ts`, `frontend/src/features/services/scheduling-service.ts`, `frontend/src/features/services/faculty-directory-service.ts`, `frontend/src/features/hooks/use-scheduling.ts`, `frontend/src/features/hooks/use-faculty-directory.ts`, `frontend/src/features/components/portal/sections-workspace.tsx`, `frontend/src/features/components/portal/faculty-assignment-workspace.tsx`, `frontend/src/features/components/portal/schedule-proposals-workspace.tsx`
- Test: `frontend/src/features/services/scheduling-service.test.ts`, `frontend/src/features/services/faculty-directory-service.test.ts`, `frontend/src/features/components/portal/sections-workspace.test.tsx`, `frontend/src/features/components/portal/faculty-assignment-workspace.test.tsx`, `frontend/src/features/components/portal/schedule-proposals-workspace.test.tsx`

**Interfaces:**
- Produces `createSection`, `replaceSection`, `createScheduleProposal`, and `getFacultyMembers` parsed service functions.
- Produces `toSectionReplacement(section: Section, changes: SectionEditorValues): SectionInput`, which includes every required section field before PATCH.

- [ ] **Step 1: Write failing section, assignment, and proposal tests**

```ts
expect(toSectionReplacement(existing, { professor_id: 12 }).professor_id).toBe(12)
expect(toSectionReplacement(existing, { professor_id: 12 }).section_code).toBe('A')

await user.selectOptions(screen.getByLabelText('Faculty member'), '12')
await user.click(screen.getByRole('button', { name: 'Save faculty assignment' }))
expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/sections/5'), expect.objectContaining({ method: 'PATCH' }))
```

Cover the exact directory schema without email, active-only assignment options,
availability/preference context, unassigned sections, conflict 422, proposal
duplicate-term 422, and creation success invalidation.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npm test -- src/features/services/scheduling-service.test.ts src/features/services/faculty-directory-service.test.ts src/features/components/portal/sections-workspace.test.tsx src/features/components/portal/faculty-assignment-workspace.test.tsx src/features/components/portal/schedule-proposals-workspace.test.tsx`

Expected: FAIL because scheduling/directory clients and workspaces do not exist.

- [ ] **Step 3: Implement the three Program Chair scheduling workspaces**

Use explicit academic-term filters. Sections & Schedules creates and fully
replaces sections. Faculty Assignment displays directory names plus matching
availability/preferences and patches the complete selected section. Schedule
Proposals creates a draft proposal only; it does not expose approval or
publication actions to the chair.

- [ ] **Step 4: Run scheduling checks**

Run: `cd frontend; npm test -- src/features/components/portal/sections-workspace.test.tsx src/features/components/portal/faculty-assignment-workspace.test.tsx src/features/components/portal/schedule-proposals-workspace.test.tsx`

Expected: PASS; no email is rendered or retained in client data.

- [ ] **Step 5: Record the milestone**

Update `HANDOFF.md` and `PROGRESS.md`; commit only with explicit user
authorization.

### Task 8: Deliver Dean, Executive Director, and Registrar Head workspaces

**Files:**
- Create: `frontend/src/features/schemas/audit-schema.ts`, `frontend/src/features/services/audit-service.ts`, `frontend/src/features/hooks/use-audit-logs.ts`, `frontend/src/features/components/portal/schedule-decision-workspace.tsx`, `frontend/src/features/components/portal/master-schedule-workspace.tsx`, `frontend/src/features/components/portal/audit-logs-workspace.tsx`
- Test: `frontend/src/features/services/audit-service.test.ts`, `frontend/src/features/components/portal/schedule-decision-workspace.test.tsx`, `frontend/src/features/components/portal/master-schedule-workspace.test.tsx`, `frontend/src/features/components/portal/audit-logs-workspace.test.tsx`

**Interfaces:**
- Produces `availableScheduleActions(role: UserRole, proposal: ScheduleProposal): ScheduleAction[]` using only the API's legal status/action matrix.
- Produces `getAuditLogs(filters: AuditLogFilters): Promise<Paginated<AuditLog>>` and `closeScheduleProposal(id: number): Promise<ScheduleProposal>`.

- [ ] **Step 1: Write failing decision and audit tests**

```ts
expect(availableScheduleActions('dean', draftProposal)).toEqual(['dean_approve'])
expect(availableScheduleActions('executive_director', deanApprovedProposal)).toEqual(['executive_approve'])
expect(availableScheduleActions('registrar_head', publishedProposal)).toEqual(['close'])

await user.click(screen.getByRole('button', { name: 'Apply audit filters' }))
expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('per_page=20'), expect.anything())
```

Cover required decision reason fields, lifecycle confirmation, optimistic-action
disablement, audit filters (`action`, `auditable_type`, `actor_user_id`,
`from`, `to`, `page`, `per_page`), pagination, safe snapshot expansion, 403,
and no unauthorized workspace rendering.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npm test -- src/features/services/audit-service.test.ts src/features/components/portal/schedule-decision-workspace.test.tsx src/features/components/portal/master-schedule-workspace.test.tsx src/features/components/portal/audit-logs-workspace.test.tsx`

Expected: FAIL because the decision matrix and audit workspace do not exist.

- [ ] **Step 3: Implement the approval and control workspaces**

Dean receives the schedule decision component with Dean actions only. Executive
Director receives the master schedule view plus executive/publish actions.
Registrar Head receives paginated audit logs and the close control for published
proposals. Reuse the parsed scheduling query and invalidate proposals/sections
after a successful transition; never display audit actor names or emails.

- [ ] **Step 4: Run approval/control checks**

Run: `cd frontend; npm test -- src/features/components/portal/schedule-decision-workspace.test.tsx src/features/components/portal/master-schedule-workspace.test.tsx src/features/components/portal/audit-logs-workspace.test.tsx src/features/portal/module-registry.test.tsx`

Expected: PASS; each role sees only its permitted controls.

- [ ] **Step 5: Record the milestone**

Update `HANDOFF.md` and `PROGRESS.md`; commit only with explicit user
authorization.

### Task 9: Reconcile documentation and run the Phase 5 quality gate

**Files:**
- Modify: `PROGRESS.md`, `HANDOFF.md`, `docs/api/openapi.yaml`, `docs/testing/SEEDED_IDENTITIES.md` only if UI login guidance changes
- Test: existing backend and frontend complete suites

**Interfaces:**
- Produces the documented 30-route API inventory and Phase 5 module status.
- Produces no new API beyond `/api/v1/faculty-members` and no Phase 9 public prediction boundary.

- [ ] **Step 1: Write or extend final boundary tests before the gate**

```php
$routes = collect(json_decode((string) Artisan::output(), true));
self::assertCount(30, $routes->filter(fn (array $route) => str_starts_with($route['uri'], 'api/v1/')));
```

Add frontend registry assertions that exactly the 13 Phase 5 module IDs render
connected workspaces and every other catalog module remains explicitly planned.

- [ ] **Step 2: Run focused final tests**

Run: `cd backend; php artisan test --filter='FacultyMembersEndpointTest|ApiSurfaceTest'`; then `cd frontend; npm test -- src/features/portal/module-registry.test.tsx`

Expected: PASS with 30 v1 routes and 13 connected Phase 5 modules.

- [ ] **Step 3: Reconcile documentation and progress**

Update the progress weighting only after all Phase 5 work is merged and
verified. Record exact module counts, endpoint count, actual test output, the
faculty-directory privacy/audit decision, and remaining Phase 6–9 work.

- [ ] **Step 4: Run the complete quality gate**

Run:

```powershell
cd backend
php artisan test --without-tty
composer format:check
vendor\bin\phpstan analyse --memory-limit=1G --no-progress
composer audit --locked
cd ..
npx --yes @redocly/cli@latest lint docs/api/openapi.yaml
cd frontend
npm test
npm run typecheck
npm run lint
npm run format:check
npm audit --audit-level=moderate
npm run build
```

Expected: every command exits 0. Record actual test/assertion counts and do
not claim Phase 5 complete if any command is skipped or fails.

- [ ] **Step 5: Final handoff and integration**

Update `HANDOFF.md` immediately with the verification evidence, clean/dirty
status, exact remaining work, and any uncommitted risk. Commit, merge, or push
only with explicit user authorization.

## Plan Self-Review

- Spec coverage: Task 1 implements the one audited backend addition; Tasks 2–3 implement the shared client/shell boundary; Tasks 4–8 cover all 13 specified modules; Task 9 records progress and runs the full gate.
- No placeholders: every task has a concrete failing-test example, command, implementation boundary, expected passing check, and milestone update.
- Type consistency: `FacultyMember`, `PhaseFiveModuleId`, `ScheduleAction`, `ProvisionStudentInput`, `SectionInput`, and `AuditLogFilters` are defined at the task that produces them and are consumed by later tasks with the same names.
