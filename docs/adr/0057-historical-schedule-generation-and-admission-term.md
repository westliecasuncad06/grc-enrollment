# ADR 0057: Historical schedule generation and admission during term preparation

Date: 2026-11-12

Status: Accepted by owner instruction

## Context

The owner reported account-creation errors in Admission and slow Generate Schedule, and explicitly directed scheduling to use historical data only, without machine learning.

Admission looked only for a `semester_ongoing` row even though creating the next term selects a `draft` term in the current-term slot. This prevented intake during schedule preparation and could use an older ongoing term. The unrendered entry-year error also hid the actionable cause from Admission.

Schedule generation called the prediction HTTP service once per cohort, including bounded retries, before falling back to the existing historical baseline. Faculty loading also reread identical curriculum references and room catalogs for every block.

## Decision

- Provision accounts against the explicitly selected current term when it is draft, for Dean approval, or ongoing. Only installations with no selected term may fall back to an ongoing term. Refuse a selected closed/archived term, and show missing term/curriculum configuration without partial account creation. Keep privacy acknowledgement, disabled-until-setup accounts, freshman payment gates and atomic queue allocation.
- Calculate schedule demand entirely in Laravel from `derived_from_enrollments` historical aggregates. Use the existing approved historical cohort reference and its latest enrollment rate times current cohort headcount. Keep that history's block count as an advisory draft recommendation. Do not invoke the prediction client, train a model, or fabricate history. Record `historical_baseline` and `section-demand-historical-v1` in the existing run metadata; confidence bounds are null because no statistical interval was estimated.
- Load reusable curriculum references and configured room metadata once per faculty-loading run. Continue querying actual campus-wide room occupancy at placement time, preserving cross-college conflicts and existing assignments.
- Identify historical planning in the UI. Continue to render older stored run strategies accurately. Keep the existing API shape and internal compatibility fields (`prediction_run_id`, `recommendation_source`) to avoid a schema migration solely for terminology.

## Consequences and verification

Generate Schedule no longer waits for prediction-service connection/retry timeouts. Planning still depends on stored historical aggregates and configured faculty/room inputs; missing evidence remains visible for manual review. The independent analytics service is unchanged and independently runnable.

Regression tests cover intake in a selected draft term, selected-term precedence, closed-term refusal, preserved freshman queue/payment behavior, deterministic historical values, zero prediction requests, exclusion of synthetic history, insufficient history and one-time reference/catalog reads across multiple blocks. Existing scheduling authorization, room-conflict and manual-override tests remain applicable. No migration or institutional threshold change is required.
