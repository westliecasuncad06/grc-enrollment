<?php

namespace App\Actions\Dashboard;

use App\Domain\Dashboard\PolicySettingsSummary;
use App\Domain\Dashboard\PolicyValueState;
use App\Domain\Dashboard\PolicyValueStatus;

/**
 * Read-only by design (see PRD §3.7 and the spec's Non-goals): reports which
 * `config('enrollment.*')` policy values are configured, which have a
 * mechanism but no confirmed value, and — for the PRD §17 items with no
 * config key or mechanism at all yet — that absence, with a pointer to the
 * PRD line. Making any of this writable would require first deciding which
 * values are Registrar-editable at runtime, which PRD §3.7's own "where the
 * product supports configuration" leaves unresolved; today configuration is
 * env-var-only with no settings table.
 */
final readonly class BuildPolicySettingsSummary
{
    public function execute(): PolicySettingsSummary
    {
        return new PolicySettingsSummary(values: [
            new PolicyValueState(
                key: 'enrollment.grading.comparison',
                label: 'Grade comparison rule',
                currentValue: config('enrollment.grading.comparison'),
                status: config('enrollment.grading.comparison') === null
                    ? PolicyValueStatus::Unset
                    : PolicyValueStatus::Provisional,
                description: 'Whether a lower or higher recorded grade counts as better on GRC\'s scale. PrerequisiteEvaluator degrades to "needs_verification" rather than guessing when this is null.',
                prdReference: 'PRD §17 — Official passing-grade rule, including special marks and equivalent grades.',
            ),
            new PolicyValueState(
                key: 'enrollment.grading.passing_grade',
                label: 'Passing grade threshold',
                currentValue: config('enrollment.grading.passing_grade'),
                status: PolicyValueStatus::Provisional,
                description: 'Used only to classify a raw recorded grade as passed/failed for excluding completed subjects; per-prerequisite thresholds come from subject_prerequisites.minimum_grade instead.',
                prdReference: 'PRD §17 — Official passing-grade rule, including special marks and equivalent grades.',
            ),
            new PolicyValueState(
                key: 'enrollment.max_regular_units',
                label: 'Maximum regular units',
                currentValue: config('enrollment.max_regular_units') !== null
                    ? (string) config('enrollment.max_regular_units')
                    : null,
                status: config('enrollment.max_regular_units') === null
                    ? PolicyValueStatus::Unset
                    : PolicyValueStatus::Provisional,
                description: 'Null means no cap is enforced. No overload approval workflow exists yet either way.',
                prdReference: 'PRD §17 — Maximum regular units and overload approval workflow.',
            ),
            new PolicyValueState(
                key: 'enrollment.overload_max_units',
                label: 'Overload unit cap',
                currentValue: config('enrollment.overload_max_units') !== null
                    ? (string) config('enrollment.overload_max_units')
                    : null,
                status: config('enrollment.overload_max_units') === null
                    ? PolicyValueStatus::Unset
                    : PolicyValueStatus::Provisional,
                description: 'Null means no cap is enforced.',
                prdReference: 'PRD §17 — Maximum regular units and overload approval workflow.',
            ),
            new PolicyValueState(
                key: 'enrollment.withdrawal.releases_seats',
                label: 'Withdrawal releases the seat',
                currentValue: config('enrollment.withdrawal.releases_seats') ? 'true' : 'false',
                status: PolicyValueStatus::Provisional,
                description: 'Defaulted true to avoid permanently inflating section seat counts; not yet confirmed as institutional policy.',
                prdReference: 'PRD §17 — Enrollment reservation timeout and seat-release rules.',
            ),
            new PolicyValueState(
                key: 'enrollment.dashboard.stuck_threshold_days',
                label: 'Stuck-enrollment dwell threshold (days)',
                currentValue: config('enrollment.dashboard.stuck_threshold_days') !== null
                    ? (string) config('enrollment.dashboard.stuck_threshold_days')
                    : null,
                status: config('enrollment.dashboard.stuck_threshold_days') === null
                    ? PolicyValueStatus::Unset
                    : PolicyValueStatus::Provisional,
                description: 'Null means the Stuck Students view shows every non-terminal enrollment\'s dwell time but flags none as "stuck" — no institutional threshold has ever been confirmed, or even formally asked about.',
                prdReference: 'Not in PRD §17 at all — never registered as an open question, unlike every other row here.',
            ),
            new PolicyValueState(
                key: 'sections.viability_threshold',
                label: 'Section viability threshold',
                currentValue: null,
                status: PolicyValueStatus::NoMechanism,
                description: 'A per-section nullable column, not an institution-wide default. PRD §4.1 documents 25 students as the current informal figure, but §17 still lists this as unconfirmed.',
                prdReference: 'PRD §17 — Section-viability threshold and exception authority.',
            ),
            new PolicyValueState(
                key: 'queue_tickets.policy',
                label: 'Queue-ticket reset, priority, active-serving policy',
                currentValue: null,
                status: PolicyValueStatus::NoMechanism,
                description: 'No reset cadence, priority rule, or single-active-ticket constraint is encoded anywhere in this codebase.',
                prdReference: 'PRD §17 — Queue-ticket reset, priority, active serving-number policy.',
            ),
            new PolicyValueState(
                key: 'payments.required_fields',
                label: 'Payment confirmation required fields',
                currentValue: null,
                status: PolicyValueStatus::NoMechanism,
                description: 'external_reference and amount are both optional at the database and validation layer; no currency or rounding rule is enforced.',
                prdReference: 'PRD §17 — Payment confirmation fields and supporting reference requirements.',
            ),
            new PolicyValueState(
                key: 'academic_grades.honors_rule',
                label: 'Honors cutoff, disqualifying grades, tie handling',
                currentValue: null,
                status: PolicyValueStatus::NoMechanism,
                description: 'FR-ANL-006 requires honors evaluation be deterministic policy, not a prediction — but the policy itself has not been confirmed, so the Honors module stays unbuilt (Phase 9 roadmap slot, policy-blocked not ML-blocked).',
                prdReference: 'PRD §17 — Honors cutoff, disqualifying grades, and tie handling.',
            ),
            new PolicyValueState(
                key: 'compliance_reports.fields',
                label: 'Government compliance report fields, format, sign-off',
                currentValue: null,
                status: PolicyValueStatus::NoMechanism,
                description: 'All four dimensions — fields, file format, naming, sign-off — are explicitly unconfirmed. This is why Compliance Reports and both roles\' Reports modules stay placeholder.',
                prdReference: 'PRD §17 — Government report fields, file format, naming, and sign-off.',
            ),
        ]);
    }
}
