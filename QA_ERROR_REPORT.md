# GRC Enrollment System — QA Defect & Error Report

**Audit Date**: 2026-09-04  
**Audit Scope**: Multi-Role Functional Testing, All Buttons & Features, and End-to-End Enrollment Execution  
**Target Environment**: Local Full Stack (Next.js 16 + Laravel 12 + MariaDB)  

---

## 1. Executive Summary & Defect Statistics

| Metric | Count |
|--------|-------|
| Total Workspaces Tested | 45+ |
| Total Defects Logged | 6 |
| Blocker / Critical Severity | 4 |
| Major Severity | 2 |
| Minor Severity | 0 |
| Cosmetic / UX | 0 |

---

## 2. Defect Tracking Table

| ID | Severity | Role | Module / View | Button / Element | Summary | Status |
|----|----------|------|---------------|------------------|---------|--------|
| BUG-001 | Critical | Registrar Head / Program Chair | Rooms (`/portal/rooms`), Sections API | Page Load / `GET /api/v1/sections` | `ValueError: "draft" is not a valid backing value for enum App\Domain\Scheduling\SectionStatus` causes HTTP 500 when loading rooms or sections. | Fixed |
| BUG-002 | Major | Registrar Head / Program Chair | Rooms (`/portal/rooms`), Schedule | Page Load / `getSections()` | `sectionSchema` in `reference-data-schema.ts` lacks `"draft"` in `status: z.enum(...)`, causing contract validation error on frontend when draft sections exist. | Fixed |
| BUG-003 | Critical | Program Chair | Enrollment (`/portal/program-chair-enrollment`) | "Generate Schedule" button | Syntax error (`unexpected token "if", expecting "]"`) in `ApplyDemandForecastToDraft.php:103` crashes predictive schedule generation synchronously. | Fixed |
| BUG-004 | Critical | Executive Director / Student | Master Schedule (`/portal/master-schedule`), Student Enrollment | "Publish schedule" button / Block Section selection | `TransitionScheduleProposal.php` on publish only transitions sections with status `planned`, ignoring sections with status `draft`. This leaves newly generated sections unpublished and withheld from student enrollment. | Fixed |
| BUG-005 | Critical | Registrar Staff | Enrollment Approvals (`/portal/enrollment-approvals`) | "Approve" button / `PATCH /api/v1/enrollments/{id}` | `AssessEnrollment.php:80` references undefined variable `$raw` instead of `$raw = config($key);`, throwing fatal `ErrorException: Undefined variable $raw` on enrollment approval assessment calculation. | Fixed |
| BUG-006 | Major | Student | Certificate of Registration (`/portal/digital-com`) | "View COR" button | `corSnapshotSchema.fees.payment_amount` strictly expects string (`z.string()`), but backend produces numeric value (`10800`), causing Zod contract validation error on COR display modal. | Fixed |

---

## 3. Detailed Defect Specifications

### [BUG-001] ValueError: "draft" is not a valid backing value for enum App\Domain\Scheduling\SectionStatus
- **Severity**: Critical (Causes 500 Internal Server Error on core scheduling and rooms endpoints)
- **Role Affected**: Registrar Head, Program Chair, Dean
- **URL / Module**: `/portal/rooms`, `GET /api/v1/sections`
- **Component / Trigger**: Navigating to Rooms workspace (`/portal/rooms`) or fetching sections list
- **Steps to Reproduce**:
  1. Sign in as Registrar Head (`registrar-head.seed@grc.test`).
  2. Click on "Rooms" in the navigation sidebar (`/portal/rooms`).
  3. Frontend sends `GET http://127.0.0.1:8000/api/v1/sections`.
  4. Backend responds with HTTP 500 Internal Server Error.
- **Observed Behavior**:
  - Browser console displays: `Failed to load resource: the server responded with a status of 500 (Internal Server Error) @ http://127.0.0.1:8000/api/v1/sections`.
  - Backend `laravel.log` logs: `ValueError: "draft" is not a valid backing value for enum App\Domain\Scheduling\SectionStatus at vendor/laravel/framework/src/Illuminate/Database/Eloquent/Concerns/HasAttributes.php:1301`.
- **Expected Behavior**:
  - `GET /api/v1/sections` should respond with HTTP 200 and return the sections without crashing.
