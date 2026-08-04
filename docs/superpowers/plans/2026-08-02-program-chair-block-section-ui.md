# Program Chair Block Section UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present generated Program Chair sections as school-style block tables (for example IT101 and EDUC102), with year-level filtering and a focused schedule-assignment dialog.

**Architecture:** Keep the existing section-plan release API and generated Section records. Add a reusable program-prefix resolver on the backend so generated `section_code` values persist in the requested block naming format. Replace the Program Chair generated-subject/schedule displays with shadcn Tabs, Table, ToggleGroup, and Dialog compositions; the dialog owns one section's faculty/day/time/room/modality edit.

**Tech Stack:** Laravel 12, React/Next.js strict TypeScript, TanStack Query, Tailwind CSS, shadcn/ui.

## Global Constraints

- Preserve current Registrar-term and active-curriculum filtering.
- Do not add Google Classroom fields or ML calls.
- Program Chair remains college-scoped and submitted plans remain locked.
- Use existing shadcn components and semantic Tailwind tokens.

---

### Task 1: Persist named block sections

**Files:**
- Modify: `backend/app/Actions/Organization/SaveSectionPlan.php`
- Test: `backend/tests/Feature/Actions/Organization/SectionPlanNamingTest.php`

**Interfaces:**
- Produces `section_code` values `IT101`, `IT102`, `IT201`, `EDUC101`, `ACC101`, `FM101`, `EN101`, `MM101`, and `HR101` based on college/program/major and year/block ordinal.

- [ ] Write a failing test that creates one CCS, COE, COA, Finance, Entrepreneurship, Marketing, and HR curriculum and asserts the generated codes.
- [ ] Run the test and confirm that current release still creates `1A`-style codes.
- [ ] Add a private resolver in `SaveSectionPlan` that reads the curriculum program code/name and maps it to IT, EDUC, ACC, FM, EN, MM, or HR; format `<prefix><year level><two-digit block ordinal>`.
- [ ] Run the focused backend test and PHP syntax validation.

### Task 2: Replace generated-section presentation

**Files:**
- Modify: `frontend/src/features/components/portal/program-chair-enrollment-workspace.tsx`
- Test: `frontend/src/features/components/portal/program-chair-enrollment-workspace.test.tsx`

**Interfaces:**
- Consumes the existing `Section` API rows and `section_code` block identifiers.
- Produces year filters (`1st Year` through `4th Year`), table/tile display selection, and grouped block views.

- [ ] Write failing UI tests for unnumbered year labels, year filtering, and a block heading such as `IT101`.
- [ ] Run the focused test and confirm it fails against the old cards.
- [ ] Replace the generated subjects view with year-level Tabs. Group sections by `section_code`; each table includes Subject Code, Description, Units, Sched ID, Day, Time, Room, Faculty, and Modality.
- [ ] Add a Table/Tile ToggleGroup. Both views use the same filtered grouped data.
- [ ] Run the focused UI test, lint, and typecheck.

### Task 3: Move assignment to a dialog

**Files:**
- Modify: `frontend/src/features/components/portal/program-chair-enrollment-workspace.tsx`
- Test: `frontend/src/features/components/portal/program-chair-enrollment-workspace.test.tsx`

**Interfaces:**
- Consumes `openEdit(section)` and saves through existing `replaceSection(section.id, input)`.
- Produces a Dialog titled with the selected block/subject and fields for professor, day, start/end time, room, and modality.

- [ ] Write failing UI tests verifying `Assign schedule` opens a dialog and no Google Classroom input is present.
- [ ] Run the focused UI test and confirm the inline editor does not meet the assertion.
- [ ] Replace the inline edit card with a shadcn Dialog. Retain faculty preference filtering and current conflict-error feedback.
- [ ] Run focused tests, the full portal test suite with no file parallelism, lint, and typecheck.

### Task 4: Verify and document

**Files:**
- Modify: `PROGRESS.md`

- [ ] Run backend unit tests, frontend portal tests, frontend lint/typecheck, OpenAPI lint, and `git diff --check`.
- [ ] Record only the checks that actually passed and any environment-specific failure in `PROGRESS.md`.
