<?php

namespace App\Actions\Enrollment;

use App\Models\EnrollmentDocument;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * FR-FIN-010: role-scoped read (Student own, Registrar Head all —
 * `EnrollmentDocument::scopeVisibleTo`) plus optional filters and
 * pagination, the same shape as `ListEnrollments`/`ListAcademicGrades`.
 */
final readonly class ListEnrollmentDocuments
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, EnrollmentDocument>
     */
    public function execute(User $actor, array $filters): LengthAwarePaginator
    {
        $enrollmentId = isset($filters['enrollment_id']) ? (int) $filters['enrollment_id'] : null;
        $studentNumber = isset($filters['student_number']) ? trim((string) $filters['student_number']) : null;
        $studentName = isset($filters['student_name']) ? trim((string) $filters['student_name']) : null;
        $documentType = isset($filters['document_type']) ? (string) $filters['document_type'] : null;
        $page = isset($filters['page']) ? (int) $filters['page'] : 1;
        $perPage = isset($filters['per_page']) ? (int) $filters['per_page'] : 20;

        return EnrollmentDocument::query()
            ->visibleTo($actor)
            ->with(['enrollment.student.user'])
            ->when($enrollmentId !== null, fn ($query) => $query->where('enrollment_id', $enrollmentId))
            ->when($studentNumber !== null && $studentNumber !== '', fn ($query) => $query->whereHas(
                'enrollment.student',
                fn ($studentQuery) => $studentQuery->where('student_number', $studentNumber),
            ))
            ->when($studentName !== null && $studentName !== '', function ($query) use ($studentName) {
                $escapedStudentName = addcslashes($studentName, '\\%_');

                return $query->whereHas(
                    'enrollment.student.user',
                    fn ($userQuery) => $userQuery->where('name', 'like', "%{$escapedStudentName}%"),
                );
            })
            ->when($documentType !== null, fn ($query) => $query->where('document_type', $documentType))
            ->orderByDesc('generated_at')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();
    }
}
