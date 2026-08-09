<?php

namespace Database\Seeders;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\WorkbookFacultyProfileName;
use App\Models\AcademicTerm;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\FacultyAvailability;
use App\Models\FacultyCurriculumSubjectPreference;
use App\Models\FacultyTeachingHistory;
use App\Models\Subject;
use App\Models\User;
use DateTime;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;
use SplFileObject;

/**
 * Local/test-only faculty profiles derived from the deterministic schedule
 * reference extract of the supplied 2024–2029 curriculum workbooks. The
 * source is advisory teaching evidence, not a production HR import.
 */
final class WorkbookFacultyProfileSeeder extends Seeder
{
    private const CSV_PATH = __DIR__.'/data/curriculum-2024-2029-schedule-references.csv';

    private const PASSWORD = 'password';

    public function __construct(private readonly ?string $csvPathOverride = null) {}

    public function run(): void
    {
        $this->guardEnvironment();
        $rows = $this->readRows($this->csvPathOverride ?? self::CSV_PATH);
        $profiles = $this->profileRows($rows);

        DB::transaction(function () use ($profiles): void {
            /** @var array<string, User> $usersByProfile */
            $usersByProfile = [];
            foreach ($profiles as $profileKey => $profile) {
                $name = WorkbookFacultyProfileName::displayName($profile['aliases']);
                $college = $profile['college'];
                $email = $this->emailFor($college, $name, $profileKey);
                $usersByProfile[$profileKey] = User::updateOrCreate(
                    ['email' => $email],
                    [
                        'name' => $name,
                        'password' => self::PASSWORD,
                        'role' => UserRole::Faculty,
                        'college' => $college,
                        'status' => UserStatus::Active,
                    ],
                );
            }

            $this->deactivateLegacyLocalFaculty(array_values($usersByProfile));
            $this->replaceWorkbookEvidence($profiles, $usersByProfile);
            $this->writeAccountReport($profiles, $usersByProfile);
        });
    }

