# Student Inline Section Selection Design

## Goal

Let regular students choose a generated block section directly on the Student
Enrollment page, using an inline schedule table rather than a modal.

## Scope

- The regular-student selection area initially shows only two saved schedule
  preferences: Preferred days and Maximum days on campus.
- Each available block is an inline card with its code, available-seat badge,
  year-level/subject-count context, and a schedule table.
- The schedule table shows Subject code, Description, Units, Section ID, Day,
  Time, and Room. `section_id` is the API's actual identifier; it is not
  relabeled as a schedule ID.
- Selecting a block switches the selection area to that single block, its
  submit action, and a Change section button. Change section returns to the
  full list without a modal.
- The final enrollment confirmation dialog remains, because it confirms the
  irreversible enrollment submission rather than choosing a section.

## Behaviour and boundaries

- This changes only the regular (block-based) student journey. The irregular
  per-subject selection flow is unchanged.
- Preferences remain advisory: a saved preference may rank available blocks
  but must never hide or disable an otherwise selectable block.
- Saving the two visible fields must preserve the existing hidden preference
  values, because the API validates the entire preference document on update.
- Enrollment continues to submit only the selected `block_code`; the backend
  remains the authority that expands and validates the block at submission.
- Existing enrollment-window and seat-availability rules continue to disable
  selection as applicable.

## Visual direction

Use the established GRC editorial crimson-and-gold portal language. Each
section card follows the supplied reference's information hierarchy: block
title and seat count first, a concise block subtitle second, then a compact
full-width schedule table. On narrow screens the existing responsive data-table
card rendering keeps each subject's fields readable.
