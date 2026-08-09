# Faculty Employment Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local faculty employment types, inactive accounts, Program Chair workforce controls, and a complete local account report.

**Architecture:** Store planning employment type on the existing `users` faculty identity, continue using `users.status` as the login/assignment gate, and route Program Chair edits through an audited Laravel action. The workbook synchronizer fills missing local identities and derives an initial employment type from teaching evidence, while explicit chair edits are preserved.

**Tech Stack:** Laravel 12, Sanctum bearer tokens, MariaDB migrations, API Resources/Form Requests/Policies, Next.js React TypeScript, TanStack Query, React Hook Form, Zod, Tailwind/shadcn.

## Global Constraints

- Keep all accounts and reports local/test-only with `@grc.test` email addresses and no production data.
- Full-time planning reference is 33 units; it is not an automatic overload policy.
- Only a Program Chair may edit faculty in their own college; all changes are audited.
- Preserve disabled accounts and teaching history; inactive faculty are never automatically recommended.
- Do not commit raw workbooks, generated account reports, or unrelated working-tree changes.

---

### Task 1: Employment-type persistence and account synchronization

**Files:**
- Create: `backend/database/migrations/2026_08_09_000006_add_faculty_employment_type.php`
- Modify: `backend/app/Models/User.php`
- Modify: `backend/database/seeders/WorkbookFacultyProfileSeeder.php`
- Modify: `backend/tests/Feature/Database/WorkbookFacultyProfileSeederTest.php`

**Interfaces:**
- Produces `User::$employment_type` with `full_time|part_time|null`.
- Produces `WorkbookFacultyProfileSeeder::run()` that creates missing faculty accounts, preserves manual values, and seeds inactive local accounts.

- [ ] **Step 1: Write the failing synchronization test**

```php
public function test_it_assigns_local_employment_types_and_keeps_inactive_faculty_out_of_active_accounts(): void
{
    (new WorkbookFacultyProfileSeeder($fixturePath))->run();

    $this->assertDatabaseHas('users', ['email' => 'faculty.ccs.example@grc.test', 'employment_type' => 'full_time']);
    $this->assertDatabaseHas('users', ['email' => 'inactive.ccs.1@grc.test', 'status' => 'disabled']);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/phpunit tests/Feature/Database/WorkbookFacultyProfileSeederTest.php --filter employment_type --testdox`

Expected: FAIL because the `employment_type` column and inactive account seed are missing.

- [ ] **Step 3: Implement the migration, cast, and local synchronizer**

```php
$table->string('employment_type', 16)->nullable()->after('college');

$employmentType = count($distinctPreferenceKeys) >= 6 ? 'full_time' : 'part_time';
User::updateOrCreate(['email' => $email], ['employment_type' => $employmentType]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vendor/bin/phpunit tests/Feature/Database/WorkbookFacultyProfileSeederTest.php --filter employment_type --testdox`

Expected: PASS with full-time, part-time, and disabled inactive records asserted.

### Task 2: Audited Program Chair workforce update API

**Files:**
- Create: `backend/app/Actions/Organization/UpdateFacultyWorkforceProfile.php`
- Create: `backend/app/Http/Requests/Api/V1/FacultyMember/UpdateFacultyWorkforceProfileRequest.php`
- Modify: `backend/app/Http/Controllers/Api/V1/FacultyMemberController.php`
- Modify: `backend/app/Http/Resources/Api/V1/FacultyMemberResource.php`
- Modify: `backend/app/Policies/FacultyMemberPolicy.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Domain/Audit/AuditAction.php`
- Modify: `backend/app/Domain/Audit/AuditableType.php`
- Test: `backend/tests/Feature/Api/V1/FacultyMembersEndpointTest.php`

**Interfaces:**
- Produces `PATCH /api/v1/faculty-members/{facultyMember}/workforce-profile` accepting `{ status, employment_type, reason? }`.
- Returns a `FacultyMemberResource` with `college`, `employment_type`, `planning_unit_reference`, and `is_assignable`.

