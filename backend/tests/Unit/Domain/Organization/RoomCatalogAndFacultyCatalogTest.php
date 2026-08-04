<?php

namespace Tests\Unit\Domain\Organization;

use App\Domain\Organization\CatalogFaculty;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\RoomCatalog;
use PHPUnit\Framework\TestCase;

final class RoomCatalogAndFacultyCatalogTest extends TestCase
{
    public function test_room_catalog_only_returns_rooms_available_to_the_requested_college(): void
    {
        self::assertContains('3A', RoomCatalog::forCollege(CollegeCode::Ccs));
        self::assertContains('LAB 1', RoomCatalog::forCollege(CollegeCode::Ccs));
        self::assertNotContains('2A', RoomCatalog::forCollege(CollegeCode::Ccs));
        self::assertNotContains('COM LAB 2', RoomCatalog::forCollege(CollegeCode::Ccs));
        self::assertContains('2A', RoomCatalog::forCollege(CollegeCode::Coa));
    }

    public function test_faculty_catalog_reads_csv_surnames_and_skips_unassigned_rows(): void
    {
        $faculty = CatalogFaculty::fromCsv(
            dirname(__DIR__, 4).'/database/seeders/data/organizations-subjects-prerequisites.csv',
        );

        self::assertContains(['college' => CollegeCode::Ccs, 'surname' => 'ANGAC', 'subject_code' => 'ADET'], $faculty);
        self::assertNotContains(['college' => CollegeCode::Cbae, 'surname' => 'UNASSIGNED', 'subject_code' => 'BANFIN'], $faculty);
    }
}
