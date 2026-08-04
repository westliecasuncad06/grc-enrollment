<?php

namespace Database\Seeders;

use App\Domain\Enrollment\EnrollmentAudience;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\AcademicTermEnrollmentWindow;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds eight terms spanning 2023-2024 through 2026-2027, with 2026-2027
 * 2nd semester left `semester_ongoing` — the one current term a clean seed
 * leaves behind, matching the explicit "2026-2027 as the current/ongoing
 * term" requirement this grading/enrollment-completion slice was built
 * against.
 *
 * 2026-2027 1st is `semester_closed` rather than archived specifically so
 * `DemoEnrollmentSeeder`'s year-4 roster (7 completed semesters) has a real,
 * still-visible closed term to record its most recent locked grades against
 * — archiving it would still work functionally (nothing reads the
 * distinction for grade history), but "closed, not yet archived" is the
 * more realistic state for a term whose grades were only just finalized.
 *
 * The real `academic_term_current_slots` single-current-term invariant
 * (enforced by `CreateAcademicTerm`) only tracks ONE non-archived term at a
 * time in the live transition flow (Draft → ... → SemesterClosed →
 * Archived); this seeder inserts two non-archived terms directly, which the
 * app's own UI could never reach through its transition actions. That is
 * fine for synthetic seed data — the slot itself is pointed at 2026-2027
 * 2nd (the actually-current term), so `CreateAcademicTerm` still correctly
 * refuses a new term while it is active, and 2026-2027 1st simply sits as
 * ordinary historical data no live transition will ever touch again.
 *
 * Unlike the seeder's previous shape, no Draft term or college-workflow
 * bootstrap is seeded here: sections for the ongoing term are supplied
 * directly by `SectionSeeder`, bypassing the schedule-proposal pipeline
 * entirely, and `ProgramChairScheduleSampleSeeder` (which runs later in
 * `DatabaseSeeder`) creates its own workflow/proposal rows for whatever
 * current term it finds. A Registrar Head can still create a fresh Draft
 * term for testing that pipeline through the ordinary archive-and-create-next
 * flow at any time.
 */
final class AcademicTermSeeder extends Seeder
{
    private const CURRENT_SCHOOL_YEAR = '2026-2027';

    private const CURRENT_SEMESTER = '2nd';

    /**
     * @var list<array{school_year: string, semester: string, status: AcademicTermStatus}>
     */
    private const TERMS = [
        ['school_year' => '2023-2024', 'semester' => '1st', 'status' => AcademicTermStatus::Archived],
        ['school_year' => '2023-2024', 'semester' => '2nd', 'status' => AcademicTermStatus::Archived],
        ['school_year' => '2024-2025', 'semester' => '1st', 'status' => AcademicTermStatus::Archived],
        ['school_year' => '2024-2025', 'semester' => '2nd', 'status' => AcademicTermStatus::Archived],
        ['school_year' => '2025-2026', 'semester' => '1st', 'status' => AcademicTermStatus::Archived],
        ['school_year' => '2025-2026', 'semester' => '2nd', 'status' => AcademicTermStatus::Archived],
        ['school_year' => self::CURRENT_SCHOOL_YEAR, 'semester' => '1st', 'status' => AcademicTermStatus::SemesterClosed],
        // The one actionable current term a clean seed leaves behind, with
        // its enrollment window already open — every DemoEnrollmentSeeder
        // student can submit a real fresh enrollment against it immediately.
        ['school_year' => self::CURRENT_SCHOOL_YEAR, 'semester' => self::CURRENT_SEMESTER, 'status' => AcademicTermStatus::SemesterOngoing],
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

            // Keep the local archive deterministic without deleting any term
            // records. Older WIP rows are retained as archived history so a
            // fresh manual-test run cannot accidentally expose a stale
            // current semester.
            $pairs = collect(self::TERMS)
                ->map(fn (array $term): string => "{$term['school_year']}|{$term['semester']}")
                ->all();
            AcademicTerm::query()
                ->get()
                ->filter(fn (AcademicTerm $term): bool => ! in_array(
                    "{$term->school_year}|{$term->semester}",
                    $pairs,
                    true,
                ))
                ->each(function (AcademicTerm $term): void {
                    $term->update([
                        'status' => AcademicTermStatus::Archived,
                        'closed_at' => $term->closed_at ?? now(),
                        'archived_at' => $term->archived_at ?? now(),
                    ]);
                });

            $currentTerm = AcademicTerm::query()
                ->where('school_year', self::CURRENT_SCHOOL_YEAR)
                ->where('semester', self::CURRENT_SEMESTER)
                ->sole();

            $currentTerm->update([
                'enrollment_opens_at' => now()->subDays(3)->setTime(8, 0),
                'enrollment_closes_at' => now()->addDays(11)->setTime(23, 59),
                'add_drop_deadline_at' => now()->addDays(25)->setTime(23, 59),
            ]);

            DB::table('academic_term_current_slots')
                ->where('id', 1)
                ->update(['academic_term_id' => $currentTerm->id, 'updated_at' => now()]);

            $this->seedOpenWindows($currentTerm);
        });
    }

    /**
     * Every audience opens together, right now — unlike the old staggered
     * demo (which delayed later year levels by weeks to showcase the
     * stagger), every DemoEnrollmentSeeder student across all four year
     * levels plus the irregular audience needs to be immediately enrollable
     * so "test enrolling as them" (the explicit ask this seed exists for)
     * works the moment the seed finishes.
     */
    private function seedOpenWindows(AcademicTerm $currentTerm): void
    {
        foreach (EnrollmentAudience::cases() as $audience) {
            AcademicTermEnrollmentWindow::updateOrCreate(
                ['academic_term_id' => $currentTerm->id, 'audience' => $audience],
                [
                    'opens_at' => $currentTerm->enrollment_opens_at,
                    'closes_at' => $currentTerm->enrollment_closes_at,
                ],
            );
        }
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