- **Root Cause Analysis**:
  - In `App\Domain\Scheduling\SectionStatus`, the supported enum cases are `planned`, `published`, `closed`, and `cancelled`.
  - In the `sections` table, 58 sections for active Term 9 have `status = 'draft'` (set during section plan draft resets).
  - When Eloquent casts `sections.status` to `SectionStatus::class`, PHP throws an unhandled `ValueError` because `'draft'` is not defined in `SectionStatus`.
- **Recommended Fix**:
  - In `backend/app/Domain\Scheduling\SectionStatus.php`: Add `case Draft = 'draft';` to `SectionStatus` so any draft sections are recognized cleanly and do not crash Eloquent casting. Update `acceptsEnrollment()` and `isVisibleToLearners()` to return `false` for `Draft` (identical to `Planned`).
  - Update any existing sections in database with `status = 'draft'` to `status = 'planned'` if standard convention requires `planned`.
- **Status**: Fixed in backend (`SectionStatus.php`)

---

### [BUG-002] `sectionSchema` Zod enum in frontend omits `"draft"` status
- **Severity**: Major (Blocks rendering of Rooms, Schedule, and any workspace consuming `useSectionsQuery` when draft sections exist)
- **Role Affected**: Registrar Head, Program Chair, Dean
- **URL / Module**: `/portal/rooms`, `/portal/schedule`
- **Component / Trigger**: Any call to `getSections()` in `reference-data-service.ts`
- **Steps to Reproduce**:
  1. Have sections in the database with status `'draft'` (e.g. from predictive planning draft runs).
  2. Navigate to `/portal/rooms` or `/portal/schedule`.
  3. Client executes `getSections()`.
  4. Zod schema validation fails on `status: "draft"`.
- **Observed Behavior**:
  - UI displays error alert: `Unexpected API response: The API responded, but its sections payload did not match the published v1 contract.`
- **Expected Behavior**:
  - Valid section statuses, including `"draft"`, should parse successfully into the TypeScript types.
- **Root Cause Analysis**:
  - In `frontend/src/features/schemas/reference-data-schema.ts:106`, `sectionSchema` defines `status: z.enum(["planned", "published", "closed", "cancelled"])` without `"draft"`.
  - In `frontend/src/features/types/reference-data.ts`, `SectionStatus` type likewise omits `"draft"`.
- **Recommended Fix**:
  - Add `"draft"` to `status` enum in `frontend/src/features/schemas/reference-data-schema.ts:106`.
  - Update `SectionStatus` union type in `frontend/src/features/types/reference-data.ts`.
- **Status**: Fixed (`reference-data-schema.ts` and `scheduling-schema.ts`)

---

### [BUG-003] Syntax Error in `ApplyDemandForecastToDraft.php` breaking Schedule Generation
- **Severity**: Critical (Blocks entire predictive scheduling and automated schedule generation pipeline)
- **Role Affected**: Program Chair
- **URL / Module**: `/portal/program-chair-enrollment`
- **Component / Trigger**: Clicking "Generate Schedule" button
- **Steps to Reproduce**:
  1. Sign in as Program Chair (`chair.ccs@grc.test`).
  2. Navigate to `/portal/program-chair-enrollment`.
  3. Click "Generate Schedule".
  4. Backend dispatches `GenerateScheduleRecommendations` job synchronously.
- **Observed Behavior**:
  - UI displays error status: `syntax error, unexpected token "if", expecting "]"`
  - Generation run row in `schedule_generation_runs` gets marked as `status: failed` with `error_summary: syntax error, unexpected token "if", expecting "]"`.
- **Expected Behavior**:
  - Predictive schedule generation job should execute cleanly, restoring submitted section plans to draft when workflow is in `schedule_preparation`, forecasting demand, and assigning faculty, days, times, and rooms.
- **Root Cause Analysis**:
  - In `backend/app/Actions/Scheduling/ApplyDemandForecastToDraft.php:98-103`, the `$plan->update([...` array call inside `if ($isDraftWorkflow)` was unclosed before the subsequent `if ($plan === null)` block.
- **Recommended Fix**:
  - Close `$plan->update([...]); } else { ... continue; } }` properly in `ApplyDemandForecastToDraft.php`.
- **Status**: Fixed (`ApplyDemandForecastToDraft.php`)

---

