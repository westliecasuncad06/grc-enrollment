<?php

namespace Database\Seeders;

use App\Domain\Curriculum\SubjectStatus;
use App\Models\Subject;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds the real GRC College of Computer Studies subject catalog, transcribed
 * from `docs/reference/ccs-block-sections-ay2026-2027-1st-sem.csv` and
 * `docs/reference/ccs-block-sections-ay2024-2025-2nd-sem.csv` — the block
 * section schedules the user supplied. This is the actual CCS catalog, not a
 * placeholder, and is additive to (never a replacement for) `SubjectSeeder`'s
 * synthetic `CS101`/`MATH101` catalog: existing tests, the curriculum
 * prerequisite chain, and the four demo student lifecycles all depend on the
 * synthetic codes and must keep working unchanged.
 *
 * Only `code`, `title`, and `units` were extracted — schedule, room, faculty,
 * modality, and Google Classroom columns are out of scope for Phase 6 (see
 * the Phase 6 plan). Each source file lists the same subject across many
 * block sections; `units` was resolved by majority value per code after
 * discarding two kinds of row noise:
 *
 *   - 13 rows where the UNITS column actually held a five-digit SCHED ID
 *     (e.g. `33191`) instead of a unit count — a column-alignment artifact
 *     in the source spreadsheet, not a real value.
 *   - A handful of rows with a blank units cell.
 *
 * `LEAD 1`–`LEAD 8` (Leadership) are genuinely 1.5 units — the reason
 * `subjects.units`/`enrollments.total_units` were widened to `decimal(_,1)`
 * in the migration immediately preceding this seeder's introduction.
 *
 * Codes are transcribed exactly as the source spreadsheets spell them,
 * including the inconsistent `"LEAD 1"` (with a space) vs `"LEAD8"` (without)
 * — that inconsistency is in the real data, not introduced here.
 *
 * `status` is `Active` for every row: the source files are the *current*
 * offering, so nothing here is being marked retired.
 */
