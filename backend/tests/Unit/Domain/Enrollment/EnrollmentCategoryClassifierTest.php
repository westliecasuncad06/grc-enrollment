<?php

namespace Tests\Unit\Domain\Enrollment;

use App\Domain\Academic\GradeMark;
use App\Domain\Curriculum\SemesterSlot;
use App\Domain\Enrollment\CurriculumPlacementSlot;
use App\Domain\Enrollment\EnrollmentCategory;
use App\Domain\Enrollment\EnrollmentCategoryClassifier;
use PHPUnit\Framework\TestCase;

final class EnrollmentCategoryClassifierTest extends TestCase
{
    private function slot(
        int $subjectId,
        string $code,
        int $yearLevel,
        SemesterSlot $semester,
        bool $required = true,
    ): CurriculumPlacementSlot {
        return new CurriculumPlacementSlot($subjectId, $code, $yearLevel, $semester, $required);
    }

    public function test_a_clean_record_is_regular(): void
    {
        $placements = [
            $this->slot(1, 'CS101', 1, SemesterSlot::First),
            $this->slot(2, 'CS102', 1, SemesterSlot::Second),
        ];
        $marks = [1 => GradeMark::Good, 2 => GradeMark::Passed];

        // Currently in year 1, 2nd sem in progress -> ordinal 2 -> only ordinal 1 (CS101) has "completed".
        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 2);

        self::assertSame(EnrollmentCategory::Regular, $verdict->category);
        self::assertSame([], $verdict->reasons);
        self::assertTrue($verdict->isRegular());
    }

    public function test_a_failing_grade_in_a_completed_semester_makes_the_student_irregular(): void
    {
        $placements = [$this->slot(1, 'CS101', 1, SemesterSlot::First)];
        $marks = [1 => GradeMark::Failed];

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 2);

        self::assertSame(EnrollmentCategory::Irregular, $verdict->category);
        self::assertSame('failing_grade', $verdict->reasons[0]['code']);
        self::assertStringContainsString('CS101', $verdict->reasons[0]['message']);
    }

    public function test_an_incomplete_mark_makes_the_student_irregular(): void
    {
        $placements = [$this->slot(1, 'CS101', 1, SemesterSlot::First)];
        $marks = [1 => GradeMark::Incomplete];

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 2);

        self::assertSame(EnrollmentCategory::Irregular, $verdict->category);
        self::assertSame('incomplete_mark', $verdict->reasons[0]['code']);
    }

    public function test_a_not_complete_mark_on_a_leadership_subject_makes_the_student_irregular(): void
    {
        $placements = [$this->slot(1, 'LEAD 1', 1, SemesterSlot::First)];
        $marks = [1 => GradeMark::NotComplete];

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 2);

        self::assertSame(EnrollmentCategory::Irregular, $verdict->category);
        self::assertSame('not_complete_mark', $verdict->reasons[0]['code']);
    }

    public function test_a_dropped_subject_makes_the_student_irregular(): void
    {
        $placements = [$this->slot(1, 'CS101', 1, SemesterSlot::First)];
        $marks = [1 => GradeMark::Dropped];

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 2);

        self::assertSame(EnrollmentCategory::Irregular, $verdict->category);
        self::assertSame('dropped_subject', $verdict->reasons[0]['code']);
    }

    public function test_a_missing_required_subject_in_a_completed_semester_makes_the_student_irregular(): void
    {
        $placements = [$this->slot(1, 'CS101', 1, SemesterSlot::First, required: true)];
        $marks = []; // no locked grade at all

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 2);

        self::assertSame(EnrollmentCategory::Irregular, $verdict->category);
        self::assertSame('missing_required_subject', $verdict->reasons[0]['code']);
    }

    public function test_a_missing_optional_subject_does_not_affect_standing(): void
    {
        $placements = [$this->slot(1, 'ELEC1', 1, SemesterSlot::First, required: false)];
        $marks = [];

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 2);

        self::assertTrue($verdict->isRegular());
    }

    public function test_a_missing_subject_in_a_future_semester_does_not_affect_standing(): void
    {
        // Currently at ordinal 1 (year 1, 1st sem) -- year 1 2nd sem (ordinal 2) hasn't happened yet.
        $placements = [$this->slot(1, 'CS102', 1, SemesterSlot::Second, required: true)];
        $marks = [];

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 1);

        self::assertTrue($verdict->isRegular());
    }

    public function test_a_missing_subject_in_the_current_in_progress_semester_does_not_affect_standing(): void
    {
        // The student's current semester itself is never "completed" yet.
        $placements = [$this->slot(1, 'CS102', 1, SemesterSlot::Second, required: true)];
        $marks = [];

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 2);

        self::assertTrue($verdict->isRegular());
    }

    public function test_a_previously_failed_subject_that_was_later_passed_on_retake_is_regular_again(): void
    {
        // The caller only ever passes the LATEST locked mark per subject —
        // this test documents that the classifier itself has no retake
        // logic; it trusts whatever single mark it is given per subject.
        $placements = [$this->slot(1, 'CS101', 1, SemesterSlot::First)];
        $marks = [1 => GradeMark::Passed];

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 2);

        self::assertTrue($verdict->isRegular());
    }

    public function test_a_completion_mark_of_c_on_a_leadership_subject_does_not_affect_standing(): void
    {
        $placements = [$this->slot(1, 'LEAD 1', 1, SemesterSlot::First)];
        $marks = [1 => GradeMark::Complete];

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 2);

        self::assertTrue($verdict->isRegular());
    }

    public function test_multiple_issues_all_appear_as_separate_reasons(): void
    {
        $placements = [
            $this->slot(1, 'CS101', 1, SemesterSlot::First),
            $this->slot(2, 'CS102', 1, SemesterSlot::Second),
        ];
        $marks = [1 => GradeMark::Failed, 2 => GradeMark::Incomplete];

        $verdict = EnrollmentCategoryClassifier::classify($marks, $placements, 3);

        self::assertCount(2, $verdict->reasons);
        self::assertSame(['failing_grade', 'incomplete_mark'], array_column($verdict->reasons, 'code'));
    }
}
