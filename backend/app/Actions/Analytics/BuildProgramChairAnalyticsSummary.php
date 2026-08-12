<?php

namespace App\Actions\Analytics;

use App\Domain\Academic\GradeStatus;
use App\Domain\Analytics\AnalyticsYearOverYearPoint;
use App\Domain\Analytics\ProgramChairAnalyticsSummary;
use App\Domain\Analytics\RetentionBreakdownRow;
use App\Domain\Enrollment\EnrollmentStatus;
use App\Domain\Organization\CollegeCode;
use App\Models\AcademicTerm;
use Illuminate\Support\Facades\DB;

/**
 * Program-Chair-scoped counterpart to BuildEnrollmentSummary/
 * BuildInstitutionSummary (see ADR 0017): a college-scoped aggregate rather
 * than term-wide/all-colleges or institution-wide. Every count here is a
 * `DB::table(...)`/`selectRaw` row count, never Eloquent model hydration,
 * and grouping is driven exclusively by EnrollmentStatus/GradeStatus — the
 * two PRD-authoritative enums — never a provisional-vocabulary enum, and
 * `payments.amount` is never touched.
 *
 * The Diagnostic crosstab groups by (GradeStatus, EnrollmentStatus)
 * lifecycle stage, not a pass/fail rate: config('enrollment.grading.*')
 * is explicitly not yet a signed-off GRC decision (see config/enrollment.php),
 * so no passing-grade rule is asserted here.
 */
final readonly class BuildProgramChairAnalyticsSummary
{
    public function execute(AcademicTerm $term, CollegeCode $college): ProgramChairAnalyticsSummary
    {
        $enrollmentStatusRows = DB::table('enrollments')
            ->join('student_profiles', 'student_profiles.id', '=', 'enrollments.student_id')
            ->join('programs', 'programs.id', '=', 'student_profiles.program_id')
            ->where('programs.college', $college->value)
            ->where('enrollments.academic_term_id', $term->id)
            ->select('enrollments.status')
            ->selectRaw('count(*) as aggregate')
            ->groupBy('enrollments.status')
            ->pluck('aggregate', 'status');

        $enrollmentStatusCounts = [];
        foreach (EnrollmentStatus::cases() as $status) {
            $enrollmentStatusCounts[$status->value] = (int) ($enrollmentStatusRows[$status->value] ?? 0);
        }

        // Diagnostic: GradeStatus x EnrollmentStatus lifecycle crosstab, this
        // term+college. gradeStatusCounts is derived from the same crosstab
        // (summed across enrollment statuses) so the marginal total and the
        // matrix can never drift apart.
        $crosstabRows = DB::table('academic_grades')
            ->join('student_profiles', 'student_profiles.id', '=', 'academic_grades.student_id')
            ->join('programs', 'programs.id', '=', 'student_profiles.program_id')
            ->join('enrollments', function ($join): void {
                $join->on('enrollments.student_id', '=', 'academic_grades.student_id')
                    ->on('enrollments.academic_term_id', '=', 'academic_grades.academic_term_id');
            })
            ->where('programs.college', $college->value)
            ->where('academic_grades.academic_term_id', $term->id)
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

        // Year-over-year: same enrollments -> student_profiles -> programs
        // join chain as the Descriptive query above, plus academic_terms for
        // the (school_year, semester) grouping key — but deliberately NOT
        // filtered to $term, unlike Descriptive/Diagnostic.
        $yearOverYearRows = DB::table('enrollments')
            ->join('student_profiles', 'student_profiles.id', '=', 'enrollments.student_id')
            ->join('programs', 'programs.id', '=', 'student_profiles.program_id')
            ->join('academic_terms', 'academic_terms.id', '=', 'enrollments.academic_term_id')
            ->where('programs.college', $college->value)
            ->select('academic_terms.school_year', 'academic_terms.semester')
            ->selectRaw('count(*) as aggregate')
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
            college: $college->value,
            enrollmentStatusCounts: $enrollmentStatusCounts,
            gradeStatusCounts: $gradeStatusCounts,
            retentionBreakdown: $retentionBreakdown,
            yearOverYear: $yearOverYear,
        );
    }
}