    /** @return list<array<string, string>> */
    private function readRows(string $path): array
    {
        if (! is_file($path)) {
            throw new RuntimeException("WorkbookFacultyProfileSeeder could not find its CSV at {$path}");
        }

        $file = new SplFileObject($path);
        $file->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY | SplFileObject::DROP_NEW_LINE);
        $header = null;
        $rows = [];
        foreach ($file as $line) {
            if (! is_array($line) || $line === [null]) {
                continue;
            }
            if ($header === null) {
                $header = array_map(static fn (?string $value): string => trim((string) $value), $line);

                continue;
            }
            if (count($line) !== count($header)) {
                continue;
            }
            /** @var array<string, string> $row */
            $row = array_combine($header, $line);
            if (trim($row['professor_name'] ?? '') !== '') {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    /**
     * @param  list<array<string, string>>  $rows
     * @return array<string, array{college: CollegeCode, aliases: list<string>, rows: list<array<string, string>>}>
     */
    private function profileRows(array $rows): array
    {
        $profiles = [];
        foreach ($rows as $row) {
            $college = CollegeCode::tryFrom(strtolower(trim($row['college'] ?? '')));
            $alias = trim($row['professor_name'] ?? '');
            if ($college === null || $alias === '') {
                continue;
            }
            $key = $college->value.'|'.WorkbookFacultyProfileName::identityKey($alias);
            $profiles[$key] ??= ['college' => $college, 'aliases' => [], 'rows' => []];
            $profiles[$key]['aliases'][] = $alias;
            $profiles[$key]['rows'][] = $row;
        }

        ksort($profiles);

        return $profiles;
    }

    /**
     * @param  list<User>  $currentProfiles
     */
    private function deactivateLegacyLocalFaculty(array $currentProfiles): void
    {
        $currentIds = array_map(static fn (User $user): int => $user->id, $currentProfiles);
        User::query()
            ->where('role', UserRole::Faculty->value)
            ->where('email', 'like', 'faculty.%@grc.test')
            ->whereNotIn('id', $currentIds)
            ->where(function ($query): void {
                $query->where('email', 'faculty.seed@grc.test')
                    ->orWhereRaw("name not like '% %'");
            })
            ->update(['status' => UserStatus::Disabled->value]);
    }

    /**
     * @param  array<string, array{college: CollegeCode, aliases: list<string>, rows: list<array<string, string>>}>  $profiles
     * @param  array<string, User>  $usersByProfile
     */
    private function replaceWorkbookEvidence(array $profiles, array $usersByProfile): void
    {
        $profileIds = array_map(static fn (User $user): int => $user->id, array_values($usersByProfile));
        FacultyCurriculumSubjectPreference::query()
            ->whereIn('professor_id', $profileIds)
            ->where('origin', 'workbook_seeded')
            ->delete();
        FacultyTeachingHistory::query()
            ->whereIn('professor_id', $profileIds)
            ->where('source_kind', 'workbook_reference')
            ->delete();
        FacultyAvailability::query()
            ->whereIn('professor_id', $profileIds)
            ->where('origin', 'workbook_seeded')
            ->delete();

        $evidence = [];
        $availability = [];
        foreach ($profiles as $profileKey => $profile) {
            $professor = $usersByProfile[$profileKey];
            foreach ($profile['rows'] as $row) {
                $semester = trim($row['semester']);
                $subject = Subject::query()
                    ->where('college', $profile['college']->value)
                    ->where('code', trim($row['subject_code']))
                    ->first();
                if ($subject !== null) {
                    foreach ($this->matchingCurricula($row, $subject->id) as $curriculum) {
                        $key = implode(':', [$professor->id, $curriculum->id, $semester, $subject->id]);
                        $evidence[$key] ??= [
                            'professor_id' => $professor->id,
                            'curriculum_id' => $curriculum->id,
                            'semester' => $semester,
                            'subject_id' => $subject->id,
                            'subject_code' => $subject->code,
                            'raw_alias' => trim($row['professor_name']),
                            'evidence_count' => 0,
                        ];
                        $evidence[$key]['evidence_count']++;
                    }
                }

                $start = $this->normalizeTime($row['start_time'] ?? '');
                $end = $this->normalizeTime($row['end_time'] ?? '');
                if ($start === null || $end === null || $end <= $start) {
                    continue;
                }
                foreach ($this->days($row['day'] ?? '') as $day) {
                    foreach ($this->termsForSemester($semester) as $term) {
                        $availability[$professor->id.':'.$term->id.':'.$day][] = [
                            'professor_id' => $professor->id,
                            'academic_term_id' => $term->id,
                            'day_of_week' => $day,
                            'starts_at_time' => $start,
                            'ends_at_time' => $end,
                        ];
                    }
                }
            }
        }

        $this->persistEvidence($evidence);
        $this->persistAvailability($availability);
    }

    /** @return list<Curriculum> */
    private function matchingCurricula(array $row, int $subjectId): array
    {
        $semester = trim($row['semester']);

        return Curriculum::query()
            ->whereHas('program', fn ($programs) => $programs
                ->where('code', trim($row['program_code']))
                ->where('college', strtolower(trim($row['college']))),
            )
            ->whereIn('status', ['active', 'archived'])
            ->orderByDesc('effective_start_year')
            ->get()
            ->groupBy('program_id')
            ->flatMap(static fn ($curricula) => $curricula->take(2))
            ->filter(static fn (Curriculum $curriculum): bool => CurriculumSubject::query()
                ->where('curriculum_id', $curriculum->id)
                ->where('subject_id', $subjectId)
                ->where(function ($placements) use ($semester): void {
                    $placements->where('semester', $semester)->orWhere('semester', '1st|2nd');
                })->exists(),
            )
            ->values()
            ->all();
    }

    /** @param array<string, array{professor_id: int, curriculum_id: int, semester: string, subject_id: int, subject_code: string, raw_alias: string, evidence_count: int}> $evidence */
    private function persistEvidence(array $evidence): void
    {
        $byPreferenceList = [];
        foreach ($evidence as $row) {
            FacultyTeachingHistory::create([
                'professor_id' => $row['professor_id'],
                'curriculum_id' => $row['curriculum_id'],
                'subject_id' => $row['subject_id'],
                'semester' => $row['semester'],
                'source_kind' => 'workbook_reference',
                'source_workbook' => $row['semester'] === '1st'
                    ? '2024 - 2029 Curriculum 1st Semester.xlsx'
                    : '2024 - 2029 Curriculum 2nd Semester.xlsx',
                'raw_alias' => $row['raw_alias'],
                'evidence_count' => $row['evidence_count'],
            ]);
            $byPreferenceList[$row['professor_id'].':'.$row['curriculum_id'].':'.$row['semester']][] = $row;
        }

        foreach ($byPreferenceList as $rows) {
            usort($rows, static fn (array $left, array $right): int => [
                -$left['evidence_count'], $left['subject_code'], $left['subject_id'],
            ] <=> [
                -$right['evidence_count'], $right['subject_code'], $right['subject_id'],
            ]);
            foreach ($rows as $index => $row) {
                FacultyCurriculumSubjectPreference::create([
                    'professor_id' => $row['professor_id'],
                    'curriculum_id' => $row['curriculum_id'],
                    'subject_id' => $row['subject_id'],
                    'semester' => $row['semester'],
                    'rank' => $index + 1,
                    'origin' => 'workbook_seeded',
                ]);
            }
        }
    }

    /** @param array<string, list<array{professor_id: int, academic_term_id: int, day_of_week: int, starts_at_time: string, ends_at_time: string}>> $availability */
    private function persistAvailability(array $availability): void
    {
        foreach ($availability as $windows) {
            usort($windows, static fn (array $left, array $right): int => [$left['starts_at_time'], $left['ends_at_time']] <=> [$right['starts_at_time'], $right['ends_at_time']]);
            $merged = [];
            foreach ($windows as $window) {
                $lastIndex = array_key_last($merged);
                if ($lastIndex !== null && $window['starts_at_time'] <= $merged[$lastIndex]['ends_at_time']) {
                    $merged[$lastIndex]['ends_at_time'] = max($merged[$lastIndex]['ends_at_time'], $window['ends_at_time']);

                    continue;
                }
                $merged[] = $window;
            }
            foreach ($merged as $window) {
                FacultyAvailability::create($window + ['origin' => 'workbook_seeded']);
            }
        }
    }

    /** @return list<AcademicTerm> */
    private function termsForSemester(string $semester): array
    {
        return AcademicTerm::query()
            ->where('semester', $semester)
            ->whereNotIn('status', ['archived', 'semester_closed'])
            ->get()
            ->all();
    }

    /** @return list<int> */
    private function days(string $raw): array
    {
        $value = strtolower(trim($raw));
        $known = [
            'monday' => 1, 'mon' => 1, 'm' => 1,
            'tuesday' => 2, 'tue' => 2, 't' => 2,
            'wednesday' => 3, 'wed' => 3, 'w' => 3,
            'thursday' => 4, 'thu' => 4, 'th' => 4,
            'friday' => 5, 'fri' => 5, 'f' => 5,
            'saturday' => 6, 'sat' => 6,
            'sunday' => 7, 'sun' => 7,
        ];
        if (isset($known[$value])) {
            return [$known[$value]];
        }
        preg_match_all('/th|sat|sun|m|t|w|f/u', str_replace(['/', ',', ' '], '', $value), $matches);

        return array_values(array_unique(array_filter(array_map(static fn (string $token): ?int => $known[$token] ?? null, $matches[0] ?? []))));
    }

    private function normalizeTime(string $raw): ?string
    {
        $value = strtoupper(trim($raw));
        $value = preg_replace('/^[=\-]+/', '', $value) ?? $value;
        $value = preg_replace('/([AP])\.?\s*M\.?/', '$1M', $value) ?? $value;
        $value = preg_replace('/\s+/', '', $value) ?? $value;
        foreach (['g:iA', 'H:i', 'G:i'] as $format) {
            $parsed = DateTime::createFromFormat('!'.$format, $value);
            if ($parsed !== false) {
                return $parsed->format('H:i:s');
            }
        }

        return null;
    }

    private function emailFor(CollegeCode $college, string $name, string $profileKey): string
    {
        return 'faculty.'.$college->value.'.'.Str::slug($name).'.'.substr(sha1($profileKey), 0, 6).'@grc.test';
    }

    /**
     * @param  array<string, array{college: CollegeCode, aliases: list<string>, rows: list<array<string, string>>}>  $profiles
     * @param  array<string, User>  $usersByProfile
     */
    private function writeAccountReport(array $profiles, array $usersByProfile): void
    {
        $lines = [
            '# Local professor accounts',
            '',
            'Generated from the local 2024–2029 workbook reference extract. Shared password: `password`.',
            '',
            '| Department | Professor | Email | Classification | 1st semester preferences | 2nd semester preferences |',
            '| --- | --- | --- | --- | --- | --- |',
        ];
        $accounts = [];
        foreach ($profiles as $profileKey => $profile) {
            $user = $usersByProfile[$profileKey];
            $codes = ['1st' => [], '2nd' => []];
            foreach (FacultyCurriculumSubjectPreference::query()->with('subject')->where('professor_id', $user->id)->get() as $preference) {
                $codes[$preference->semester] ??= [];
                $codes[$preference->semester][] = $preference->subject->code;
            }
            $allCodes = array_merge($codes['1st'], $codes['2nd']);
            $serviceOnly = $allCodes !== [] && collect($allCodes)->every(static fn (string $code): bool => preg_match('/^(LEAD|NSTP|PATHFIT|PE|RIZAL|PHILHIS|MATHWRLD|KOMFIL|CONWRLD|ARTAPP|ETHICS|PURPCOMM|PSPEAK|SCITECH|ENVISCI)/u', $code) === 1);
            $accounts[] = [
                'college' => strtoupper($profile['college']->value),
                'name' => $user->name,
                'email' => $user->email,
                'classification' => $serviceOnly ? 'Service faculty' : 'Department faculty',
                'first' => implode(', ', array_unique($codes['1st'])),
                'second' => implode(', ', array_unique($codes['2nd'])),
            ];
        }
        usort($accounts, static fn (array $left, array $right): int => [$left['college'], $left['name']] <=> [$right['college'], $right['name']]);
        foreach ($accounts as $account) {
            $lines[] = sprintf('| %s | %s | %s | %s | %s | %s |', $account['college'], $account['name'], $account['email'], $account['classification'], $account['first'] ?: '—', $account['second'] ?: '—');
        }

        $directory = storage_path('app/local-reports');
        File::ensureDirectoryExists($directory);
        File::put($directory.'/professor-accounts.md', implode(PHP_EOL, $lines).PHP_EOL);
    }

    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('WorkbookFacultyProfileSeeder may only run locally or in testing.');
        }
    }
}
