# Professor Directory Source Design

## Goal

Use `Subject And Prerequisuite/Professor_Department_List.md` as the local
canonical source for professor accounts and for its own password-free account
directory.

## Design

- Parse the 145 Markdown table rows without committing or copying the source
  list into the application data directory.
- Upsert one deterministic local `@grc.test` Faculty account for each listed
  person. Accounts use the existing shared local password and are Active.
- Keep COE, CCS, CBAE, and COA accounts scoped to their listed college.
  Preserve Coaches and Unidentified as Active, unscoped Faculty accounts
  rather than guessing a college.
- Use `WorkbookFacultyProfileName` to give title-only or surname-only source
  entries a deterministic full local display name. The source Markdown shows
  that resolved account name, its email, and its original department label.
- Make every existing Faculty account Active in this local synchronization;
  employment type remains unchanged.
- Rewrite only the requested Markdown list as `Professor Name | Email |
  Department`, with no password or other columns.

## Safety and verification

- The source and generated account report remain local/untracked.
- The synchronization is local/testing-only and idempotent.
- Tests use a small temporary Markdown fixture to prove account creation,
  college scoping, unscoped department handling, activation, and directory
  rewrite behavior.
