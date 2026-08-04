<?php

/**
 * PRD §5.3 process 3.3 requires the system to "compute the approved
 * assessment"; PRD §17 lists "payment confirmation fields and supporting
 * reference requirements" as an open institutional decision, and nothing
 * in this file constitutes that approval. The values below are explicit
 * user direction given during this slice's planning (2026-08-05), not a
 * signed-off GRC decision — every value here is provisional. Update this
 * file, not application code, once GRC formally confirms tuition and fee
 * policy — see PRD §17/§18.
 *
 * `tuition_per_unit` is env-overridable (a single scalar). `miscellaneous`
 * is deliberately NOT env-overridable — a list of {label, amount} rows has
 * no safe flat-string env representation, the same reasoning already
 * applied to `enrollment.grading.special_marks` and
 * `enrollment.grading.completion_only_code_prefixes`. Edit the array
 * directly to change the fee schedule.
 *
 * Rounding policy: half-up at two decimal places. This is also
 * provisional — GRC has never specified half-up vs. banker's rounding vs.
 * round-to-nearest-peso. See App\Domain\Billing\AssessmentComputation.
 */
return [
    'currency' => env('FEES_CURRENCY', 'PHP'),

    'tuition_per_unit' => env('FEES_TUITION_PER_UNIT', '450.00'),

    /**
     * @var list<array{label: string, amount: string}>
     */
    'miscellaneous' => [
        ['label' => 'Registration', 'amount' => '350.00'],
        ['label' => 'Library', 'amount' => '200.00'],
        ['label' => 'Laboratory', 'amount' => '500.00'],
    ],
];
