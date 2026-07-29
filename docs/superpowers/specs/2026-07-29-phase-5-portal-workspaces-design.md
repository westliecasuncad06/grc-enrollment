# Phase 5 Portal Workspaces — Design Specification

**Status:** User-approved design; implementation plan pending review.

## Goal

Replace the placeholder portal experience with functional, role-correct Phase 5
workspaces for Admission Staff, Faculty, Program Chair, Dean, Executive
Director, and Registrar Head. Connect the shared portal shell to the active
academic-term context and private notifications. Keep the Next.js
client-rendered bearer-token architecture and defer ML, enrollment, grades,
payments, reports, profile recovery, and help/reporting APIs to their planned
phases.

## Scope and Decisions

- Preserve `/portal/[moduleId]`. A typed module registry maps the current
  role plus module ID to a focused client component; the existing scoped
  not-found behavior remains the fallback.
- Deliver the 13 roadmap Phase 5 modules in incremental role slices, with
  shared client contracts and shell work first. Phase 5 is complete only when
  all slices and their final verification pass.
- Add one backend surface beyond the currently merged routes:
  `GET /api/v1/faculty-members`. It is Program Chair-only, returns active
  faculty ordered by name then ID, and exposes exactly `type`, `id`, `name`,
  `status`, and `status_label`. It never exposes email, credentials, tokens,
  or unrelated user data.
- A successful faculty-directory read is audited in the same transaction with
  `faculty_directory.list_viewed`, auditable type `faculty_directory`, and an
  `after_values` payload containing only `result_count`. Audit failure denies
  the response so a restricted read is never silently unlogged.
- Student provisioning keeps the existing single POST transaction. The
  browser generates a strong temporary password at the start of the workflow,
  submits it once, displays it only in the immediate success receipt with a
  copy control, then clears it when the receipt closes or the page unloads.
  It must never default to `password`; that shared value remains limited to
  local/testing synthetic seed accounts.
- The portal shell displays the active academic term when the caller can see
  one, otherwise a clear unavailable state. Planning and history views retain
  explicit module-level term selectors rather than silently changing the
  shared context.

## Public Interfaces

### Faculty directory

`GET /api/v1/faculty-members`

- Authentication, active-user middleware, throttling, and
  `role:program_chair` apply; a `FacultyMemberPolicy::viewAny()` repeats the
  role check.
- Response is the normal `{ "data": FacultyMember[] }` collection envelope
  with `Cache-Control: no-store, private`.
- `FacultyMember` uses the exact fields above. `status` remains the existing
  provisional identity vocabulary and is displayed, not reinterpreted.
- `401`, `403`, `429`, and unexpected server errors use the existing API error
  envelope. No query parameters or user search are added in this phase.

### Frontend client boundary

- Extend the shared API client with authenticated `PATCH` and `DELETE` calls;
  preserve bearer injection, `credentials: "omit"`, no-store caching, 204
  handling, and the unauthorized-session callback.
- Create strict Zod schemas, service functions, query keys, and mutation hooks
  per domain. Components consume hooks and typed values only; raw `fetch` and
  unparsed response data stay in the service layer.
- Map API `422` field errors to React Hook Form fields. Surface 401, 403, 404,
  409, 429, connection, and contract failures as named, accessible UI states.

## Role Workspaces

| Role | Module behavior |
|---|---|
| Admission Staff | The three existing URLs use one provisioning workspace focused on identity/account details, server-enforced admission status, or temporary credential handoff. The same validated form creates the student user and profile through `POST /student-profiles`. |
| Faculty | Availability Preferences provides full CRUD for availability and ranked subject preferences. Teaching Schedule displays the faculty-visible published/closed sections joined to subjects and academic terms. |
| Program Chair | Curriculum manages curriculum metadata and complete replacements. Subjects & Prerequisites edits the selected curriculum's placements and prerequisite graph. Sections & Schedules creates/edits sections. Faculty Assignment uses the new directory plus availability/preferences and sends the complete section payload. Schedule Proposals creates and tracks a term proposal. |
| Dean | Schedule Approvals lists proposals and exposes only backend-legal Dean actions. Return actions require a reason. |
| Executive Director | Master Schedule combines proposal state and term sections, exposing only backend-legal executive approval, return, and publication actions. |
| Registrar Head | Audit Logs supports server filters, pagination, and expandable safe snapshots. It also exposes the existing `close` action only for published proposals. |

The top-bar notification control becomes an accessible Sheet with unread count,
unread-only filter, pagination, idempotent mark-as-read, retry, and empty/error
states for every signed-in role. Profile, password settings, help, and report
issue remain visibly unavailable because their API contracts do not exist.

## Interaction, Safety, and Accessibility

- Add the project-standard shadcn primitives needed for the above: Table,
  Select, Dialog/AlertDialog, Pagination, and `sonner` for transient
  confirmation. Do not add unrelated component libraries.
- Use responsive tables with alternate stacked cards where columns cannot fit.
  Every action has a text label or accessible name, visible focus, keyboard
  operation, and status text in addition to color.
- Mutations disable duplicate submission, confirm destructive or lifecycle
  actions, show an accessible pending state, invalidate affected query keys,
  and preserve valid form inputs on validation failure.
- The full-replace curriculum editor must always submit the complete current
  subject/prerequisite graph. It must warn before discarding unsaved graph
  edits and never fabricate prerequisite, grade, viability, or institutional
  policy values.

## Verification

- Laravel tests cover the directory policy, active-only/order/exact-resource
  contract, cross-role denial, audit payload privacy, and audit-failure
  behavior. OpenAPI documents the route and schema.
- Frontend tests cover Zod parsing, service methods, bearer PATCH/DELETE,
  notification ownership and read invalidation, generated credential clearing,
  field-error mapping, lifecycle confirmations, module-role isolation, and
  representative loading/empty/error states for each slice.
- Closing commands run the backend suite, Pint, Larastan, Composer audit,
  Redocly lint, and the frontend Vitest, TypeScript, ESLint, Prettier, npm
  audit, and production build gates. Playwright remains Phase 8 work.

## Explicit Non-Goals

- No ML, prediction consumption, demand forecast, attrition UI, grades,
  enrollment submission, payment, withdrawal, COM, honors, reports, or
  compliance-export implementation.
- No cookie/session/CSRF authentication, API proxy, server rendering of
  authorized data, new institutional policy values, password reset flow, or
  persistent frontend storage outside the existing token module.
