<?php

namespace Database\Seeders;

use App\Domain\Identity\UserRole;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicTerm;
use App\Models\Section;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds synthetic published sections for the active academic term so the
 * scheduling and enrollment portals have real rows to render.
 *
 * The active term is always a '2nd' semester (see AcademicTermSeeder) — every
 * DemoEnrollmentSeeder student has locked grade history through their year's
 * 1st-semester ordinal and is meant to freely enroll fresh into this term, so
 * every subject below is each year level's own 2nd-semester placement in
 * "BSCS Curriculum 2026" (see CurriculumSeeder), not a repeat of the year-1
 * 1st-semester set. The original year-1 1st-semester sections (CS101 etc.)
 * are kept too: harmless leftover offerings a student has already completed
 * by the time they reach this term, matching how a real registrar's catalog
 * still lists prior-semester sections for retakes.
 *
 * NOTE ON `viability_threshold`: it is deliberately left NULL. PRD §4.1
 * mentions 25 students as the currently documented figure, but §17 lists the
 * section-viability threshold and its exception authority as an open GRC
 * decision. Seeding a number here would turn an unapproved figure into data
 * that later code might treat as authoritative.
 *
 * Depends on SubjectSeeder, AcademicTermSeeder, and RoleUserSeeder.
 */
final class SectionSeeder extends Seeder
{
    /**
     * @var list<array{
     *     subject: string, code: string, days: string,
     *     starts: string, ends: string, room: string, capacity: int
     * }>
     */
    private const SECTIONS = [
        ['subject' => 'CS101', 'code' => 'A', 'days' => 'MWF', 'starts' => '08:00:00', 'ends' => '09:00:00', 'room' => 'LAB-1', 'capacity' => 40],
        ['subject' => 'CS102', 'code' => 'A', 'days' => 'MWF', 'starts' => '09:00:00', 'ends' => '10:00:00', 'room' => 'LAB-1', 'capacity' => 40],
        // A second section of the same subject: exercises the unique
        // (term, subject, section_code) constraint and gives the scheduler a
        // genuine choice between offerings.
        ['subject' => 'CS102', 'code' => 'B', 'days' => 'TTh', 'starts' => '13:00:00', 'ends' => '14:30:00', 'room' => 'LAB-2', 'capacity' => 35],
        ['subject' => 'MATH101', 'code' => 'A', 'days' => 'TTh', 'starts' => '08:00:00', 'ends' => '09:30:00', 'room' => 'RM-201', 'capacity' => 45],
        ['subject' => 'GE101', 'code' => 'A', 'days' => 'MWF', 'starts' => '10:00:00', 'ends' => '11:00:00', 'room' => 'RM-105', 'capacity' => 50],
        ['subject' => 'PE101', 'code' => 'A', 'days' => 'Sat', 'starts' => '08:00:00', 'ends' => '10:00:00', 'room' => 'GYM', 'capacity' => 60],
        // Year 1 semester 2 — what a 1st-year DemoEnrollmentSeeder student
        // (1 completed semester) actually needs to freely enroll into.
        ['subject' => 'CS201', 'code' => 'A', 'days' => 'MWF', 'starts' => '08:00:00', 'ends' => '09:00:00', 'room' => 'LAB-1', 'capacity' => 40],
        ['subject' => 'MATH102', 'code' => 'A', 'days' => 'TTh', 'starts' => '08:00:00', 'ends' => '09:30:00', 'room' => 'RM-201', 'capacity' => 45],
        ['subject' => 'GE102', 'code' => 'A', 'days' => 'MWF', 'starts' => '10:00:00', 'ends' => '11:00:00', 'room' => 'RM-105', 'capacity' => 50],
        ['subject' => 'LEAD 2', 'code' => 'A', 'days' => 'Sat', 'starts' => '08:00:00', 'ends' => '09:30:00', 'room' => 'RM-301', 'capacity' => 60],
        // Year 2 semester 2 — 2nd-year students (3 completed semesters).
        ['subject' => 'CS301', 'code' => 'A', 'days' => 'TTh', 'starts' => '10:00:00', 'ends' => '11:30:00', 'room' => 'LAB-2', 'capacity' => 40],
        ['subject' => 'LEAD 4', 'code' => 'A', 'days' => 'Sat', 'starts' => '10:00:00', 'ends' => '11:30:00', 'room' => 'RM-301', 'capacity' => 60],
        // Year 3 semester 2 — 3rd-year students (5 completed semesters).
        ['subject' => 'CS303', 'code' => 'A', 'days' => 'MWF', 'starts' => '13:00:00', 'ends' => '14:00:00', 'room' => 'RM-202', 'capacity' => 40],
        ['subject' => 'LEAD 6', 'code' => 'A', 'days' => 'Sat', 'starts' => '13:00:00', 'ends' => '14:30:00', 'room' => 'RM-301', 'capacity' => 60],
        // Year 4 semester 2 — 4th-year students (7 completed semesters).
        ['subject' => 'CS402', 'code' => 'A', 'days' => 'TTh', 'starts' => '13:00:00', 'ends' => '14:30:00', 'room' => 'RM-203', 'capacity' => 30],
        ['subject' => 'LEAD8', 'code' => 'A', 'days' => 'Sat', 'starts' => '15:00:00', 'ends' => '16:30:00', 'room' => 'RM-301', 'capacity' => 60],
    ];

    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            $term = AcademicTerm::query()
                ->where('status', AcademicTermStatus::SemesterOngoing)
                ->first();
            $professor = User::query()->where('role', UserRole::Faculty)->first();

            // The manual enrollment startup seed intentionally contains only
            // archived history. Sections are created after a Registrar opens
            // an ongoing term, so a clean archive-only seed is a no-op here.
            if ($term === null || $professor === null) {
                return;
            }

            foreach (self::SECTIONS as $section) {
                $subject = Subject::query()->where('code', $section['subject'])->firstOrFail();

                Section::updateOrCreate(
                    [
                        'academic_term_id' => $term->id,
                        'subject_id' => $subject->id,
                        'section_code' => $section['code'],
                    ],
                    [
                        'professor_id' => $professor->id,
                        'schedule_days' => $section['days'],
                        'starts_at_time' => $section['starts'],
                        'ends_at_time' => $section['ends'],
                        'room' => $section['room'],
                        'capacity' => $section['capacity'],
                        'viability_threshold' => null,
                        'status' => SectionStatus::Published,
                    ],
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
                'SectionSeeder may only run in the local or testing environment. '
                .'Refusing to seed synthetic section data into "'.app()->environment().'".',
            );
        }
    }
}
