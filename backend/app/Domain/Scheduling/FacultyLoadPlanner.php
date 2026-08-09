<?php

namespace App\Domain\Scheduling;

/**
 * Deterministic, explainable faculty recommendation ranking.
 *
 * Availability and existing-conflict checks are hard constraints. Among valid
 * candidates, a lower declared subject-preference rank wins. Source-backed
 * prior teaching evidence then breaks ties before the smaller current unit
 * total and stable identifier tie-break.
 */
final class FacultyLoadPlanner
{
    /**
     * @param  list<array{id: int, preference_rank: int, teaching_history_evidence?: int, availability_match: bool, conflict_free: bool, assigned_units: float|int}>  $candidates
     * @return array{professor_id: ?int, rationale: list<string>}
     */
    public function choose(array $candidates): array
    {
        $eligible = array_values(array_filter(
            $candidates,
            fn (array $candidate): bool => $candidate['availability_match'] && $candidate['conflict_free'],
        ));

        if ($eligible === []) {
            return [
                'professor_id' => null,
                'rationale' => ['no_available_preferred_faculty'],
            ];
        }

        usort($eligible, fn (array $left, array $right): int => [
            $left['preference_rank'],
            -((int) ($left['teaching_history_evidence'] ?? 0)),
            (float) $left['assigned_units'],
            $left['id'],
        ] <=> [
            $right['preference_rank'],
            -((int) ($right['teaching_history_evidence'] ?? 0)),
            (float) $right['assigned_units'],
            $right['id'],
        ]);

        $selected = $eligible[0];

        $rationale = ['preference_rank_'.$selected['preference_rank']];
        if (($selected['teaching_history_evidence'] ?? 0) > 0) {
            $rationale[] = 'prior_teaching_evidence';
        }
        $rationale[] = 'availability_match';
        $rationale[] = 'conflict_free';
        $rationale[] = 'load_balanced';

        return ['professor_id' => $selected['id'], 'rationale' => $rationale];
    }
}
