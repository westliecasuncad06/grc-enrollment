# Task 2 — IT-control account browser endpoints

## Scope delivered

- Added `GET /api/v1/it-control/students` and `GET /api/v1/it-control/faculty`.
- Both routes are Sanctum-authenticated, active-user protected by the parent API group, and explicitly restricted to `role:it_admin`. `ItControlPolicy` is registered as the controller's defense-in-depth Gate.
- Added Form Requests, transaction-backed paginated Actions, deterministic ordering with an `id` tiebreak, `withQueryString()`, exact account Resources, and `Cache-Control: no-store, private` responses.
- Student filtering supports `q`, `college`, `program_id`, `year_level`, `enrollment_category`, `status`, `per_page`, and `page`. Search covers student number, name, and email. The resource reports the status of the latest enrollment in a Semester Ongoing term, or `null`.
- Faculty filtering supports `q`, `college`, `employment_type`, `status`, `per_page`, and `page`. Search covers name and email. The listing uses database subqueries for availability, preference, and specialization counts.
- The two Resources expose only their specified fields plus the required local test-login `password_hint: "password"`; no password hash is returned.
- Updated the exact sorted route/API-surface contract and its auth/role checks.

## TDD evidence

1. Added the two endpoint suites and API-surface expectations before any production implementation.
2. Initial RED command:

   ```powershell
   cd backend
   vendor/bin/phpunit tests/Feature/Api/V1/ItControl --testdox
   ```

   completed with exit 1. It produced 23 expected absent-route 404 failures and one test-fixture error (`faculty_subject_preferences.academic_term_id` was null). Only the fixture was corrected; no production code existed.
3. Re-ran the same RED command after correcting the fixture. It completed with exit 1, **24 failures / 24 tests**, all for the expected missing routes returning 404 (no fixture or application errors).
4. After minimal implementation, the requested GREEN command initially exposed a type mismatch in the student eager-load callback (`HasMany` was passed where `Builder` was declared). The focused test was the reproduction; the callback was changed to accept `HasMany` and preserve the query behavior.
5. Final GREEN command:

   ```powershell
   cd backend
   vendor/bin/phpunit tests/Feature/Api/V1/ItControl tests/Feature/Api/V1/ApiSurfaceTest.php --testdox
   ```

   completed successfully: **46 tests, 334 assertions**.

## Final verification

```powershell
cd backend
vendor/bin/pint --test app/Actions/ItControl app/Http/Controllers/Api/V1/ItControl app/Http/Requests/Api/V1/ItControl app/Http/Resources/Api/V1/ItControl app/Policies/ItControlPolicy.php app/Providers/AppServiceProvider.php routes/api.php tests/Feature/Api/V1/ItControl tests/Feature/Api/V1/ApiSurfaceTest.php
vendor/bin/phpunit tests/Feature/Api/V1/ItControl tests/Feature/Api/V1/ApiSurfaceTest.php --testdox
git diff --check
```

- Pint: passed.
- PHPUnit: passed, 46 tests / 334 assertions.
- `git diff --check`: passed.
- A full PHPUnit suite was intentionally not recorded as passing: this task's bounded, relevant verification completed, while the known broad suite is slow on the local MariaDB setup.

## Preserved user-owned state

`PROGRESS.md` and `grades-com-student1.png` were already user-owned changes. They were not modified or staged by Task 2.
