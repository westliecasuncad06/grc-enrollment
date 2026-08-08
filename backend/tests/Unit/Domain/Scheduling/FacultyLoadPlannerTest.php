<?php

namespace Tests\Unit\Domain\Scheduling;

use App\Domain\Scheduling\FacultyLoadPlanner;
use PHPUnit\Framework\TestCase;

final class FacultyLoadPlannerTest extends TestCase
{
    public function test_it_prefers_ranked_subject_expertise_then_balances_existing_units_between_available_faculty(): void
    {
        $result = (new FacultyLoadPlanner)->choose([
            ['id' => 10, 'preference_rank' => 2, 'availability_match' => true, 'conflict_free' => true, 'assigned_units' => 0],
            ['id' => 11, 'preference_rank' => 1, 'availability_match' => true, 'conflict_free' => true, 'assigned_units' => 9],
            ['id' => 12, 'preference_rank' => 1, 'availability_match' => true, 'conflict_free' => true, 'assigned_units' => 3],
            ['id' => 13, 'preference_rank' => 1, 'availability_match' => false, 'conflict_free' => true, 'assigned_units' => 0],
        ]);

        self::assertSame(12, $result['professor_id']);
        self::assertSame('preference_rank_1', $result['rationale'][0]);
        self::assertContains('availability_match', $result['rationale']);
    }

    public function test_it_reports_no_recommendation_when_every_matching_faculty_member_is_unavailable_or_conflicted(): void
    {
        $result = (new FacultyLoadPlanner)->choose([
            ['id' => 10, 'preference_rank' => 1, 'availability_match' => false, 'conflict_free' => true, 'assigned_units' => 0],
            ['id' => 11, 'preference_rank' => 2, 'availability_match' => true, 'conflict_free' => false, 'assigned_units' => 0],
        ]);

        self::assertNull($result['professor_id']);
        self::assertSame(['no_available_preferred_faculty'], $result['rationale']);
    }
}
