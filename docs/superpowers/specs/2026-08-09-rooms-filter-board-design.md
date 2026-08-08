# Rooms Filter Board Design

## Goal

Make the Rooms Operations Board faster to scan by adding filters for room
name, availability, teaching modality, and schedule day while preserving the
existing Program Chair college scope and Registrar Head system-wide view.

## Approved interaction design

- A compact filter toolbar sits above the room table.
- Search matches a room name case-insensitively.
- Availability filters are `All`, `Available`, and `Scheduled`; availability
  is derived from active-term sections that have both a room and day.
- Modality filters are `All modalities`, `F2F`, `HyFlex A`, and `HyFlex B`.
- Day filters are `All days`, `M`, `T`, `W`, `Th`, `F`, and `Sat`.
- A Clear filters control appears only when any non-default filter is active.
- Summary cards react to the filtered board and show active rooms, scheduled
  classes, and the caller's role-specific access context.
- The room table includes room name, number of scheduled classes, an
  availability badge, and a concise next-use summary. The scheduled-use list
  follows the same active modality and day filters.

## Data and boundaries

- The change uses the existing room-options endpoint and active-term section
  query; it introduces no new API request or room mutation.
- Program Chairs continue receiving college-scoped room options from Laravel.
- Registrar Heads continue receiving the system-wide room-option list.
- Existing legacy Online-only rows remain excluded from selectable modality
  filters; an unset modality displays as `Needs reassignment` in scheduled
  use.

## Accessibility and responsive behavior

- Every filter has a visible label and a keyboard-accessible native shadcn
  select or text input.
- Filter result counts use text, not color alone.
- The toolbar wraps cleanly on narrow displays and the table remains in its
  existing horizontal-scroll container.
- Empty filtered results provide a clear message and reset action.

## Verification

- Component tests cover room-name search, availability, day and modality
  filtering, the no-results state, and clear-filters reset behavior.
- The focused Room Board test and the frontend fast lint check must pass.
