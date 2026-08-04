<?php

namespace Database\Seeders;

use App\Domain\Organization\RoomCatalog;
use App\Models\RoomCatalogEntry;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/** Local/test-only college-scoped room options for manual schedule assignment. */
final class RoomCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            foreach (RoomCatalog::all() as $room) {
                RoomCatalogEntry::updateOrCreate(
                    ['name' => $room['name'], 'college' => $room['college']->value],
                );
            }
        });
    }

    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('RoomCatalogSeeder may only run locally or in testing.');
        }
    }
}
