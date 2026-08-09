<?php

namespace Database\Seeders;

use App\Domain\Identity\FacultyEmploymentType;
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
use App\Models\Section;
use App\Models\Subject;
use App\Models\User;
use DateTime;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
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

    private const PROFESSOR_DIRECTORY_PATH = __DIR__.'/../../../Subject And Prerequisuite/Professor_Department_List.md';

    private const PASSWORD = 'password';

    private const FULL_TIME_PREFERENCE_THRESHOLD = 6;

    /** @var array<string, list<string>> */
    private const INACTIVE_PROFILES = [
        'ccs' => ['Marian S. Villanueva', 'Jerome D. Aguilar', 'Liza P. Navarro'],
        'coe' => ['Imelda R. Valdez', 'Noel P. Salvador', 'Rosalie T. Aquino'],
        'cbae' => ['Oscar M. Fernandez', 'Celeste D. Aragon', 'Victor L. Ramos'],
        'coa' => ['Teresita L. Cruz', 'Ramon C. de Leon', 'Sandra M. Bautista'],
    ];

    /** @var list<string> */
    private const LEGACY_PLACEHOLDER_NAMES = [
        'Adrian M. Navarro', 'Bianca S. Mercado', 'Carlos D. Ramos',
        'Diana L. Santos', 'Elena P. Cruz', 'Felix R. Mendoza',
        'Grace T. Villanueva', 'Hector A. Aguilar', 'Iris N. Bautista',
        'Jonas C. Garcia', 'Kara F. Domingo', 'Lorenzo V. Reyes',
    ];

    /** @var array<string, Subject> */
    private array $subjectsByCollegeAndCode = [];

    /** @var array<string, list<Curriculum>> */
    private array $currentAndPreviousCurriculaByProgram = [];

    /** @var array<string, true> */
    private array $curriculumSubjectSemesterKeys = [];

    /** @var array<string, list<AcademicTerm>> */
    private array $planningTermsBySemester = [];

    private ?string $localPasswordHash = null;

    public function __construct(
        private readonly ?string $csvPathOverride = null,
        private readonly ?string $professorDirectoryPathOverride = null,
    ) {}

    public function run(): void
    {
        $this->guardEnvironment();
        $rows = $this->readRows($this->csvPathOverride ?? self::CSV_PATH);
        $profiles = $this->profileRows($rows);
        $professorDirectoryPath = $this->professorDirectoryPath();
        $professorDirectoryEntries = $professorDirectoryPath === null
            ? []
            : $this->readProfessorDirectory($professorDirectoryPath);
        $this->loadReferenceData();

        $resolvedProfessorDirectory = DB::transaction(function () use ($profiles, $professorDirectoryEntries): array {
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
                        'password' => $this->localPasswordHash(),
                        'role' => UserRole::Faculty,
                        'college' => $college,
                        'status' => UserStatus::Active,
                    ],
                );
            }

            $resolvedProfessorDirectory = $this->synchronizeProfessorDirectory(
                $professorDirectoryEntries,
            );
            $this->deactivateLegacyLocalFaculty(array_values($usersByProfile));
            $this->replaceWorkbookEvidence($profiles, $usersByProfile);
            $this->ensureLocalFacultyAccounts();
            $this->initializeEmploymentTypes();
            $this->seedInactiveFacultyProfiles();
            $this->activateAllFacultyAccounts();

            return $resolvedProfessorDirectory;
        });

        $this->writeAccountReport();
        if ($professorDirectoryPath !== null) {
            $this->writeProfessorDirectory(
                $professorDirectoryPath,
                $resolvedProfessorDirectory,
            );
        }
    }

    /**
     * @return list<array{number: ?int, name: string, email: ?string, department: string}>
     */
    private function readProfessorDirectory(string $path): array
    {
        if (! is_file($path)) {
            throw new RuntimeException("WorkbookFacultyProfileSeeder could not find its professor directory at {$path}");
        }

        $entries = [];
        foreach (preg_split('/\R/u', File::get($path)) ?: [] as $line) {
            if (preg_match('/^\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/u', $line, $matches) === 1) {
                $number = (int) $matches[1];
                $name = trim($matches[2]);
                $email = null;
                $department = trim($matches[3]);
            } elseif (preg_match('/^\|\s*(.*?)\s*\|\s*([^|\s]+@grc\.test)\s*\|\s*(.*?)\s*\|\s*$/iu', $line, $matches) === 1) {
                $number = null;
                $name = trim($matches[1]);
                $email = strtolower(trim($matches[2]));
                $department = trim($matches[3]);
            } else {
                continue;
            }
            if ($name === '' || $department === '') {
                continue;
            }
            $entries[] = [
                'number' => $number,
                'name' => $name,
                'email' => $email,
                'department' => $department,
            ];
        }

        return $entries;
    }

    private function professorDirectoryPath(): ?string
    {
        if ($this->professorDirectoryPathOverride !== null) {
            return $this->professorDirectoryPathOverride;
        }

        return app()->environment('local') && is_file(self::PROFESSOR_DIRECTORY_PATH)
            ? self::PROFESSOR_DIRECTORY_PATH
            : null;
    }

    /**
     * @param  list<array{number: ?int, name: string, email: ?string, department: string}>  $entries
     * @return list<array{name: string, email: string, department: string}>
     */
    private function synchronizeProfessorDirectory(array $entries): array
    {
        $resolvedEntries = [];
        foreach ($entries as $entry) {
            $college = CollegeCode::tryFrom(strtolower($entry['department']));
            $name = $this->professorDirectoryDisplayName($entry['name']);
            $email = $entry['email'] ?? $this->professorDirectoryEmail($college, $name, $entry);
            $professor = User::firstOrNew(['email' => $email]);
            $professor->fill([
                'name' => $name,
                'password' => $this->localPasswordHash(),
                'role' => UserRole::Faculty,
                'college' => $college,
                'status' => UserStatus::Active,
            ]);
            if ($professor->employment_type === null) {
                $professor->employment_type = FacultyEmploymentType::PartTime;
            }
            $professor->save();
            $resolvedEntries[] = [
                'name' => $professor->name,
                'email' => $professor->email,
                'department' => $entry['department'],
            ];
        }

        return $resolvedEntries;
    }

    private function professorDirectoryDisplayName(string $sourceName): string
    {
        $withoutHonorific = trim((string) preg_replace(
            '/^(?:mr|mrs|ms|dr|atty)\.?\s+/iu',
            '',
            $sourceName,
        ));
        $tokens = preg_split('/\s+/u', $withoutHonorific) ?: [];
        $firstToken = str_replace('.', '', $tokens[0] ?? '');

        if (count($tokens) >= 2 && mb_strlen($firstToken) > 2) {
            return $withoutHonorific;
        }

        return WorkbookFacultyProfileName::displayName([$sourceName]);
    }

    /**
     * @param  array{number: ?int, name: string, email: ?string, department: string}  $entry
     */
    private function professorDirectoryEmail(?CollegeCode $college, string $name, array $entry): string
    {
        $scope = $college?->value ?? 'unassigned';
        $key = $entry['department'].'|'.$entry['name'];

        return 'faculty.list.'.$scope.'.'.Str::slug($name).'.'.substr(sha1($key), 0, 8).'@grc.test';
    }

    private function activateAllFacultyAccounts(): void
    {
        User::query()
            ->where('role', UserRole::Faculty->value)
            ->update(['status' => UserStatus::Active->value]);
    }

    /**
     * @param  list<array{name: string, email: string, department: string}>  $entries
     */
    private function writeProfessorDirectory(string $path, array $entries): void
    {
        $lines = [
            '# Professor and Department List',
            '',
            '| Professor Name | Email | Department |',
            '|---|---|---|',
        ];
        foreach ($entries as $entry) {
            $lines[] = sprintf(
                '| %s | %s | %s |',
                $entry['name'],
                $entry['email'],
                $entry['department'],
            );
        }
        $lines[] = '';
        $lines[] = '**Total professors:** '.count($entries);

        File::put($path, implode(PHP_EOL, $lines).PHP_EOL);
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
     * Existing faculty records are identities already, but a local report and
     * repeatable demo need every account to have a safe local email and a
     * displayable full name. This never changes active/inactive status.
     */
    private function ensureLocalFacultyAccounts(): void
    {
        User::query()
            ->where('role', UserRole::Faculty->value)
            ->orderBy('id')
            ->each(function (User $faculty): void {
                $changes = [];
                if (! str_ends_with(strtolower($faculty->email), '@grc.test')) {
                    $college = $faculty->college?->value ?? 'unassigned';
                    $changes['email'] = "faculty.{$college}.legacy-{$faculty->id}@grc.test";
                }
                if (! str_contains(trim($faculty->name), ' ')
                    || preg_match('/\b(demo|testing)\b/iu', $faculty->name) === 1) {
                    $changes['name'] = $this->localFullNameFor($faculty);
                }
                // This seeder is deliberately restricted to local/testing
                // environments. The shared local credential is part of the
                // generated account report so every listed professor can be
                // checked manually without a separate password reset.
                $changes['password'] = $this->localPasswordHash();
                if ($changes !== []) {
                    $faculty->update($changes);
                }
            });
    }

    /**
     * Null is the seed-only sentinel. Once the Program Chair chooses an
     * employment type it is never overwritten by later workbook reseeds.
     */
    private function initializeEmploymentTypes(): void
    {
        $preferenceCounts = FacultyCurriculumSubjectPreference::query()
            ->selectRaw('professor_id, count(distinct subject_id) as preference_count')
            ->groupBy('professor_id')
            ->pluck('preference_count', 'professor_id');

        User::query()
            ->where('role', UserRole::Faculty->value)
            ->whereNull('employment_type')
            ->orderBy('id')
            ->each(function (User $faculty) use ($preferenceCounts): void {
                $count = (int) ($preferenceCounts[$faculty->id] ?? 0);
                $faculty->update([
                    'employment_type' => $count >= self::FULL_TIME_PREFERENCE_THRESHOLD
                        ? FacultyEmploymentType::FullTime
                        : FacultyEmploymentType::PartTime,
                ]);
            });
    }

    private function seedInactiveFacultyProfiles(): void
    {
        foreach (self::INACTIVE_PROFILES as $collegeValue => $names) {
            $college = CollegeCode::from($collegeValue);
            foreach ($names as $index => $name) {
                User::updateOrCreate(
                    ['email' => "inactive.{$collegeValue}.".($index + 1).'@grc.test'],
                    [
                        'name' => $name,
                        'password' => $this->localPasswordHash(),
                        'role' => UserRole::Faculty,
                        'college' => $college,
                        'employment_type' => FacultyEmploymentType::PartTime,
                        'status' => UserStatus::Disabled,
                    ],
                );
            }
        }
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
                $subject = $this->subjectsByCollegeAndCode[
                    $this->subjectKey($profile['college']->value, $row['subject_code'])
                ] ?? null;
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
        $programKey = strtolower(trim($row['college'])).'|'.strtoupper(trim($row['program_code']));

        return array_values(array_filter(
            $this->currentAndPreviousCurriculaByProgram[$programKey] ?? [],
            fn (Curriculum $curriculum): bool => isset($this->curriculumSubjectSemesterKeys[
                $curriculum->id.':'.$subjectId.':'.$semester
            ]) || isset($this->curriculumSubjectSemesterKeys[
                $curriculum->id.':'.$subjectId.':1st|2nd'
            ]),
        ));
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
        return $this->planningTermsBySemester[$semester] ?? [];
    }

    /**
     * Preload the subject, curriculum, placement, and term data used by every
     * workbook row. This keeps the local-only seed deterministic without
     * issuing hundreds of repeated catalog queries.
     */
    private function loadReferenceData(): void
    {
        $this->subjectsByCollegeAndCode = [];
        foreach (Subject::query()->get(['id', 'college', 'code']) as $subject) {
            if ($subject->college === null) {
                continue;
            }
            $this->subjectsByCollegeAndCode[
                $this->subjectKey($subject->college->value, $subject->code)
            ] = $subject;
        }

        $curricula = Curriculum::query()
            ->with('program')
            ->whereIn('status', ['active', 'archived'])
            ->orderByDesc('effective_start_year')
            ->get();
        $this->currentAndPreviousCurriculaByProgram = [];
        foreach ($curricula->groupBy('program_id') as $programCurricula) {
            $selected = $programCurricula->take(2)->values();
            $program = $selected->first()?->program;
            if ($program === null || $program->college === null) {
                continue;
            }
            $this->currentAndPreviousCurriculaByProgram[
                $program->college->value.'|'.strtoupper($program->code)
            ] = $selected->all();
        }

        $curriculumIds = $curricula->pluck('id');
        $this->curriculumSubjectSemesterKeys = [];
        foreach (CurriculumSubject::query()
            ->whereIn('curriculum_id', $curriculumIds)
            ->get(['curriculum_id', 'subject_id', 'semester']) as $placement) {
            $this->curriculumSubjectSemesterKeys[
                $placement->curriculum_id.':'.$placement->subject_id.':'.$placement->semester
            ] = true;
        }

        $this->planningTermsBySemester = AcademicTerm::query()
            ->whereNotIn('status', ['archived', 'semester_closed'])
            ->get()
            ->groupBy('semester')
            ->map(static fn ($terms): array => $terms->values()->all())
            ->all();
    }

    private function subjectKey(string $college, string $code): string
    {
        return strtolower(trim($college)).'|'.strtoupper(trim($code));
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

    private function localPasswordHash(): string
    {
        return $this->localPasswordHash ??= Hash::make(self::PASSWORD);
    }

    private function localFullNameFor(User $faculty): string
    {
        if (preg_match('/\b(demo|testing)\b/iu', $faculty->name) === 1) {
            return self::LEGACY_PLACEHOLDER_NAMES[
                $faculty->id % count(self::LEGACY_PLACEHOLDER_NAMES)
            ];
        }

        return WorkbookFacultyProfileName::displayName([$faculty->name]);
    }

    private function writeAccountReport(): void
    {
        $lines = [
            '# Local professor accounts',
            '',
            'Generated from local faculty accounts and the 2024–2029 workbook reference extract. Shared password: `password`.',
        ];
        $faculty = User::query()
            ->where('role', UserRole::Faculty->value)
            ->orderBy('college')
            ->orderBy('name')
            ->orderBy('id')
            ->get();
        $facultyIds = $faculty->pluck('id');
        $preferences = FacultyCurriculumSubjectPreference::query()
            ->with('subject')
            ->whereIn('professor_id', $facultyIds)
            ->orderBy('semester')
            ->orderBy('rank')
            ->get()
            ->groupBy('professor_id');
        $availability = FacultyAvailability::query()
            ->with('academicTerm')
            ->whereIn('professor_id', $facultyIds)
            ->orderBy('academic_term_id')
            ->orderBy('day_of_week')
            ->orderBy('starts_at_time')
            ->get()
            ->groupBy('professor_id');
        $history = FacultyTeachingHistory::query()
            ->with('subject')
            ->whereIn('professor_id', $facultyIds)
            ->orderByDesc('evidence_count')
            ->get()
            ->groupBy('professor_id');
        $currentTerm = AcademicTerm::query()->where('status', 'semester_ongoing')->first();
        $assignedUnits = $currentTerm === null
            ? collect()
            : Section::query()
                ->with('subject')
                ->where('academic_term_id', $currentTerm->id)
                ->whereIn('professor_id', $facultyIds)
                ->get()
                ->groupBy('professor_id')
                ->map(static fn ($sections): float => (float) $sections->sum(static fn (Section $section): float => (float) $section->subject->units));

        $facultyByCollege = $faculty->groupBy(
            static fn (User $user): string => strtoupper($user->college?->value ?? 'unassigned'),
        );
        foreach ($facultyByCollege as $college => $collegeFaculty) {
            $lines[] = '';
            $lines[] = '## '.$college;
            $lines[] = '';
            $lines[] = '| Professor | Email | Account status | Employment type | Planning reference | Desired subjects | Desired availability | Teaching history | Current assigned units |';
            $lines[] = '| --- | --- | --- | --- | --- | --- | --- | --- | --- |';
            foreach ($collegeFaculty as $user) {
                $codes = ['1st' => [], '2nd' => []];
                foreach ($preferences->get($user->id, collect()) as $preference) {
                    $codes[$preference->semester] ??= [];
                    $codes[$preference->semester][] = $preference->subject->code;
                }
                $desiredSubjects = implode(', ', array_filter([
                    $codes['1st'] === [] ? null : '1st: '.implode(', ', array_unique($codes['1st'])),
                    $codes['2nd'] === [] ? null : '2nd: '.implode(', ', array_unique($codes['2nd'])),
                ]));
                $desiredAvailability = $availability->get($user->id, collect())
                    ->map(fn (FacultyAvailability $window): string => $window->academicTerm->school_year.' '.$window->academicTerm->semester.' '.self::dayLabel($window->day_of_week).' '.$window->starts_at_time.'-'.$window->ends_at_time)
                    ->implode('; ');
                $teachingHistory = $history->get($user->id, collect())
                    ->map(fn (FacultyTeachingHistory $entry): string => $entry->subject->code.' ×'.$entry->evidence_count)
                    ->implode(', ');
                $lines[] = sprintf(
                    '| %s | %s | %s | %s | %s | %s | %s | %s | %s |',
                    $user->name,
                    $user->email,
                    $user->status === UserStatus::Active ? 'Active' : 'Inactive',
                    $user->employment_type?->label() ?? 'Part-time',
                    $user->employment_type?->planningUnitReference() === null ? '—' : $user->employment_type->planningUnitReference().' units',
                    $desiredSubjects ?: '—',
                    $desiredAvailability ?: '—',
                    $teachingHistory ?: '—',
                    ($assignedUnits[$user->id] ?? 0).' units',
                );
            }
        }

        $directory = storage_path('app/local-reports');
        File::ensureDirectoryExists($directory);
        File::put($directory.'/professor-accounts.md', implode(PHP_EOL, $lines).PHP_EOL);
    }

    private static function dayLabel(int $day): string
    {
        return [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'][$day] ?? 'Unknown';
    }

    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('WorkbookFacultyProfileSeeder may only run locally or in testing.');
        }
    }
}