- [ ] **Step 1: Write failing API authorization and audit tests**

```php
$response = $this->withToken($chairToken)->patchJson("/api/v1/faculty-members/{$faculty->id}/workforce-profile", [
    'status' => 'disabled', 'employment_type' => 'part_time', 'reason' => 'No current teaching assignment.',
]);

$response->assertOk()->assertJsonPath('data.employment_type', 'part_time');
$this->assertDatabaseHas('audit_logs', ['action' => AuditAction::FACULTY_WORKFORCE_PROFILE_UPDATED]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/phpunit tests/Feature/Api/V1/FacultyMembersEndpointTest.php --filter workforce_profile --testdox`

Expected: FAIL with a missing route or controller action.

- [ ] **Step 3: Implement policy, request, action, resource fields, and route**

```php
if ($facultyMember->college !== $actor->college) {
    throw AuthorizationException::forUser($actor, 'update', $facultyMember);
}

$user->update(['status' => $validated['status'], 'employment_type' => $validated['employment_type']]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `vendor/bin/phpunit tests/Feature/Api/V1/FacultyMembersEndpointTest.php --filter workforce_profile --testdox`

Expected: PASS for own-college update/audit and cross-college denial.

### Task 3: Program Chair workforce controls and account report

**Files:**
- Modify: `frontend/src/features/schemas/faculty-directory-schema.ts`
- Modify: `frontend/src/features/services/faculty-directory-service.ts`
- Modify: `frontend/src/features/hooks/use-faculty-directory.ts`
- Modify: `frontend/src/features/components/portal/schedule-faculty-loading-workspace.tsx`
- Modify: `frontend/src/features/components/portal/schedule-faculty-loading-workspace.test.tsx`
- Modify: `backend/database/seeders/WorkbookFacultyProfileSeeder.php`

**Interfaces:**
- Consumes faculty directory records with employment type/status.
- Produces an editable Program Chair workforce table and regenerated ignored Markdown account report.

- [ ] **Step 1: Write failing workspace test**

```tsx
expect(await screen.findByText('Employment type')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Edit workforce status for Ada Santos' }))
expect(screen.getByRole('dialog')).toHaveTextContent('Full-time')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/components/portal/schedule-faculty-loading-workspace.test.tsx --pool=forks --maxWorkers=1 --no-isolate`

Expected: FAIL because the workforce table and action do not exist.

- [ ] **Step 3: Implement React Query mutation and responsive workforce dialog**

```tsx
const workforceMutation = useMutation({
  mutationFn: updateFacultyWorkforceProfile,
  onSuccess: () => queryClient.invalidateQueries({ queryKey: facultyDirectoryQueryKey(userId) }),
})
```

- [ ] **Step 4: Regenerate local report after a successful local seed**

Run: `php artisan db:seed --class='Database\Seeders\WorkbookFacultyProfileSeeder' --no-interaction`

Expected: `storage/app/local-reports/professor-accounts.md` lists all Faculty users with status, employment type, preferences, availability, history, and current units.

- [ ] **Step 5: Run focused tests**

Run: `npx vitest run src/features/components/portal/schedule-faculty-loading-workspace.test.tsx --pool=forks --maxWorkers=1 --no-isolate`

Expected: PASS for workforce editing and existing schedule filters.

### Task 4: Verification and saving point

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Run backend focused verification**

Run: `vendor/bin/phpunit tests/Feature/Database/WorkbookFacultyProfileSeederTest.php tests/Feature/Api/V1/FacultyMembersEndpointTest.php --testdox`

Expected: PASS.

- [ ] **Step 2: Run frontend verification and build**

Run: `npm run build`

Expected: production build succeeds.

- [ ] **Step 3: Confirm staged scope and commit only user-authorized files**

Run: `git diff --cached --check`

Expected: no whitespace errors; generated reports and unrelated dirty files are excluded.