### [BUG-004] `TransitionScheduleProposal` ignores `draft` sections on schedule publication
- **Severity**: Critical (Blocks newly generated sections from being published, preventing students from seeing or selecting fully scheduled sections)
- **Role Affected**: Executive Director, Student
- **URL / Module**: `/portal/master-schedule`, `/portal/enrollment`
- **Component / Trigger**: "Publish schedule" button in Executive Director Master Schedule
- **Steps to Reproduce**:
  1. Generate predictive schedule for a college where sections are created in `draft` status.
  2. Submit schedule proposal through Dean approval to Executive Director.
  3. Executive Director publishes the schedule.
  4. Query `sections` table for sections of that college.
- **Observed Behavior**:
  - Sections with `status = 'draft'` remain in `draft` status instead of being transitioned to `published`.
  - In the Student Portal (`/portal/enrollment`), the newly scheduled sections (e.g. `IT102`) are omitted from the block pool, leaving only unscheduled placeholder sections with "This section is not fully scheduled yet".
- **Expected Behavior**:
  - All sections associated with the college's section plan (both `planned` and `draft`) should be transitioned to `published` status upon Executive Director publication.
- **Root Cause Analysis**:
  - In `backend/app/Actions/Scheduling/TransitionScheduleProposal.php:125`, the publication query was hardcoded to `->where('status', SectionStatus::Planned->value)`.
- **Recommended Fix**:
  - Update `TransitionScheduleProposal.php` to include both `SectionStatus::Planned->value` and `SectionStatus::Draft->value` in the publication transition query.
- **Status**: Fixed (`TransitionScheduleProposal.php`)

---

### [BUG-005] Undefined variable `$raw` in `AssessEnrollment.php:80` crashing Enrollment Approvals
- **Severity**: Critical (Blocks registrar staff from approving any student enrollment, failing tuition assessment calculation)
- **Role Affected**: Registrar Staff
- **URL / Module**: `/portal/enrollment-approvals`
- **Component / Trigger**: Clicking "Approve" -> "Confirm decision" on pending enrollment
- **Steps to Reproduce**:
  1. Student submits enrollment request (`status: pending_registrar_approval`).
  2. Sign in as Registrar Staff (`registrar-staff.seed@grc.test`).
  3. Navigate to `/portal/enrollment-approvals`.
  4. Click "Approve" and "Confirm decision" on enrollment.
  5. Request `PATCH /api/v1/enrollments/{id}` is executed.
- **Observed Behavior**:
  - Request returns HTTP 500 Internal Server Error.
  - `laravel.log` records: `local.ERROR: Undefined variable $raw at C:/xampp/htdocs/GRC-ENROLLMENT/backend/app/Actions/Billing/AssessEnrollment.php:80`.
- **Expected Behavior**:
  - Enrollment transitions to `approved` (or `pending_payment`), tuition assessment is calculated and saved in database, and student queue ticket is generated.
- **Root Cause Analysis**:
  - In `backend/app/Actions/Billing/AssessEnrollment.php:77-85`, the private method `resolveTuitionPerUnit()` set `$key = 'fees.tuition_per_unit'`, then checked `is_scalar($raw)` without ever reading `$raw = config($key)`.
- **Recommended Fix**:
  - Define `$raw = config($key);` before checking `is_scalar($raw)`.
- **Status**: Fixed (`AssessEnrollment.php`)

---

### [BUG-006] Type Mismatch in `corSnapshotSchema.fees.payment_amount` (number vs string)
- **Severity**: Major (Prevents students from viewing or previewing their official COR/COM document on `/portal/digital-com`)
- **Role Affected**: Student
- **URL / Module**: `/portal/digital-com`
- **Component / Trigger**: Clicking "View COR" button on issued Certificate of Registration
- **Steps to Reproduce**:
  1. Complete enrollment and cashier payment confirmation for a student.
  2. Navigate to `/portal/digital-com`.
  3. Click "View COR".
- **Observed Behavior**:
  - UI displays error banner: `Unexpected API response: The API responded, but its Certificate of Registration did not match the published v1 contract.`
  - Modal fails to open.
- **Expected Behavior**:
  - Official Certificate of Registration snapshot should parse cleanly and display institutional header, student information, enrolled subjects table, fee particulars breakdown, and signatories.
- **Root Cause Analysis**:
  - In `frontend/src/features/schemas/enrollment-document-schema.ts:109`, `fees.payment_amount` was typed as `z.string()`. The backend JSON serialization produces `payment_amount` as a number (e.g. `10800`), causing strict Zod validation to fail.
