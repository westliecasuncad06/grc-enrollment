<?php

namespace App\Actions\Analytics;

use App\Domain\Academic\GradeStatus;
use App\Domain\Analytics\AnalyticsYearOverYearPoint;
use App\Domain\Analytics\ProgramChairAnalyticsSummary;
use App\Domain\Analytics\RetentionBreakdownRow;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Organization\CollegeCode;
use App\Models\AcademicTerm;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Program-Chair-scoped counterpart to BuildEnrollmentSummary/
 * BuildInstitutionSummary (see ADR 0017): a college-scoped aggregate for a
 * Program Chair, or the supported-college aggregate for a Registrar Head.
 * Every count here is a
 * `DB::table(...)`/`selectRaw` row count, never Eloquent model hydration,
 * and grouping is driven exclusively by EnrollmentStatus/GradeStatus — the
 * two PRD-authoritative enums — never a provisional-vocabulary enum, and
 * `payments.amount` is never touched.
 *
 * The internal grade/enrollment crosstab preserves the resource contract for
 * existing clients, without asserting a passing-grade rule.
 */
final readonly class BuildProgramChairAnalyticsSummary
{
    public function execute(
        AcademicTerm $term,
        ?CollegeCode $college,
        ?int $yearLevel = null,
        ?string $trendSchoolYear = null,
        ?string $trendSemester = null,
        ?string $trendSchoolYearFrom = null,
        ?string $trendSchoolYearTo = null,
    ): ProgramChairAnalyticsSummary {
        $detailTermIds = $this->detailTermIds(
            $term,
            $trendSchoolYearFrom,
            $trendSchoolYearTo,
        );

        $enrollmentStatusRows = $this->applyCollegeScope(
            DB::table('enrollments')
                ->join('student_profiles', 'student_profiles.id', '=', 'enrollments.student_id')
                ->join('programs', 'programs.id', '=', 'student_profiles.program_id'),
            $college,
        )
            ->whereIn('enrollments.academic_term_id', $detailTermIds)
            ->when($yearLevel !== null, fn ($query) => $query->where('student_profiles.year_level', $yearLevel))
            ->select('enrollments.status')
            ->selectRaw('count(*) as aggregate')
            ->groupBy('enrollments.status')
            ->pluck('aggregate', 'status');

        $enrollmentStatusCounts = [];
        foreach (EnrollmentStatus::cases() as $status) {
            $enrollmentStatusCounts[$status->value] = (int) ($enrollmentStatusRows[$status->value] ?? 0);
        }

        // GradeStatus x EnrollmentStatus lifecycle crosstab for this
        // term/scope. gradeStatusCounts is derived from the same crosstab
        // (summed across enrollment statuses) so the marginal total and the
        // matrix can never drift apart.
        $crosstabRows = $this->applyCollegeScope(
            DB::table('academic_grades')
                ->join('student_profiles', 'student_profiles.id', '=', 'academic_grades.student_id')
                ->join('programs', 'programs.id', '=', 'student_profiles.program_id')
                ->join('enrollments', function ($join): void {
                    $join->on('enrollments.student_id', '=', 'academic_grades.student_id')
                        ->on('enrollments.academic_term_id', '=', 'academic_grades.academic_term_id');
                }),
            $college,
        )
            ->whereIn('academic_grades.academic_term_id', $detailTermIds)
            ->when($yearLevel !== null, fn ($query) => $query->where('student_profiles.year_level', $yearLevel))
            ->select('academic_grades.status as grade_status', 'enrollments.status as enrollment_status')
            ->selectRaw('count(*) as aggregate')
            ->groupBy('academic_grades.status', 'enrollments.status')
            ->get()
            ->keyBy(fn ($row): string => $row->grade_status.'|'.$row->enrollment_status);

        $gradeStatusCounts = [];
        $retentionBreakdown = [];
        foreach (GradeStatus::cases() as $gradeStatus) {
            $gradeStatusCounts[$gradeStatus->value] = 0;
            foreach (EnrollmentStatus::cases() as $enrollmentStatus) {
                $key = $gradeStatus->value.'|'.$enrollmentStatus->value;
                $count = (int) ($crosstabRows[$key]->aggregate ?? 0);
                $gradeStatusCounts[$gradeStatus->value] += $count;
                $retentionBreakdown[] = new RetentionBreakdownRow(
                    gradeStatus: $gradeStatus->value,
                    enrollmentStatus: $enrollmentStatus->value,
                    count: $count,
                );
            }
        }

        $officialEnrolledCount = (int) $this->applyCollegeScope(
            DB::table('enrollments')
                ->join('student_profiles', 'student_profiles.id', '=', 'enrollments.student_id')
                ->join('programs', 'programs.id', '=', 'student_profiles.program_id'),
            $college,
        )
            ->whereIn('enrollments.academic_term_id', $detailTermIds)
            ->where('enrollments.status', EnrollmentStatus::Enrolled->value)
            ->when($yearLevel !== null, fn ($query) => $query->where('student_profiles.year_level', $yearLevel))
            ->distinct('enrollments.student_id')
            ->count('enrollments.student_id');

        // Trend: use only official `enrolled` students for the metric. The
        // conditional distinct count still keeps a term visible as zero when
        // a department had only pending/draft enrollment activity that term.
        $yearOverYearRows = $this->applyCollegeScope(
            DB::table('enrollments')
                ->join('student_profiles', 'student_profiles.id', '=', 'enrollments.student_id')
                ->join('programs', 'programs.id', '=', 'student_profiles.program_id')
                ->join('academic_terms', 'academic_terms.id', '=', 'enrollments.academic_term_id'),
            $college,
        )
            ->when($yearLevel !== null, fn ($query) => $query->where('student_profiles.year_level', $yearLevel))
            ->when($trendSchoolYear !== null, fn ($query) => $query->where('academic_terms.school_year', $trendSchoolYear))
            ->when($trendSemester !== null, fn ($query) => $query->where('academic_terms.semester', $trendSemester))
            ->when($trendSchoolYearFrom !== null, fn ($query) => $query->where('academic_terms.school_year', '>=', $trendSchoolYearFrom))
            ->when($trendSchoolYearTo !== null, fn ($query) => $query->where('academic_terms.school_year', '<=', $trendSchoolYearTo))
            ->select('academic_terms.school_year', 'academic_terms.semester')
            ->selectRaw("COUNT(DISTINCT CASE WHEN enrollments.status = '".EnrollmentStatus::Enrolled->value."' THEN enrollments.student_id END) as aggregate")
            ->groupBy('academic_terms.school_year', 'academic_terms.semester')
            ->orderBy('academic_terms.school_year')
            ->orderBy('academic_terms.semester')
            ->get();

        $yearOverYear = array_values($yearOverYearRows
            ->map(fn ($row): AnalyticsYearOverYearPoint => new AnalyticsYearOverYearPoint(
                schoolYear: (string) $row->school_year,
                semester: (string) $row->semester,
                enrolleeCount: (int) $row->aggregate,
            ))
            ->all());

        return new ProgramChairAnalyticsSummary(
            academicTermId: $term->id,
            college: $college?->value ?? 'all',
            enrollmentStatusCounts: $enrollmentStatusCounts,
            gradeStatusCounts: $gradeStatusCounts,
            retentionBreakdown: $retentionBreakdown,
            yearOverYear: $yearOverYear,
            officialEnrolledCount: $officialEnrolledCount,
            yearLevel: $yearLevel,
        );
    }

    /** @return list<int> */
    private function detailTermIds(
        AcademicTerm $term,
        ?string $trendSchoolYearFrom,
        ?string $trendSchoolYearTo,
    ): array {
        if ($trendSchoolYearFrom === null && $trendSchoolYearTo === null) {
            return [$term->id];
        }

        return AcademicTerm::query()
            ->when($trendSchoolYearFrom !== null, fn ($query) => $query->where('school_year', '>=', $trendSchoolYearFrom))
            ->when($trendSchoolYearTo !== null, fn ($query) => $query->where('school_year', '<=', $trendSchoolYearTo))
            ->pluck('id')
            ->all();
    }

    private function applyCollegeScope(Builder $query, ?CollegeCode $college): Builder
    {
        if ($college !== null) {
            return $query->where('programs.college', $college->value);
        }

        return $query->whereIn(
            'programs.college',
            array_map(
                static fn (CollegeCode $candidate): string => $candidate->value,
                CollegeCode::cases(),
            ),
        );
    }
}
