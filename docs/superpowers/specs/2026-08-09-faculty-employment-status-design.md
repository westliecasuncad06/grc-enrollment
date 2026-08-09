# Faculty Employment Status Design

## Goal

Give every local faculty account a reportable employment type and account
status, while letting the Program Chair correct either value without changing
faculty teaching-history evidence.

## Data and defaults

- Add a nullable `employment_type` user field with `full_time` and
  `part_time` values. It is local planning metadata, not an HR record.
- Full-time faculty have a 33-unit planning reference. This is a scheduling
  input, not an institutional overload rule.
- The local synchronizer classifies a professor as full-time when workbook
  evidence has at least six distinct curriculum-subject preferences across the
  two semesters; otherwise it uses part-time. Program Chair overrides always
  win.
- Every Faculty-role user receives a unique local `@grc.test` account if one
  is absent. Existing disabled accounts remain inactive instead of being
  reactivated.
- Add twelve deterministic, full-name inactive local faculty records (three
  per supported college) with no teaching evidence. Inactive faculty cannot
  log in or be selected by recommendation logic.

## Program Chair controls

The existing college-scoped Faculty Directory becomes an editable workforce
directory. Program Chairs may update only faculty in their own college:

- account status: active or inactive;
- employment type: full-time or part-time.

The update records before/after values and an optional required reason when an
active faculty member is made inactive. Registrar and faculty accounts cannot
use this endpoint.

## Reporting

`backend/storage/app/local-reports/professor-accounts.md` remains ignored and
local-only. It will list every Faculty-role account by college with email,
active/inactive status, employment type, 33-unit reference for full-time,
desired curriculum subjects, availability windows, teaching-history evidence,
and current assigned units.

## Safety

The report and accounts are synthetic/local-only. No raw workbook is changed
or committed. Inactive accounts preserve audit and teaching data and remain
excluded from automatic assignment.