- **Recommended Fix**:
  - Update `payment_amount: z.union([z.string(), z.number()]).transform((val) => String(val))` in `enrollment-document-schema.ts`.
- **Status**: Fixed (`enrollment-document-schema.ts`)

---

### [BUG-007] Playwright Strict Mode Ambiguity on Dual-Copy Official COR Header
- **Severity**: Minor (Test automation locator ambiguity during visual verification of official COM document)
- **Role Affected**: Student
- **URL / Module**: `/portal/digital-com`
- **Component / Trigger**: Previewing official Certificate of Registration modal dialog
- **Observed Behavior**:
  - `locator('h1:has-text("CERTIFICATE OF REGISTRATION")')` resolved to 3 separate DOM elements: the workspace page header plus both official copies of the COR (Student Copy & Registrar Copy displayed side-by-side).
- **Expected Behavior**:
  - Playwright test runner should target `.first()` or specific copy container without failing strict mode.
- **Root Cause & Fix**:
  - Updated locator to `.first()` in Playwright test runner script.
- **Status**: Fixed (`qa_live_enrollment_cycle.mjs`)

---

## 4. Comprehensive 450-Student Matrix Test Results

Conducted full matrix evaluation across all 12 degree programs and majors, Years 1–4, testing 5 regular and 5 irregular students per cohort:
- **Total Students Evaluated**: 450
- **Identity & Authentication Verified**: 450 / 450 (100.0%)
- **Student Profiles & Standing Verified**: 450 / 450 (100.0%)
- **Academic Grade Histories Verified**: 450 / 450 (100.0%)
- **Notification Feeds Verified**: 450 / 450 (100.0%)
- **Enrollment Eligibility & Subject Pools Verified**: 450 / 450 (100.0%)
- **Total Inconsistencies / Errors**: 0

