<?php

namespace App\Domain\Organization;

/**
 * Approved room availability used to populate the local scheduling catalog.
 * A room is represented once for every college that may schedule it.
 */
final class RoomCatalog
{
    /**
     * @return list<array{name: string, college: CollegeCode}>
     */
    public static function all(): array
    {
        $rows = [
            ['2A', ['cbae', 'coa']], ['3A', ['ccs', 'coe', 'coa']], ['3B', ['ccs', 'coe', 'coa']], ['3C', ['coe', 'coa']],
            ['3D', ['cbae', 'coe', 'coa']], ['3E', ['cbae', 'coe', 'coa']], ['3F', ['cbae', 'coe', 'coa']],
            ['3G', ['cbae', 'coe', 'coa']], ['3H', ['cbae', 'coe', 'coa']], ['4A', ['cbae', 'coe', 'coa']],
            ['4B', ['cbae', 'coe', 'coa']], ['4C', ['coe', 'coa']], ['4D', ['cbae', 'coe']],
            ['4E', ['cbae', 'coe', 'coa']], ['4F', ['cbae', 'coe']], ['4G', ['cbae', 'coe']],
            ['4H', ['cbae', 'coe']], ['5A', ['cbae', 'ccs', 'coe', 'coa']], ['5B', ['cbae', 'ccs', 'coe', 'coa']],
            ['5C', ['coe', 'coa']], ['5D', ['cbae', 'coe', 'coa']], ['5E', ['cbae', 'ccs', 'coe', 'coa']],
            ['5F', ['cbae', 'ccs', 'coe', 'coa']], ['5G', ['cbae', 'ccs', 'coe', 'coa']], ['5H', ['ccs', 'coe']],
            ['COM LAB 2', ['cbae']], ['COM LAB 3', ['cbae']], ['COM LAB 4', ['cbae']],
            ['LAB 1', ['ccs']], ['LAB 2', ['ccs']], ['LAB 3', ['ccs']], ['LAB 4', ['ccs']],
            ['EDTECH ROOM', ['coe']], ['PE ROOM', ['cbae', 'ccs', 'coe', 'coa']], ['PE ROOM 2', ['coe']],
            ['ROOM 1', ['cbae', 'coe']], ['SCI LAB', ['cbae', 'coe', 'coa']],
            ['STUDY HALL', ['cbae', 'coe', 'coa']], ['TESDA HALL', ['ccs']],
        ];

        $catalog = [];
        foreach ($rows as [$name, $colleges]) {
            foreach ($colleges as $college) {
                $catalog[] = ['name' => $name, 'college' => CollegeCode::from($college)];
            }
        }

        return $catalog;
    }

    /**
     * @return list<string>
     */
    public static function forCollege(CollegeCode $college): array
    {
        return array_values(array_map(
            static fn (array $room): string => $room['name'],
            array_filter(self::all(), static fn (array $room): bool => $room['college'] === $college),
        ));
    }
}
