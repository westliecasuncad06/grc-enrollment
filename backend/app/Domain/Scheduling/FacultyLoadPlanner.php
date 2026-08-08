<?php

namespace App\Domain\Scheduling;

/**
 * Deterministic, explainable faculty recommendation ranking.
 *
 * Availability and existing-conflict checks are hard constraints. Among valid
 * candidates, a lower declared subject-preference rank wins, then the smaller
 * current unit total, then a stable identifier tie-break.
 */
final class FacultyLoadPlanner
{
    /**
     * @param  list<array{id: int, preference_rank: int, availability_match: bool, conflict_free: bool, assigned_units: float|int}>  $candidates
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
            (float) $left['assigned_units'],
            $left['id'],
        ] <=> [
            $right['preference_rank'],
            (float) $right['assigned_units'],
            $right['id'],
        ]);

        $selected = $eligible[0];

        return [
            'professor_id' => $selected['id'],
            'rationale' => [
                'preference_rank_'.$selected['preference_rank'],
                'availability_match',
                'conflict_free',
                'load_balanced',
            ],
        ];
    }
}
