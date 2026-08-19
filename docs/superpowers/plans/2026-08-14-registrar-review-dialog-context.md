# Registrar Review Dialog Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the Registrar review dialog and show authorized student Name,
Year, and Student number above its full schedule table.

**Architecture:** Add nullable Registrar-only student context to the existing
v1 enrollment resource and its strict React schema. Reuse the existing dialog
and table; only its width and the detail area change. `ListEnrollments`
eager-loads the student user relation for queue efficiency.

**Tech Stack:** Laravel API Resources/Policies/PHPUnit; Next.js, React,
TypeScript, Zod, Tailwind, Vitest, Testing Library.

## Global Constraints

- Limit `student_name` and `student_year_level` values to Registrar Staff and
  Registrar Head; return `null` to all other permitted enrollment viewers.
- Do not include a date.
- Keep the existing seven schedule columns, dialog states, and approval flow.
- Keep the dialog at most 1152px wide and retain the shared mobile card
  fallback.
- Do not commit or push without the user's explicit request.

---

### Task 1: Extend the authorized enrollment response

**Files:**
- Modify: `backend/app/Actions/Enrollment/ListEnrollments.php`
- Modify: `backend/app/Http/Resources/Api/V1/EnrollmentResource.php`
- Modify: `backend/tests/Feature/Api/V1/EnrollmentsEndpointTest.php`
- Modify: `frontend/src/features/schemas/enrollment-schema.ts`

**Interfaces:**
- Consumes: `EnrollmentResource`, the authenticated request user, and
  `StudentProfile::user`.
- Produces: nullable `student_name: string | null` and
  `student_year_level: number | null` fields in every v1 enrollment payload.

- [x] **Step 1: Write failing backend and frontend contract assertions**

Extend the exact-key response test and add a Registrar Staff request assertion
for the resolved name and year. Extend a frontend enrollment fixture with the
two nullable keys so Zod rejects a live payload that omits them.

- [x] **Step 2: Run the targeted tests to establish red**

```powershell
php artisan test --filter=EnrollmentsEndpointTest
npx vitest run src/features/components/portal/registrar-enrollment-workspace.test.tsx
```

Expected: the current strict Zod contract/backend exact-key test fails because
the two student-context keys do not exist.

- [x] **Step 3: Implement the minimal contract extension**

Eager-load `student.user`. In `EnrollmentResource`, inspect the authenticated
role and return the student's user name and `year_level` only for Registrar
Staff/Head; return `null` otherwise. Add matching nullable Zod properties and
resource PHPDoc keys.

- [x] **Step 4: Rerun the targeted contract tests**

Run the commands in Step 2. Expected: both pass and non-Registrar viewers
receive no name/year values.

### Task 2: Present student context in the full-width review dialog

**Files:**
- Modify: `frontend/src/features/components/portal/enrollment-review-dialog.tsx`
- Modify: `frontend/src/features/components/portal/registrar-enrollment-workspace.test.tsx`

**Interfaces:**
- Consumes: `Enrollment.student_name`, `Enrollment.student_year_level`, and
  the existing resolved schedule rows.
- Produces: a 1152px-maximum dialog with a labeled student-information strip
  before the existing accessible schedule table.

- [x] **Step 1: Write the failing dialog assertion**

After opening Review, assert the dialog contains the labels Name, Year, and
Student number with the fixture values and retains the table named
`Enrollment #9 schedule`.

- [x] **Step 2: Run the focused dialog test to establish red**

```powershell
npx vitest run src/features/components/portal/registrar-enrollment-workspace.test.tsx
```

Expected: FAIL because the current dialog displays only the student number in
its descriptive line and remains capped at `sm:max-w-2xl`.

- [x] **Step 3: Implement the presentation change**

Set the dialog width to `w-[calc(100vw-2rem)] sm:max-w-6xl`; add a semantic
three-column definition list above `DataTable`, using `—` for unavailable
values and `Year {student_year_level}` for a present year.

- [x] **Step 4: Run final focused verification**

```powershell
php artisan test --filter=EnrollmentsEndpointTest
npx vitest run src/features/components/portal/registrar-enrollment-workspace.test.tsx
npx eslint src/features/components/portal/enrollment-review-dialog.tsx src/features/components/portal/registrar-enrollment-workspace.test.tsx --max-warnings=0 --concurrency 4
npm run typecheck
npx prettier --check src/features/components/portal/enrollment-review-dialog.tsx src/features/components/portal/registrar-enrollment-workspace.test.tsx
git diff --check
```

Expected: all focused checks pass. The known unrelated
`portal-module-page.test.tsx` failure is outside this slice.
