# Phase 7c — Factual Dashboards, Dwell-Time Signals, Policy Visibility — Design Specification

**Status:** User-approved design.

## Goal

Connect the 4 of 7 remaining Phase-7c-deferred modules whose content requires
no institutional decision — Dean's Enrollment Dashboard and Stuck Students,
Executive Director's Institution Dashboard, and Registrar Head's Policy
Settings — while leaving the genuinely §17-blocked 3 (`compliance-reports`,
and the shared `reports` id for both Dean and Executive Director) as
documented placeholders.

Grounded in PRD §3.5 (Dean), §3.6 (Executive Director), §3.7 (Registrar
Head), §5.4/FR-ANL-003 (dashboards), and §17 (open institutional decisions).
No institutional rule is invented, per `AGENTS.md`.

## Origin

Phase 7c has been deferred twice, recorded in `PROGRESS.md` as blocked on
"institutional content." A full PRD audit quantifies that blocker precisely:
all seven modules combined get roughly 12 bullet lines of PRD text total.
Specific findings that sharpen the picture:

- The word "stuck" appears **exactly twice** in the entire PRD, both times as
  the bare phrase "stuck-student reports" — no threshold, duration, or status
  set defined anywhere.
- Executive Director's `reports` module has **no PRD basis at all** — §3.6
  has no reports or export bullet; only Dean (§3.5) and Registrar Head (§3.7)
  do.
- `policy-settings` has no settings table, no endpoint, no FR- requirement,
  and no enumerated list of which values are Registrar-editable — §3.7's
  "where the product supports configuration" is never resolved.
- **§17 itself never registers** "what is a stuck student," "what do the
  dashboards show," or "which policy values are configurable" as open
  questions. These were never asked, not merely left unanswered.

## Scope and Decisions

- **4 of 7 modules connected now**, chosen because their content is
  arithmetic over existing, populated, non-nullable columns — not because
  they are "less important," but because building them requires deciding
  nothing. Result: 33 of 40 portal modules connected, up from 29.
- **3 of 7 stay placeholder** (`compliance-reports`; `reports` shared by
  Dean/Executive Director) — §17 explicitly blocks report fields, format,
  naming, and sign-off, and no endpoint or field list exists anywhere in the
  PRD to build against.
- **The factual/judgment split, applied consistently**: every number shown is
  a count of rows or a difference between two existing, populated
  timestamps. Nothing is summed that PRD §17 marks unconfirmed (`payments.amount`
  is never totaled — it is nullable by design). Nothing is grouped by a
  string literal where a PRD-authoritative enum (`EnrollmentStatus`,
  `GradeStatus`) exists to group by instead; seven other enums a dashboard
  would want are explicitly marked *"PROVISIONAL VOCABULARY … replace via
  data migration before production"* in their own docblocks, so those group-
  bys are driven off `Enum::cases()`/`->label()`, never hardcoded strings.
- **`stuck-students` ships with its threshold unset** (`dashboard.stuck_threshold_days`,
  default `null`), following the exact pattern already established for
  `enrollment.max_regular_units` and `enrollment.overload_max_units`. The
  dwell-time *data* (how long each active enrollment has sat in its current
  status) is factual and always shown; the *label* "stuck" only applies once
  an institutional threshold is confirmed. This mirrors
  `PrerequisiteEvaluator` degrading to an explicit `needs_verification`
  advisory rather than guessing.
- **`policy-settings` is read-only.** It reports which policy values are
  configured, which are deliberately unset (mechanism built, value absent —
  same pattern as the two unit caps), and which have no mechanism at all yet
  — linking each unconfirmed one to its §17 line. Making it *writable* would
  require deciding which values are Registrar-editable at runtime, which is
  itself an unmade decision; today configuration is env-var-only.
- **Aggregate-only endpoints, never row-level enrollment access for Dean/
  Executive Director.** `Enrollment::scopeVisibleTo` and
  `EnrollmentPolicy::viewAny()` currently exclude both roles entirely —
  verified directly in code, not assumed. Widening either would hand both
  roles row-level access to every student's enrollment record, which PRD
  §3.6 explicitly constrains ("Cannot alter detailed student academic
  records unless separately authorized") and §9.4 guards generally. The
  dashboards instead get their own endpoints returning counts only, no
  student identity, following the documented precedent of
  `EligibleSubjectPolicy` — "an own computed view, not a stored resource."
  `stuck-students` is the one exception the PRD itself authorizes (§3.5:
  "View the real-time enrollment dashboard and stuck-student *reports*"),
  so it gets a narrower, separate endpoint returning minimal identifying
  data (`student_number`, status, dwell days) behind its own policy — never
  the general enrollment list.

## Public Interfaces

### Config (Task 2)

```php
// config/enrollment.php — new top-level key, same shape as max_regular_units
'dashboard' => [
    // Days an enrollment may dwell in a non-terminal status before a row is
    // flagged in Dean's stuck-students view. Null (default) means no
    // institutional threshold is confirmed — every row still displays its
    // dwell time, but nothing is labeled "stuck". See PRD §17 (silent on
    // this question entirely — never even registered as open).
    'stuck_threshold_days' => env('DASHBOARD_STUCK_THRESHOLD_DAYS'),
],
```

### Backend routes (Task 2, 3)

```
GET /api/v1/dashboards/enrollment-summary   — Dean + Executive Director
GET /api/v1/dashboards/institution-summary  — Executive Director
GET /api/v1/dashboards/policy-settings      — Registrar Head, read-only
GET /api/v1/stuck-enrollments               — Dean only, row-level, minimal fields
```

New Actions return a typed summary object — the **first non-paginator,
non-single-model Action return shape in this codebase** (verified: zero
existing `groupBy`/`selectRaw`/`withCount`/`DB::raw` calls anywhere in
`backend/app/`). This is a deliberate pattern decision, documented in
ADR 0017, not an incidental one.

### Frontend modules (Task 4)

Four new workspace components under
`frontend/src/features/components/portal/`, wired into
`connectedModuleRegistry` for module ids `enrollment-dashboard`,
`institution-dashboard`, `stuck-students`, `policy-settings` — following the
existing `WorkspacePage` + `AsyncBoundary` + `DataTable` conventions and
Phase 8b's design language.

## Non-goals

- `compliance-reports` and `reports` (both Dean's and Executive Director's) —
  genuinely §17-blocked; stay placeholder with a clearer "why" recorded.
- The four Phase-9 modules (`demand-forecast`, `honors`, `kpis`,
  `attrition-analytics`) — ML/prediction-dependent, out of scope before
  Phase 9. One correction for the record: `honors` is **policy**-blocked
  (§17 honors cutoff), not ML-blocked — FR-ANL-006 requires it be
  deterministic, never predicted.
- Making `policy-settings` writable.
- Widening `Enrollment::scopeVisibleTo` or `EnrollmentPolicy` for Dean/
  Executive Director — the aggregate-only endpoint design exists specifically
  to avoid this.
- Phase 8d (§14.4 security, §14.5 performance, §12.6 profile/password/help).
