<?php

namespace App\Actions\Identity;

use App\Domain\Identity\AdmissionIntakeDefaults;
use App\Domain\Identity\AdmissionRequirementCategory;
use App\Models\AdmissionRequirementType;

/**
 * The Admission requirements a new student of a given year level is asked for, before any
 * student record exists (the Create Account checklist, stakeholder Doc 20). The student type is
 * derived from the year level exactly as `ProvisionStudent` derives it (`AdmissionIntakeDefaults`):
 * Year 1 is a Freshman, Years 2-4 are Transferees, and Additional applies to everyone.
 */
final class ListApplicableAdmissionRequirements
{
    /**
     * @return array{student_type: string, student_type_label: string, categories: list<array{category: string, label: string, items: list<array{requirement_type_id: int, name: string, is_system: bool}>}>}
     */
    public function execute(int $yearLevel): array
    {
        $studentType = AdmissionIntakeDefaults::studentTypeFor($yearLevel);
        $categories = AdmissionRequirementCategory::forStudentType($studentType);

        $types = AdmissionRequirementType::query()
            ->where('is_active', true)
            ->whereIn('category', array_map(static fn (AdmissionRequirementCategory $category): string => $category->value, $categories))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $groups = [];
        foreach ($categories as $category) {
            $groups[] = [
                'category' => $category->value,
                'label' => $category->label(),
                'items' => array_values($types
                    ->where('category', $category)
                    ->map(static fn (AdmissionRequirementType $type): array => [
                        'requirement_type_id' => $type->id,
                        'name' => $type->name,
                        'is_system' => $type->is_system,
                    ])
                    ->all()),
            ];
        }

        return [
            'student_type' => $studentType->value,
            'student_type_label' => $studentType->label(),
            'categories' => $groups,
        ];
    }

    /**
     * @return list<int>
     */
    public function applicableIds(int $yearLevel): array
    {
        $ids = [];
        foreach ($this->execute($yearLevel)['categories'] as $group) {
            foreach ($group['items'] as $item) {
                $ids[] = $item['requirement_type_id'];
            }
        }

        return $ids;
    }
}
