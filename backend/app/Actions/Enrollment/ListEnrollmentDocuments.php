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
        $documentType = isset($filters['document_type']) ? (string) $filters['document_type'] : null;
        $page = isset($filters['page']) ? (int) $filters['page'] : 1;
        $perPage = isset($filters['per_page']) ? (int) $filters['per_page'] : 20;

        return EnrollmentDocument::query()
            ->visibleTo($actor)
            ->with(['enrollment.student'])
            ->when($enrollmentId !== null, fn ($query) => $query->where('enrollment_id', $enrollmentId))
            ->when($documentType !== null, fn ($query) => $query->where('document_type', $documentType))
            ->orderByDesc('generated_at')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();
    }
}