final class CcsSubjectSeeder extends Seeder
{
    /**
     * @var list<array{code: string, title: string, units: float, status: SubjectStatus}>
     */
    private const SUBJECTS = [
        ['code' => 'ADET', 'title' => 'Application Development and Emerging Technologies LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'ADETL', 'title' => 'Application Development and Emerging Technologies LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'AMC', 'title' => 'Advanced Mobile Computing LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'AMCL', 'title' => 'Advanced Mobile Computing LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'ARTAPP', 'title' => 'Art Appreciation', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'AVE', 'title' => 'Animation and Video Editing LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'AVEL', 'title' => 'Animation and Video Editing LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'BMC', 'title' => 'Basic Mobile Computing LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'BMCL', 'title' => 'Basic Mobile Computing LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'BUSANA', 'title' => 'Business Analytics', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'CAO', 'title' => 'Computer Architecture and Organization LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'CAOL', 'title' => 'Computer Architecture and Organization LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'CAPS1', 'title' => 'Capstone Project and Research 1 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'CAPS1L', 'title' => 'Capstone Project and Research 1 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'CAPS2', 'title' => 'Capstone Project and Research 2 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'CAPS2L', 'title' => 'Capstone Project and Research 2 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'CONWRLD', 'title' => 'The Contemporary World', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'CPROG1', 'title' => 'Computer Programming 1 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'CPROG1L', 'title' => 'Computer Programming 1 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'CPROG2', 'title' => 'Computer Programming 2 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'CPROG2L', 'title' => 'Computer Programming 2 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'DBMSYS', 'title' => 'Database Management System LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'DBMSYSL', 'title' => 'Database Management System LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'DMATH', 'title' => 'Discrete Mathematics', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'DSTRUC', 'title' => 'Data Structures and Algorithms LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'DSTRUCL', 'title' => 'Data Structures and Algorithms LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'ENVISCI', 'title' => 'Environmental Science', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'ETHICS', 'title' => 'ETHICS', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'IAS', 'title' => 'Information Assurance and Security 1 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'IAS2', 'title' => 'Information Assurance and Security 2 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'IAS2L', 'title' => 'Information Assurance and Security 2 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'IASL', 'title' => 'Information Assurance and Security 1 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'IHCI', 'title' => 'Introduction to Human Computer Interaction LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'IHCIL', 'title' => 'Introduction to Human Computer Interaction LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'IPT1', 'title' => 'Integrative Programming Technologies 1 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'IPT1L', 'title' => 'Integrative Programming Technologies 1 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'ITC', 'title' => 'Introduction to Computing LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'ITCL', 'title' => 'Introduction to Computing LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'ITP1', 'title' => 'Computer Hardware and Troubleshooting LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'ITP1L', 'title' => 'Computer Hardware and Troubleshooting LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'ITP2', 'title' => 'Fundamentals of Programming LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'ITP2L', 'title' => 'Fundamentals of Programming LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'ITPLUS3', 'title' => 'Office Productivity Tools LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'ITPLUS3L', 'title' => 'Office Productivity Tools LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'ITPLUS4L', 'title' => 'Graphic Design LAB', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'KOMFIL', 'title' => 'Kontekstwalisadong Komunikasyon sa Filipino', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'LEAD 1', 'title' => 'Leadership 1', 'units' => 1.5, 'status' => SubjectStatus::Active],
        ['code' => 'LEAD 2', 'title' => 'Leadership 2', 'units' => 1.5, 'status' => SubjectStatus::Active],
        ['code' => 'LEAD 3', 'title' => 'Leadership 3', 'units' => 1.5, 'status' => SubjectStatus::Active],
        ['code' => 'LEAD 4', 'title' => 'Leadership 4', 'units' => 1.5, 'status' => SubjectStatus::Active],
        ['code' => 'LEAD 5', 'title' => 'Leadership 5', 'units' => 1.5, 'status' => SubjectStatus::Active],
        ['code' => 'LEAD 6', 'title' => 'Leadership 6', 'units' => 1.5, 'status' => SubjectStatus::Active],
        ['code' => 'LEAD 7', 'title' => 'Leadership 7', 'units' => 1.5, 'status' => SubjectStatus::Active],
        ['code' => 'LEAD8', 'title' => 'Leadership 8', 'units' => 1.5, 'status' => SubjectStatus::Active],
        ['code' => 'MATHWRLD', 'title' => 'Mathematics in the Modern World', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'NSTP 1', 'title' => 'National Service Training Program 1', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'NSTP 2', 'title' => 'National Service Training Program 2', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'NW1', 'title' => 'Networking 1 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'NW1L', 'title' => 'Networking 1 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'OOPR', 'title' => 'Object Oriented Programming LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'OOPRL', 'title' => 'Object Oriented Programming LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'PATHFIT1', 'title' => 'Physical Activity Towards Health and Fitness', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'PATHFIT2', 'title' => 'Exercise-Based Course', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'PATHFIT3', 'title' => 'Dance and Fitness Wellness', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'PE 4', 'title' => 'Team Sports', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'PHILHIST', 'title' => 'Readings in Philippine History', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'PRACT', 'title' => 'Practicum/Work Integrated Learning (600 Hours)', 'units' => 6.0, 'status' => SubjectStatus::Active],
        ['code' => 'PRELEC2', 'title' => 'Professional Elective 2 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'PRELEC2L', 'title' => 'Professional Elective 2 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'PSPEAK', 'title' => 'Public Speaking', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'PT', 'title' => 'Platform Technologies LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'PTL', 'title' => 'Platform Technologies LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'PURPCOMM', 'title' => 'Purposive Communication', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'QMTHODS', 'title' => 'Quantitative Methods (modeling and simulation)', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'RIZAL', 'title' => 'Rizal\'s Life & Works', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'SAM', 'title' => 'System Admin and Maintenance LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'SAML', 'title' => 'System Admin and Maintenance LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'SCITECH', 'title' => 'Science, Technology, and Society', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'SIA2', 'title' => 'System Integration and Architecture 2 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'SIA2L', 'title' => 'System Integration and Architecture 2 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'SOSLIT', 'title' => 'Sosyedad at Literatura', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'SPEAK', 'title' => 'Public Speaking', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'SPI', 'title' => 'Social and Professional Issues', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'SYSARC1', 'title' => 'System Integration and Architecture 1 LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'SYSARC1L', 'title' => 'System Integration and Architecture 1 LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
        ['code' => 'UNDSELF', 'title' => 'Understanding the Self/Pagunawa sa Sarili', 'units' => 3.0, 'status' => SubjectStatus::Active],
        ['code' => 'WST', 'title' => 'Web System and Technologies LEC', 'units' => 2.0, 'status' => SubjectStatus::Active],
        ['code' => 'WSTL', 'title' => 'Web System and Technologies LAB', 'units' => 1.0, 'status' => SubjectStatus::Active],
    ];

    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            foreach (self::SUBJECTS as $subject) {
                Subject::updateOrCreate(
                    ['code' => $subject['code']],
                    [
                        'title' => $subject['title'],
                        'units' => $subject['units'],
                        'status' => $subject['status'],
                    ],
                );
            }
        });
    }

    /**
     * Real institutional data must never reach a production-like environment
     * through a seeder — the same guard every other seeder in this project
     * carries.
     */
    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'CcsSubjectSeeder may only run in the local or testing environment. '
                .'Refusing to seed CCS subject data into "'.app()->environment().'".',
            );
        }
    }
}
