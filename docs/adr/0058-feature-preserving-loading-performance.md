# ADR 0058: Feature-preserving loading performance

Date: 2026-11-12

Status: Accepted — owner authorized performance work with existing features preserved.

## Context

The free-hosted portal already splits workspaces, caches per-user queries, compresses
API JSON, and eagerly loads section professors. Planning pages still downloaded all
authorized section history and then discarded other terms in the browser. Executive
review also requested history-only reference data before that tab was opened.

## Decision

- Add optional `academic_term_id` filtering to the existing sections GET through a
  Form Request and Action. Keep the unfiltered response and authorization scope.
  Use the existing term-leading unique index; no schema migration is needed.
- Scope planning, schedule, faculty-assignment, and room lists by their selected
  term. Cache each list by user and term, and invalidate the per-user prefix after
  section mutations so both scoped and legacy caches remain correct. Wait for a
  selected term instead of first downloading an unfiltered list. Room details
  reuse their parent's term cache.
- Defer Executive history references and the published-section/calendar panel
  until the History tab opens. Keep the complete published history available.
- Explicitly install OPcache in the existing PHP 8.3 Docker image. Use a 96 MiB
  shared bytecode cache, retain timestamp validation, and disable JIT allocation.
  This caches code only. It does not cache private responses or application data.

## Boundaries and deployment

Authentication, permissions, institutional rules, historical schedule generation,
seat/payment/queue polling, and all existing workflows stay intact. No dependency,
rate-limit store, database-cache configuration, hosting plan, or region changes.

Deploy the backend before the frontend so the optional filter is available first.
Both old callers and a temporarily older backend remain compatible: the browser
keeps its existing term filter as well. Reverting the frontend does not require
reverting the additive backend filter. Removing the OPcache ini and Docker change
restores the prior container behavior; there are no data migrations.

Check the rebuilt container with `php --ri 'Zend OPcache'` and confirm the configured
values before claiming production activation. Inspect worker memory and cache
utilization in the hosting shell; never expose phpinfo or OPcache status publicly.
Render free-service sleep/cold starts remain a hosting constraint.

## Verification

Regression coverage checks exact filtered/unfiltered row equivalence, retained
history, invalid filters, learner/faculty/executive/chair visibility, constant-query
section loading, isolated user/term caches, invalidation, archived-term browsing,
schedule edits, room assignment, publishing, and on-demand history loading.
Record executed checks and their outcomes in [PROGRESS.md](../../PROGRESS.md).

Configuration references: [PHP OPcache runtime settings](https://www.php.net/manual/en/opcache.configuration.php),
[official PHP Docker image](https://hub.docker.com/_/php).
