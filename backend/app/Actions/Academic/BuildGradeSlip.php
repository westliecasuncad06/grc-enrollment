<?php

namespace App\Actions\Academic;

use App\Domain\Academic\GradeMark;
use App\Domain\Academic\GradePointAverage;
use App\Domain\Academic\GradeSlip;
use App\Domain\Academic\SubjectGwaExclusionRule;
use App\Models\AcademicGrade;
use App\Models\AcademicTerm;
use App\Models\StudentProfile;

/**
 * Builds one term's printable grade slip in a single query.
 */
final readonly class BuildGradeSlip
{
    public function execute(StudentProfile $student, AcademicTerm $term): GradeSlip
    {
        $grades = AcademicGrade::query()
            ->where('student_id', $student->id)
            ->where('academic_term_id', $term->id)
            ->with(['subject', 'section.professor'])
            ->orderBy('id')
            ->get();

        /** @var list<array{mark: ?GradeMark, units: float}> $gpaRows */
        $gpaRows = $grades
            ->map(fn (AcademicGrade $grade): array => [
                'mark' => $grade->mark,
                'units' => (float) $grade->subject->units,
                'counts_toward_gpa' => SubjectGwaExclusionRule::countsTowardGwa($grade->subject->code),
            ])
            ->all();

        $excludedFromGpaCount = $grades
            ->filter(fn (AcademicGrade $grade): bool => ! ($grade->mark?->countsTowardGpa() ?? false)
                || ! SubjectGwaExclusionRule::countsTowardGwa($grade->subject->code))
            ->count();

        return new GradeSlip(
            student: $student,
            term: $term,
            grades: array_values($grades->all()),
            totalAcademicUnits: GradePointAverage::academicUnits($gpaRows),
            gpaUnits: GradePointAverage::gpaUnits($gpaRows),
            gpa: GradePointAverage::compute($gpaRows),
            excludedFromGpaCount: $excludedFromGpaCount,
        );
    }
}
