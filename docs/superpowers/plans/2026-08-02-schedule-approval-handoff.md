# Schedule Approval Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Program Chair submission understandable and complete the Dean/Executive department schedule review, return, remarks, approval, and publication flow.

**Architecture:** Keep the existing section-plan submit endpoint and schedule-proposal lifecycle. Add explicit readiness feedback in the Program Chair workspace, correct return transition rules in the domain/action/request layers, expose a proposal-scoped read-only schedule endpoint, and compose the reviewer experience from existing shadcn Card, Dialog, Table, AlertDialog, Field, and Textarea components.

**Tech Stack:** Laravel 12 REST API, Sanctum, Eloquent/API Resources/Policies, React 19, strict TypeScript, TanStack Query, Zod, Tailwind CSS, shadcn/ui, PHPUnit, Vitest.

## Global Constraints

- Preserve bearer-token authentication and `/api/v1` routes.
- Keep Program Chair data college-scoped and reviewer schedule access read-only.
- Require all professor/day/time/room/modality assignments before submission.
- Require remarks for Dean or Executive returns.
- Do not add Google Classroom or predictive/ML behavior.

---

### Task 1: Program Chair submit readiness

**Files:**
- Modify: `frontend/src/features/components/portal/program-chair-enrollment-workspace.tsx`
- Test: `frontend/src/features/components/portal/program-chair-enrollment-workspace.test.tsx`

- [ ] Add a failing test proving incomplete schedules show a nearby count/message and do not present submission as ready.
- [ ] Add a failing test proving an API submit error is visible beside the approval action.
- [ ] Implement readiness calculation, exact API error display, pending state, and successful confirmation cleanup.
- [ ] Run the focused workspace test.

### Task 2: Correct return transitions and unlock plans

**Files:**
- Create: `backend/app/Domain/Scheduling/ScheduleProposalTransitionRules.php`
- Modify: `backend/app/Actions/Scheduling/TransitionScheduleProposal.php`
- Modify: `backend/app/Http/Requests/Api/V1/ScheduleProposal/UpdateScheduleProposalRequest.php`
- Modify: `backend/app/Actions/Organization/SaveSectionPlan.php`
- Test: `backend/tests/Unit/Domain/Scheduling/ScheduleProposalTransitionRulesTest.php`
- Test: `backend/tests/Feature/Actions/Scheduling/ScheduleProposalAuditTest.php`
- Test: `backend/tests/Feature/Api/V1/ScheduleProposalsEndpointTest.php`

- [ ] Write failing pure-domain tests: Dean can return `draft`; Executive can return `dean_approved`; both require remarks and target `draft`.
- [ ] Centralize transition status rules and use them in request/action validation.
- [ ] On return, reset the proposal's college section plans to `draft` and workflow to `schedule_preparation` so the Program Chair can edit.
- [ ] On resubmit, clear the prior decision metadata; on publish, affect only the proposal college's sections.
- [ ] Run unit tests and the available narrow feature checks.

### Task 3: Proposal-scoped submitted schedule API

**Files:**
- Create: `backend/app/Http/Resources/Api/V1/ScheduleReviewSectionResource.php`
- Modify: `backend/app/Http/Controllers/Api/V1/ScheduleProposalController.php`
- Modify: `backend/app/Http/Resources/Api/V1/ScheduleProposalResource.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Api/V1/ScheduleProposalsEndpointTest.php`

- [ ] Write a failing endpoint test proving reviewers receive only the selected proposal's term and college sections with subject/professor details.
- [ ] Add `GET /api/v1/schedule-proposals/{scheduleProposal}/sections` with proposal authorization and college scoping.
- [ ] Add submitter, college, and term display metadata to proposal resources.
- [ ] Verify resource contracts and authorization.

### Task 4: Dean and Executive review UI

**Files:**
- Modify: `frontend/src/features/schemas/scheduling-schema.ts`
- Modify: `frontend/src/features/services/scheduling-service.ts`
- Modify: `frontend/src/features/hooks/use-scheduling.ts`
- Modify: `frontend/src/features/components/portal/schedule-decision-workspace.tsx`
- Modify: `frontend/src/features/components/portal/master-schedule-workspace.tsx`
- Test: `frontend/src/features/components/portal/schedule-decision-workspace.test.tsx`
- Test: `frontend/src/features/components/portal/master-schedule-workspace.test.tsx`

- [ ] Write failing tests for department/term/Program Chair cards, schedule-detail dialog, and Return with Remarks at each pending checkpoint.
- [ ] Add proposal schedule query/service schemas.
- [ ] Render compact review cards and an on-demand read-only schedule table.
- [ ] Rename return actions and reason field to plain-language Remarks while retaining confirmation and pending guards.
- [ ] Run focused reviewer tests.

### Task 5: End-to-end verification

- [ ] Run frontend focused tests, typecheck, lint, backend unit tests, formatting, and `git diff --check`.
- [ ] Exercise submit/return/approve against local test fixtures when safe, restoring any temporary state.
- [ ] Record exact results and any database-permission limitations in `PROGRESS.md`.
