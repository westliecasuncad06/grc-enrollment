# Task 6 Report — Program Chair curriculum and prerequisites

## Contract

- `POST /api/v1/curricula` accepts `program_id`, metadata, and the complete
  subject/prerequisite graph.
- `PATCH /api/v1/curricula/{id}` accepts the same metadata and graph, but not
  immutable `program_id`.
- The backend remains authoritative for Program Chair authorization and final
  prerequisite-cycle validation.

## TDD Evidence

Initial RED was observed with the required command. It exited non-zero because
`curriculum-service`, `curriculum-workspace`, and `prerequisite-editor` did
not exist. The review-remediation RED then reproduced all four findings:
non-strict response envelope parsing, missing subject/placement controls,
silent dirty selection reset, and duplicate POST after create. An additional
selector-to-New reset regression was corrected. GREEN focused result: 4 files
/ 15 tests.

## Verification

- Full frontend suite: 29 files / 191 tests.
- Prettier, ESLint, Oxlint, TypeScript, production build, and `git diff
  --check` completed successfully.

## Scope and next task

Published completion remains 41% because the isolated work is not merged.
Independent re-review of the Task 6 remediation is pending; Task 7 must wait
for acceptance.
