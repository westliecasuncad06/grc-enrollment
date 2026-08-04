# Dean and Executive Enrollment Review Redesign

**Date:** 2026-08-02  
**Status:** Approved for implementation planning  
**Scope:** Frontend presentation and review interaction only

## Purpose

Make submitted Program Chair schedules fast to scan and safe to approve without showing one oversized table. Dean and Executive Director users must be able to review one block section at a time, understand the proposal context, and complete the existing authorized decision workflow.

## Visual direction

Use a refined institutional editorial treatment: GRC red as the decisive action color, restrained gold accents, paper-toned surfaces, Newsreader headings, and IBM Plex Sans for compact operational details. The interface should feel like a formal review docket rather than a spreadsheet.

The redesign must reuse the existing semantic theme tokens and shadcn/ui components. It must not introduce raw color utilities or a separate visual system.

## Review queue

Each proposal appears as a compact review card containing:

- college or department;
- academic term;
- Program Chair submitter;
- current approval status;
- primary `Review schedule` action;
- only the lifecycle actions authorized for the signed-in reviewer.

Dean and Executive Director use the same proposal-card structure. The action labels differ by role and lifecycle stage.

The Executive Director workspace separates `For review` and `Published` content with tabs. Review proposals appear first. Published sections no longer dominate the top of the page.

## Schedule review dialog

The review action opens a responsive dialog capped at 90 percent of the dynamic viewport height. The dialog has three stable regions:

1. A sticky summary header with department, term, submitter, status, number of sections, and number of subjects. Counts appear after the on-demand schedule rows load.
2. A scrollable review body.
3. A sticky action footer.

The body uses section tabs such as `IT101`, `IT102`, and `IT201`. Tabs may scroll horizontally when the proposal has many sections. Only the active section's subjects are rendered as visible review content.

The active section uses a two-column compact card grid on large screens and one column on small screens. Each subject card shows:

- subject code and description;
- units;
- professor;
- day and time;
- room;
- modality.

Missing schedule details use a clear `Not assigned` label rather than an ambiguous dash. Reviewers cannot edit schedule assignments from this dialog.

## Decision actions

The sticky footer keeps the next action visible without requiring the reviewer to scroll to the end of the subjects.

- Dean: `Return with notes` and `Approve schedule`.
- Executive Director: `Return with notes` and `Final approve`.
- Executive Director publication remains a distinct lifecycle action after final approval.

Return opens the existing confirmation dialog with a required `Notes for Program Chair` field. Approval also requires explicit confirmation. Mutations continue to use the existing service module and TanStack Query invalidation.

## State and data flow

The proposal list remains sourced from `useScheduleProposalsQuery`. Schedule details remain loaded on demand through `useScheduleReviewSectionsQuery` only after a proposal is opened.

Inside the review component:

- group returned schedule rows by `section_code`;
- sort section tabs naturally by section code;
- preserve the selected tab while the dialog is open;
- reset the selected tab when another proposal is opened;
- derive summary counts from the loaded schedule rows;
- keep the existing role-based `availableScheduleActions` source of truth.

No API, authorization, lifecycle, or database changes are included in this redesign.

## Loading, empty, and error states

- The proposal queue uses its existing asynchronous boundary.
- The dialog body shows a contained loading state while schedule rows load.
- A proposal with no rows shows a compact empty state inside the dialog.
- A schedule-detail failure remains inside the dialog and provides retry without closing the review.
- A failed decision keeps the dialog or confirmation state understandable and displays the existing plain-language error.

## Responsive and accessibility requirements

- The review dialog must never extend below the visible viewport.
- Header and footer remain visible while only the dialog body scrolls.
- Section tabs are keyboard accessible and have a visible focus state.
- The active tab has a programmatic selected state.
- Subject cards preserve semantic headings and readable source order.
- Decision buttons retain explicit labels; color is not the only status indicator.
- The design must work at 320 CSS pixels without horizontal page overflow.
- Reduced-motion preferences must be respected by existing motion primitives.

## Component boundaries

- `ScheduleDecisionControls`: queue and decision state orchestration.
- `ScheduleReviewDialog`: responsive dialog shell, summary, loading/error boundary, and sticky footer.
- `ScheduleSectionTabs`: grouping, natural ordering, and active-section selection.
- `ScheduleSubjectCard`: compact read-only subject schedule presentation.
- `MasterScheduleWorkspace`: Executive `For review` and `Published` tabs.

These components should remain in the scheduling portal feature area. Shared shadcn primitives remain unchanged unless a confirmed upstream-compatible adjustment is required.

## Tests

Frontend tests must cover:

- section rows grouped into section tabs;
- only the active section is visible;
- tab switching;
- summary counts;
- missing assignments rendered as `Not assigned`;
- Dean action labels;
- Executive action labels;
- required return notes;
- contained loading, empty, error, and retry states;
- Executive `For review` and `Published` tabs;
- dialog viewport constraints through stable class/structure assertions;
- accessibility scan after the schedule dialog loads.

The production build, TypeScript, focused ESLint, and relevant Vitest suites must pass before handoff.

## Out of scope

- Editing Program Chair schedules from reviewer portals.
- New schedule lifecycle states.
- Backend endpoints or schema changes.
- Machine-learning recommendations.
- Google Classroom integration.
- Timetable/calendar visualization.
