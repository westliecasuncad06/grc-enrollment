<?php

namespace Tests\Feature\Database;

use App\Models\QueueCycle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

final class QueueCycleMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_queue_cycles_table_has_the_expected_columns(): void
    {
        self::assertTrue(Schema::hasColumns('queue_cycles', [
            'id', 'opened_on', 'last_claimed_on', 'last_ticket_sequence',
            'cut_off_at', 'cut_off_service_date', 'cut_off_by', 'closed_at',
            'open_marker', 'created_at', 'updated_at',
        ]));
    }

    public function test_queue_tickets_gained_the_cycle_columns(): void
    {
        self::assertTrue(Schema::hasColumns('queue_tickets', ['queue_cycle_id', 'ticket_sequence']));
    }

    public function test_only_one_open_cycle_is_allowed_at_a_time(): void
    {
        QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 0]);

        $this->expectException(\Illuminate\Database\QueryException::class);

        QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 0]);
    }

    public function test_a_closed_cycle_does_not_collide_with_a_new_open_one(): void
    {
        QueueCycle::create([
            'opened_on' => '2026-08-20', 'last_ticket_sequence' => 5, 'closed_at' => now(),
        ]);

        $secondCycle = QueueCycle::create(['opened_on' => '2026-08-23', 'last_ticket_sequence' => 0]);

        self::assertNull($secondCycle->closed_at);
        self::assertSame(2, QueueCycle::query()->count());
    }
}
