# Room Sync and Editable Predictive Schedule Design

## Goal and confirmed decisions

This slice makes the Program Chair's **Generate Schedule** action operational
for every supported college, turns the generated recommendation into an
editable draft, and adds a consolidated Rooms workspace for real-time room
availability and scheduling conflicts.

Confirmed product decisions:

- The demand model remains **Random Forest only**. The UI must expose the
  actual strategy used (`random_forest` or the sparse-data
  `historical_baseline` fallback), model version, observation count, and
  validation metrics so “working ML” is verifiable rather than implied.
- Rooms navigation is available to Program Chairs and the **Registrar Head
  only**. Registrar Staff does not receive access.
- The Registrar Head owns room inventory creation, editing, activation, room
  type, capacity, equipment, and college access. Program Chairs can view
  authorized rooms, inspect availability, assign rooms to their college's
  draft schedules, and edit generated schedule assignments.
- Supported modalities are Face-to-Face, HyFlex A, and HyFlex B. Online-only
  is removed from creation and editing. Existing local `online` rows are reset
  to pending modality and room reassignment rather than silently converted.
- HyFlex A is online in week 1 and face-to-face in week 2; HyFlex B is
  face-to-face in week 1 and online in week 2, alternating thereafter. A and B
  may share the same room/day/time only when linked by an explicit pairing
  record; otherwise normal room-conflict rules apply.
- Forecasts, section counts, teacher assignments, and room assignments remain
  advisory draft data. The Program Chair may edit them, and the existing
  Dean/Executive approval workflow remains authoritative.

## Architecture and data model

### Predictive generation

Repair the existing private API boundary so Laravel and FastAPI use one
versioned schema. Each target includes a stable key, cohort size, current
section count, recommended capacity, year level, and semester. Observations
contain aggregate cohort/enrollment/capacity fields only—never student
identifiers. With four or more usable observations the service fits a
deterministic `RandomForestRegressor`; fewer observations use the latest
historical aggregate as a clearly labelled fallback. Empty observations do
not call the model and return a visible insufficient-data warning.

`ScheduleGenerationRun` becomes the orchestration record. One idempotency key
per actor/term/request prevents duplicate active work while an explicit
**Regenerate recommendations** action creates a new run. A run stores its
model strategy, observation count, metrics, warnings, and terminal state.
Failure leaves the last successful editable draft intact.

Successful forecasts are converted into draft section plans and subject
sections. Recommended block count is the maximum required subject section
count for the curriculum/year; excess subject demand creates additional
subject-only sections. Existing manually edited capacity, section count,
faculty, time, room, and modality values are preserved during regeneration.
The user may explicitly reset an individual field or the whole draft to the
latest recommendation.

### Faculty loading

Teacher recommendation is deterministic decision support, not a second ML
model. Candidates are ranked by:

1. subject preference/expertise rank for the target term;
2. complete availability coverage for the proposed day/time;
3. remaining units under the term-specific maximum load;
4. stable teacher ID as the final tie-breaker.

The generator may propose a teacher but never publishes the assignment.
Assignments that lack a qualified or available candidate remain visibly
unassigned. A Teacher Load Report groups assigned subjects and total units per
teacher and includes a rationale (`preference #`, availability match,
historical fallback) plus conflicts and unfilled load needs.

### Room inventory and occupancy

Replace duplicated college/name options with a canonical room record and
college-access relation. A room stores code/name, building/floor, capacity,
type (`lecture`, `computer_lab`, `science_lab`, `multipurpose`), active status,
and equipment flags including computers and air-conditioning. A room can be
available to more than one college without becoming multiple physical rooms.

Sections reference `room_id`; the old room string remains temporarily readable
only during migration and is then backfilled through normalized room aliases.
Unknown legacy labels remain pending for Registrar Head review rather than
creating guessed rooms. Subject room requirements are inferred from the
historical curriculum schedule reference: a historical lab room requires a
compatible lab, otherwise lecture is the default. The generated draft exposes
the inferred requirement and permits an explicit Program Chair override with a
recorded rationale.

An explicit HyFlex pairing record links one A section and one B section for the
same term, room, day, and time. The room occupancy engine models odd/even
face-to-face weeks. F2F occupies every week; HyFlex A occupies even weeks;
HyFlex B occupies odd weeks. Two sections conflict when their term, parsed day,
time interval, room, and physical-week pattern overlap. Teacher conflicts still
apply every scheduled teaching week because online teaching also consumes the
teacher's time.

