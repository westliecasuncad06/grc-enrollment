<?php

namespace App\Support\Audit;

use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\SubjectPrerequisite;

final class CurriculumAuditSnapshot
{
    /**
     * @return array{
     *     program_id: int,
     *     name: string,
     *     effective_school_year: string,
     *     status: string,
     *     subjects: list<array{
     *         subject_id: int,
     *         year_level: int,
     *         semester: string,
     *         is_required: bool,
     *         prerequisites: list<array{prerequisite_subject_id: int, minimum_grade: string}>
     *     }>
     * }
     */
    public function capture(Curriculum $curriculum): array
    {
        $curriculum->load('subjectPlacements.prerequisites');

        $subjects = $curriculum->subjectPlacements
            ->sortBy('subject_id')
            ->map(static function (CurriculumSubject $placement): array {
                $prerequisites = $placement->prerequisites
                    ->sortBy('prerequisite_subject_id')
                    ->map(static fn (SubjectPrerequisite $prerequisite): array => [
                        'prerequisite_subject_id' => $prerequisite->prerequisite_subject_id,
                        'minimum_grade' => $prerequisite->minimum_grade,
                    ])
                    ->values()
                    ->all();

                return [
                    'subject_id' => $placement->subject_id,
                    'year_level' => $placement->year_level,
                    'semester' => $placement->semester,
                    'is_required' => $placement->is_required,
                    'prerequisites' => array_values($prerequisites),
                ];
            })
            ->values()
            ->all();

        return [
            'program_id' => $curriculum->program_id,
            'name' => $curriculum->name,
            'effective_school_year' => $curriculum->effective_school_year,
            'status' => $curriculum->status->value,
            'subjects' => array_values($subjects),
        ];
    }
}
