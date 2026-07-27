<?php

namespace Database\Seeders;

use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds a small synthetic academic-term catalog for local development and
 * automated tests. This is NOT the real GRC term calendar — the
 * institutional status vocabulary remains unconfirmed under PRD §17 (see
 * App\Domain\Organization\AcademicTermStatus).
 */
final class AcademicTermSeeder extends Seeder
{
    /**
     * @var list<array{school_year: string, semester: string, status: AcademicTermStatus}>
     */
    private const TERMS = [
        ['school_year' => '2025-2026', 'semester' => '2nd', 'status' => AcademicTermStatus::Closed],
        ['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::Active],
        // Deliberately still in planning: proves learner-scoped and planning
        // roles receive different GET /api/v1/academic-terms results.
        ['school_year' => '2027-2028', 'semester' => '1st', 'status' => AcademicTermStatus::Planning],
    ];

    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            foreach (self::TERMS as $term) {
                AcademicTerm::updateOrCreate(
                    ['school_year' => $term['school_year'], 'semester' => $term['semester']],
                    ['status' => $term['status']],
                );
            }
        });
    }

    /**
     * Synthetic reference data must never reach a production-like environment.
     */
    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'AcademicTermSeeder may only run in the local or testing environment. '
                .'Refusing to seed synthetic term data into "'.app()->environment().'".',
            );
        }
    }
}
