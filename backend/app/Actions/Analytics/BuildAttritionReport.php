<?php

namespace App\Actions\Analytics;

use App\Domain\Enrollment\EnrollmentStatus;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use App\Models\StudentProfile;
use Illuminate\Support\Collection;

/**
 * Factual, aggregate-only persistence report. Its baseline is official
 * enrollment, never a predictive-risk table or a student's private profile.
 */
final class BuildAttritionReport
{
    /**
     * @param  array{college?: ?string, program_id?: ?int, year_level?: ?int}  $filters
     * @return array{baseline_term: array<string, mixed>, comparison_term: array<string, mixed>, generated_at: string, summary: array<string, int|float>, groups: array<string, list<array<string, int|float|string|null>>}
     */
    public function execute(AcademicTerm $baselineTerm, AcademicTerm $comparisonTerm, array $filters): array
    {
        $baselineStudents = StudentProfile::query()
            ->where('is_demo_account', false)
            ->whereHas('enrollments', fn ($query) => $query
                ->where('academic_term_id', $baselineTerm->id)
                ->where('status', EnrollmentStatus::Enrolled->value))
            ->with('program')
            ->when($filters['program_id'] ?? null, fn ($query, int $programId) => $query->where('program_id', $programId))
            ->when($filters['year_level'] ?? null, fn ($query, int $yearLevel) => $query->where('year_level', $yearLevel))
            ->when($filters['college'] ?? null, fn ($query, string $college) => $query->whereHas('program', fn ($programs) => $programs->where('college', $college)))
            ->get();

        $retainedIds = Enrollment::query()
            ->where('academic_term_id', $comparisonTerm->id)
            ->where('status', EnrollmentStatus::Enrolled->value)
            ->whereIn('student_id', $baselineStudents->modelKeys())
            ->distinct()
            ->pluck('student_id')
            ->flip();

        $rows = $baselineStudents->map(fn (StudentProfile $student): array => [
            'college' => $student->program->college?->value,
            'program_id' => $student->program->id,
            'program_code' => $student->program->code,
            'program_name' => $student->program->name,
            'year_level' => $student->year_level,
            'retained' => $retainedIds->has($student->id),
        ]);

        return [
            'baseline_term' => self::term($baselineTerm),
            'comparison_term' => self::term($comparisonTerm),
            'generated_at' => now()->toIso8601String(),
            'summary' => self::metrics($rows),
            'groups' => [
                'colleges' => $rows->groupBy(fn (array $row): string => (string) ($row['college'] ?? 'Unassigned'))
                    ->map(fn (Collection $group): array => array_merge(['college' => $group->first()['college']], self::metrics($group)))
                    ->sortBy('college')->values()->all(),
                'programs' => $rows->groupBy(fn (array $row): string => (string) $row['program_id'])
                    ->map(fn (Collection $group): array => array_merge([
                        'college' => $group->first()['college'],
                        'program_id' => $group->first()['program_id'],
                        'program_code' => $group->first()['program_code'],
                        'program_name' => $group->first()['program_name'],
                    ], self::metrics($group)))
                    ->sortBy('program_code')->values()->all(),
                'year_levels' => $rows->groupBy(fn (array $row): string => (string) $row['year_level'])
                    ->map(fn (Collection $group): array => array_merge(['year_level' => $group->first()['year_level']], self::metrics($group)))
                    ->sortBy('year_level')->values()->all(),
            ],
        ];
    }

    /** @return array<string, string|int> */
    private static function term(AcademicTerm $term): array
    {
        return ['id' => $term->id, 'school_year' => $term->school_year, 'semester' => $term->semester];
    }

    /** @param Collection<int, array<string, mixed>> $rows @return array{baseline_count: int, retained_count: int, attrited_count: int, attrition_rate: float} */
    private static function metrics(Collection $rows): array
    {
        $baseline = $rows->count();
        $retained = $rows->where('retained', true)->count();
        $attrited = $baseline - $retained;

        return [
            'baseline_count' => $baseline,
            'retained_count' => $retained,
            'attrited_count' => $attrited,
            'attrition_rate' => $baseline === 0 ? 0.0 : round(($attrited / $baseline) * 100, 2),
        ];
    }
}
