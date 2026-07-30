<?php

/**
 * PRD §17 lists the official passing-grade rule (including special marks and
 * equivalent grades) and the maximum regular-unit/overload approval workflow
 * as open institutional decisions requiring formal GRC approval. Nothing in
 * this file constitutes that approval.
 *
 * The grading values below are explicit user direction given during Phase 6
 * planning (2026-07-30), not yet a signed-off GRC decision: 3.00 is the
 * lowest passing mark on GRC's descending numeric scale (1.00 highest —
 * 5.00 failed), and INC ("Incomplete") / NC ("Not Complete") are recognised
 * special marks, notably on Leadership subjects. They are pre-populated here
 * so the system is demonstrable end to end, but every value is
 * environment-overridable, and — critically —
 * App\Domain\Academic\PrerequisiteEvaluator degrades to an explicit
 * "needs_verification" advisory, never a silent pass or fail, whenever
 * `grading.comparison` resolves to null. Update this file, not application
 * code, once GRC formally confirms the policy — see PRD §17/§18.
 */
return [
    'grading' => [
        // 'lower_is_better' (GRC's 1.00-5.00 scale) or 'higher_is_better'.
        // Null disables automatic comparison entirely.
        'comparison' => env('ENROLLMENT_GRADE_COMPARISON', 'lower_is_better'),

        // Used only to classify a *raw* recorded grade as passed/failed for
        // FR-ENR-003's "exclude completed subjects" check. Per-prerequisite
        // thresholds come from subject_prerequisites.minimum_grade instead,
        // set by the Program Chair per curriculum edge.
        'passing_grade' => env('ENROLLMENT_PASSING_GRADE', '3.00'),
        'failing_grade' => env('ENROLLMENT_FAILING_GRADE', '5.00'),

        // Grades that are neither numeric passes nor fails. Never treated as
        // satisfying a prerequisite.
        'special_marks' => ['INC', 'NC'],
    ],

    // FR-ENR-004: maximum regular units and the overload approval workflow.
    // Null means "no cap enforced" — informational only until GRC sets a
    // value, the same mechanism-implemented/value-flagged pattern already
    // used for sections.viability_threshold (see ADR history, Phase 2).
    'max_regular_units' => env('ENROLLMENT_MAX_REGULAR_UNITS'),
    'overload_max_units' => env('ENROLLMENT_OVERLOAD_MAX_UNITS'),

    // FR-FIN-004 / PRD §17: "Enrollment reservation timeout and seat-release
    // rules" is an open institutional decision — seats have been reserved
    // immediately and permanently on submission since Phase 6. Defaulting
    // this to true (rather than leaving it unenforced like the caps above)
    // is a deliberate choice: leaving it off would permanently inflate
    // `sections.enrolled_count` for every approved withdrawal, wrongly
    // blocking other students from an actually-open section. Idempotency
    // (never decrementing a section more than once per withdrawal) is
    // enforced unconditionally in App\Actions\Enrollment\TransitionWithdrawalRequest,
    // independent of this flag — only whether the release happens at all is
    // gated here.
    'withdrawal' => [
        'releases_seats' => (bool) env('ENROLLMENT_WITHDRAWAL_RELEASES_SEATS', true),
    ],
];