| College | Program / Major | Year Levels | Reg / Irreg per Year | Total Evaluated | Auth OK | Profile OK | Grades OK | Notifs OK | Enrollment OK |
|---|---|---|---|---|---|---|---|---|---|
| CCS | BS Information Technology (`BSIT`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| CBAE | BSBA Financial Management (`BSBA-FM`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| CBAE | BSBA Marketing Management (`BSBA-MM`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| CBAE | BSBA Human Resource Management (`BSBA-HRM`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| CBAE | BS Entrepreneurship (`BSENTREP`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| COE | Bachelor of Elementary Education (`BEED`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| COE | BSED Major in English (`BSED-ENG`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| COE | BSED Major in Filipino (`BSED-FIL`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| COE | BSED Major in Social Studies (`BSED-SOCSCI`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| COE | BSED Major in Values Education (`BSED-VAL`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| COA | BS Accountancy (`BSA`) | Years 1–4 | 5 Reg + 5 Irreg | 40 | 40 | 40 | 40 | 40 | 40 |
| COE | Teacher Certificate Program (`TCP`) | Year 1 | 5 Reg + 5 Irreg | 10 | 10 | 10 | 10 | 10 | 10 |
| **TOTAL** | **12 Programs & Majors** | **All Years** | **5 Reg + 5 Irreg** | **450** | **450** | **450** | **450** | **450** | **450** |

---

## 5. Multi-Role Features, Buttons & Notification Verification

Executed via Playwright across Next.js frontend (`localhost:3000`) and Laravel API (`127.0.0.1:8000`):
- **Registrar Head** (`registrar-head.seed@grc.test`): `/portal`, `/portal/academic-terms`, `/portal/fee-settings`, `/portal/rooms`, `/portal/audit-logs`, Bell & Drawer, Unread Filter toggle [PASSED]
- **Program Chair** (`chair.ccs@grc.test`): `/portal`, `/portal/program-chair-enrollment`, `/portal/curriculum-management`, `/portal/faculty-preferences`, Bell & Drawer, Unread Filter toggle [PASSED]
- **Dean** (`dean.seed@grc.test`): `/portal`, `/portal/schedule-approvals`, `/portal/faculty-workload`, `/portal/deans-list`, Bell & Drawer, Unread Filter toggle [PASSED]
- **Executive Director** (`executive.seed@grc.test`): `/portal`, `/portal/master-schedule`, `/portal/enrollment-reports`, `/portal/revenue-summary`, Bell & Drawer, Unread Filter toggle [PASSED]
- **Admission Staff** (`admission.seed@grc.test`): `/portal`, `/portal/student-records`, `/portal/admission-queue`, Bell & Drawer, Unread Filter toggle [PASSED]
- **Registrar Staff** (`registrar-staff.seed@grc.test`): `/portal`, `/portal/enrollment-approvals`, `/portal/credit-mappings`, `/portal/academic-records`, Bell & Drawer, Unread Filter toggle [PASSED]
- **Accounting / Cashier** (`accounting.seed@grc.test`): `/portal`, `/portal/payment-queue`, `/portal/student-accounts`, `/portal/payment-audit`, Bell & Drawer, Unread Filter toggle [PASSED]
- **Faculty Member** (`faculty.sample.ccs@grc.test`): `/portal`, `/portal/availability-preferences`, `/portal/teaching-schedule`, `/portal/class-rosters`, `/portal/grade-submission`, Bell & Drawer, Unread Filter toggle [PASSED]
- **Queue Kiosk** (`/queue`): Device login (`queue@grc.com`), Kiosk unlock, Student queue login interface, Device sign-out [PASSED]
- **Live End-to-End Enrollment Cycle**: Predictive schedule proposal -> Dean approval -> Executive Director publishing -> Student Block selection -> Registrar Staff approval & assessment -> Queue ticket claim -> Cashier payment confirmation -> Official Certificate of Registration (COM/COR #COR030327) generation & viewing [PASSED]

---

## 6. Test Run Artifacts & Log Index
- **Pre-test Database Backup**: `backend/database/backups/qa_matrix_baseline.sql` (139,186,649 bytes)
- **Cohort Data**: `frontend/scripts/student_matrix_cohort.json` (450 students)
- **Matrix Audit Results**: `frontend/scripts/student_matrix_results.json`
- **Total Workspaces & Features Verified**: 58 / 58 Passed (100%)

---

## 7. Deep Functional QA Audit: Admission, Professor Grade Submission, Multi-Year Student Browser Automation & Pristine Program Chair State

**Audit Date**: 2026-09-05  
**Execution Tool**: Playwright Headless Automation (`frontend/scripts/qa_deep_audit_system.mjs`)  
**Results**: **159 / 159 Checks Passed (100.0% Success Rate, 0 Failures)**

### 7.1 Admission Staff Deep Audit (`admission.seed@grc.test`)
- **UI Sign In & Dashboard**: Clean authentication, redirect to `/portal`, bell notification drawer toggle [PASSED]
- **Create Account Panel**: Validated form presence and reactive state for First Name (`#record-first-name`), Last Name (`#record-last-name`), Email (`#record-email`), Complete Address (`#record-address`), and Action Button (`Create account and email setup`) [PASSED]
- **Student Directory & In-Person Profile Edit**:
  - Searched directory for student number `2023-06-00001` (`Seed Student`) [PASSED]
  - Filtered directory and triggered `View / edit` dialog (`StudentRecordDialog`) [PASSED]
  - Verified and updated student address (`123 GRC Campus Way, Grace Park, Caloocan City`) [PASSED]
  - Provided reason for correction (`Admission Staff In-Person Document Intake Verification`) [PASSED]
  - Checked `Identity verified in person at Admission` (`#edit-verified`) [PASSED]
  - Clicked `Save verified correction` — verified successful mutation and modal dismissal [PASSED]
- **Change Requests Tab**: Verified student profile change requests review table and status badges [PASSED]

### 7.2 Professor / Faculty Member Deep Audit & Grade Submission (`faculty.seed@grc.test` / Diana L. Santos)
- **UI Sign In & Dashboard**: Clean authentication, redirect to `/portal`, bell notification drawer toggle [PASSED]
- **Availability Preferences (`/portal/availability-preferences`)**: Interactive day/time schedule availability checkboxes, saved preferences button [PASSED]
- **Teaching Schedule (`/portal/teaching-schedule`)**: Verified approved teaching block assignments, days, times, and room allocations [PASSED]
- **Class Rosters (`/portal/class-rosters`)**: Inspected section student rosters, student counts, and enrolled learners [PASSED]
- **Grade Submission & Live Grade Encoding (`/portal/grade-submission`)**:
  - Assigned class card selection: Clicked section card `IT101` (`ITCL - Introduction to Computing LAB`) in state "Ready to submit" [PASSED]
  - Section Grade Sheet Table: Rendered enrolled students table with student numbers and names [PASSED]
  - Grade Select Dropdown: Clicked grade select combobox and chose mark `1.25` [PASSED]
  - Remarks Input: Entered remarks `Excellent midterms & laboratory coursework` [PASSED]
  - Save Draft Mutation: Clicked `Save draft` button — verified successful API persistence via `POST /api/v1/sections/{id}/grades` with `{ mark: "1.25", remarks: "..." }` [PASSED]
  - Submit Final Grades: Clicked `Submit final grades` button — rendered confirmation `AlertDialog` ("Submit final grades?"), reviewed warning terms, and tested `Review again` (Cancel) action [PASSED]

### 7.3 Multi-Year Student Browser Automation (13 Cohort Accounts)
Verified complete browser-driven workflow for 13 distinct student accounts spanning 1st Year to 4th Year, regular and irregular cohorts, across BSIT, BEED, BSA, and TCP:
- **BSIT Year 1 Regular** (`student.seed@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BSIT Year 1 Irregular** (`s2601665@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BSIT Year 2 Regular** (`student2.seed@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BSIT Year 2 Irregular** (`s2501631@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BSIT Year 3 Regular** (`student3.seed@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BSIT Year 3 Irregular** (`s2401551@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BSIT Year 4 Regular** (`student4.seed@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BSIT Year 4 Irregular** (`s2301451@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BEED Year 3 Regular** (`s2401002@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BEED Year 3 Irregular** (`s2401001@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BSA Year 4 Regular** (`s2301362@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **BSA Year 4 Irregular** (`s2301361@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]
- **TCP Year 1 Regular** (`s2601211@grc.test`): Login, Dashboard, Enrollment, Grades, Digital COM, Student Information, Bell [PASSED]

### 7.4 Administrative Roles & Workspaces Sweep
- **Registrar Head** (`registrar-head.seed@grc.test`): `/portal`, `/portal/academic-terms`, `/portal/fee-settings`, `/portal/rooms`, `/portal/audit-logs`, Bell & Drawer [PASSED]
- **Program Chair (CCS)** (`chair.ccs@grc.test`): `/portal`, `/portal/program-chair-enrollment`, `/portal/subjects-prerequisites`, `/portal/schedule`, `/portal/faculty-loading`, `/portal/rooms`, Bell & Drawer [PASSED]
- **Dean** (`dean.seed@grc.test`): `/portal`, `/portal/schedule-approvals`, `/portal/curriculum-approvals`, `/portal/enrollment-dashboard`, `/portal/honors`, Bell & Drawer [PASSED]
- **Executive Director** (`executive.seed@grc.test`): `/portal`, `/portal/master-schedule`, `/portal/curriculum-approvals`, `/portal/institution-dashboard`, Bell & Drawer [PASSED]
- **Registrar Staff** (`registrar-staff.seed@grc.test`): `/portal`, `/portal/enrollment-approvals`, `/portal/credit-mappings`, `/portal/academic-records`, Bell & Drawer [PASSED]
- **Accounting / Cashier** (`accounting.seed@grc.test`): `/portal`, `/portal/payment-queue`, `/portal/payment-records`, `/portal/cor-records`, `/portal/queue-kiosk-access`, Bell & Drawer [PASSED]
- **Queue Kiosk** (`/queue`): Device login (`queue@grc.com`), Kiosk unlock, Student queue interface, Device lock/sign-out [PASSED]

### 7.5 Pristine State Restoration & Program Chair Schedule Reset
Per explicit user instruction:
1. **Database Restoration**: Fully restored MariaDB database from `backend/database/backups/qa_matrix_baseline.sql`.
2. **Active Academic Term**: Set strictly to **`2026-2027 · 1st Semester`** (`id = 9`, `status = 'semester_ongoing'`). All other terms closed.
3. **Program Chair Pre-Generation State**:
   - `Section::where('academic_term_id', 9)->delete()` — Removed all draft sections in Term 9.
   - Total sections in Term 9: **`0`**.
   - Total schedule proposals in Term 9: **`0`**.
   - Total schedule generation runs in Term 9: **`0`**.
   - Section plans for Term 9 reset to clean `draft` status (`submitted_by = null`).
   - Verified Program Chair portal view: Shows Step 1 ("Predictive schedule planning & Section Demand Forecasting") with active call-to-action button **`Generate Schedule`**, and **zero generated sections**.