## Interfaces and user experience

### Program Chair Enrollment

The first panel contains one primary **Generate Schedule** action plus the
latest-run status. Once complete it switches directly to result tabs:

- **Demand & Sections:** subject demand, confidence interval, recommended and
  current editable section counts/capacities, base blocks, extra sections, and
  data sufficiency.
- **Schedule:** editable section table/cards for teacher, day/time, modality,
  HyFlex pair, room, and capacity; conflicts update immediately after saves.
- **Faculty Load:** teacher, assigned subjects, total/max/remaining units,
  rationale, availability gaps, and conflicts.
- **Review & Approval:** unresolved warnings, manual-override markers, reset
  actions, and the existing submit/approval controls.

The old 1st–4th Year manual wizard is no longer the entry point. Its controls
are retained as editable result fields inside Demand & Sections.

### Rooms Operations Board

Add a connected `rooms` module to Program Chair and Registrar Head navigation.
The dashboard shows current available/in-use/conflict counts, filters for term,
day, time, college, capacity, type and equipment, a room-by-time availability
grid, scheduled classes, HyFlex A/B paired occupancy, and a needs-attention
panel for double bookings, capacity mismatch, incompatible room type, inactive
rooms, and incomplete assignments.

Program Chair results are college-scoped and expose assignment actions only.
Registrar Head sees the institution-wide board and room inventory management
dialog. All room writes use Policies, Form Requests, API Resources,
transactions, audit logs, and `/api/v1` routes.

Public API additions:

- `GET /api/v1/rooms` and `GET /api/v1/rooms/availability`
- Registrar Head: `POST /api/v1/rooms`, `PATCH /api/v1/rooms/{room}`
- `GET /api/v1/academic-terms/{term}/schedule-generation-runs/latest`
- `GET /api/v1/schedule-generation-runs/{run}/results`
- `POST /api/v1/academic-terms/{term}/schedule-generation-runs` with an
  idempotency key and explicit regeneration/reset mode
- `PATCH /api/v1/sections/{section}` extended with `room_id` and optional
  HyFlex pair input; the server remains authoritative for all conflicts

## Failure handling and compatibility

- Apply the two currently pending predictive migrations before testing the COE
  generation endpoint. Deployment must run migrations before exposing the new
  frontend action.
- If FastAPI is unreachable, schema-invalid, or times out, mark the new run
  failed, retain the last successful draft, and show a retryable diagnostic.
- Start the ML service as an independently runnable process and add a backend
  readiness check; the browser never calls port 8100 directly.
- Existing `online` local rows become incomplete drafts (`modality = null`,
  `room_id = null`) and appear in Needs Attention. Published production data
  must not be destructively rewritten without an approved data review.
- Room and faculty conflicts block schedule submission but not draft editing.
  Forecast uncertainty and low demand remain advisory and never deny student
  enrollment or dissolve sections automatically.

## Verification and acceptance

- Reproduce the current COE 500 error before migration, then verify generation
  for CCS, COE, COA, and CBAE after migration and seeding.
- Contract tests prove Laravel payloads are accepted by FastAPI and that the
  persisted model strategy/metrics match the response.
- ML tests cover deterministic Random Forest output, sparse fallback, empty
  history, nonnegative bounds, and MAE/RMSE calculation on a held-out aggregate
  validation set.
- Generation tests cover idempotency, explicit regeneration, multiple
  curriculum versions, cohort rules, base and extra sections, manual override
  preservation/reset, ML failure rollback, and cross-college authorization.
- Faculty tests cover preference-first ranking, availability, max units,
  unassigned sections, rationale, and load totals.
- Room tests cover capacity/type/equipment matching, canonical multi-college
  access, F2F collisions, allowed explicit HyFlex A/B sharing, forbidden
  unpaired sharing, teacher conflicts across all modalities, and inactive
  rooms.
- Frontend tests cover role navigation, Registrar Head-only inventory writes,
  editable generated results, conflict presentation, responsive room grids,
  keyboard access, dialogs, and removal of Online-only choices.
- Fresh focused backend/frontend/ML suites, full applicable suites, typecheck,
  lint, formatting, and build must pass before the implementation commit and
  push.
