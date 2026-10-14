# CHED / NSTP reports for the Registrar Head — design

Date: 2026-10-14 · Status: approved in chat by the owner (option A), deploy requested right after the build · ADR 0049

## Outcome

The Registrar Head opens a new module, **CHED Reports**, with four tabs. Each tab previews the data for a chosen term and downloads it as **CSV** or **Excel**. The Excel file is the owner's own template with the rows filled in, so the layout, merged cells, print setup and CHED logo are exactly what CHED sent.

| Tab | Template (in `Registrar/`) | One row per | Term scope |
| --- | --- | --- | --- |
| CHED Enrollment List | `template_2024.xlsx` | student officially enrolled in the term | one term |
| NSTP Form 2-B (Enrollment) | `NSTP Form 2-B template (Enrollment).xlsx` | student officially enrolled in an NSTP subject (NSTP 1 or NSTP 2) in the term | one term |
| NSTP Form 2-B (Graduates) | `NSTP Form 2-B template (Graduates).xlsx` | student with a locked, passing NSTP 2 grade in the term | one term |
| NSTP Form 2-A (Summary) | `NSTP Form 2-A template.xlsx` | one row for the HEI: Global Reciprocal Colleges, Private | the school year of the chosen term |

## Rules (what is counted)

- Students flagged `is_demo_account` are never counted (same rule as honors, attrition and the dashboards).
- "Officially enrolled" = `enrollments.status = enrolled` for the term, subjects not `dropped`. A withdrawn or voided student is not listed.
- An NSTP subject is one whose code, upper-cased with spaces removed, matches `^NSTP\d*$` (`NSTP 1`, `NSTP2`, ...). NSTP 2 = normalized code `NSTP2`.
- A graduate row needs a **locked** grade (official) whose mark is passing (`GradeMark::isPassing()`: 1.00 to 3.00, or `C`).
- Form 2-A: only CWTS carries numbers (GRC offers CWTS only); ROTC and LTS are 0. 1st Sem and 2nd Sem enrollment come from the school year's `1st` and `2nd` terms; Summer is 0 (the system has no summer term). Graduates are the distinct students who passed NSTP 2 in either term of the school year. Gender counts are M and F; a student with no gender is counted in neither and shown as a warning.
- Form 2-B Gender column holds `MALE` / `FEMALE` because the template's footer COUNTIFs those words; the CHED Enrollment List uses `M` / `F` as its template asks.
- Serial No. (2-B) is left blank: CHED issues it after the list is submitted (assumption).
- Name Extension and Major are left empty, never "N/A" (template instruction). The middle name column holds the stored middle initial (the system stores no full middle name). Program is written in full: a leading `BS` becomes `Bachelor of Science in`, and `major in X` is split into the Major column.
- Subjects enrolled are `Subject title (units)` joined by `, `; No. of Units is their sum. Year level is the profile's current year level.
- Remarks stay empty (no invented value).
- Sorting: CHED list by program then surname, first name; NSTP lists by surname, first name.

## Data the system did not have (owner option A)

New nullable columns on `student_profiles`: `gender` (`M`/`F`), `birth_date`, `citizenship`, `contact_number`, `street_barangay`, `town_city`, `province`, and `demographics_demo_fields` (JSON: the field names the command filled, so they are recognisable and wipeable).

`php artisan students:populate-demographics` (idempotent, `--dry-run`, `--wipe`):

- fills only NULL fields of non-demo students, never overwrites;
- gender: from the first name (known Filipino given names, then suffix rules; an unknown name falls back deterministically from the profile id, counted separately in the output);
- citizenship `Filipino`; birth date, contact number and the address split are deterministic demo values derived from the profile id and entry year;
- every field it writes is listed in `demographics_demo_fields`; `--wipe` nulls exactly those fields again;
- if the split address is empty the NSTP forms fall back to the free-text `address` for Street/Barangay.

The preview shows a notice with how many listed students carry demo-populated details, because the downloaded files look like real data. Capturing real values in Admission is a follow-up (owner declined option C).

## API (Laravel, `/api/v1`, Sanctum bearer, Registrar Head only)

- `GET /ched-reports/{report}` — preview, `report` in `enrollment-list | nstp-enrollment | nstp-graduates | nstp-summary`, query `academic_term_id`, `page`, `per_page` (not for the summary). Writes an audit row on page 1.
- `GET /ched-reports/{report}/export?format=csv|xlsx&academic_term_id=` — file download (`private, no-store`), audit row `ched_report.exported` with report, term, format and row count (no student data in the audit payload).
- Form Requests validate; `ChedReportPolicy` (Gate `view-ched-reports`) re-checks the role on top of `role:registrar_head`.
- Actions build the rows once; CSV, XLSX and the preview all read the same rows. XLSX is produced with `ZipArchive` by cloning the template's own data-row cell styles, shifting the footer, rewriting the footer COUNTIF ranges (with cached values), dropping `calcChain.xml`, and writing text as inline strings. No new Composer dependency (local PHP has no `gd`, which PhpSpreadsheet requires).

## Frontend

New module `ched-reports` in the Registrar Head's sidebar: term selector, four tabs, preview table (paged) or the 2-A grid, **Download CSV** and **Download Excel** buttons (service module downloads a blob with the bearer token), loading / empty / error states, a warning when students lack gender and a notice for demo-populated details.

## Out of scope

Admission capturing gender, birth date, citizenship, contact number or the address split; ROTC/LTS and Summer data; editing report rows in the UI; Registrar Staff access (Registrar Head only, owner can widen later); storing generated files.
