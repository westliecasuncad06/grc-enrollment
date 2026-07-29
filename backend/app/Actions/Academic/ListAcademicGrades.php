<?php

namespace App\Actions\Academic;

use App\Models\AcademicGrade;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Role-scoped read (Student own, Faculty own sections, Registrar Head all —
 * `AcademicGrade::scopeVisibleTo`) plus optional filters and pagination, the
 * same shape as `App\Actions\Enrollment\ListEnrollments`.
 */
final readonly class ListAcademicGrades
{
    /**
     * @param  array<string, mixed>  $filters
     * @return LengthAwarePaginator<int, AcademicGrade>
     */
    public function execute(User $actor, array $filters): LengthAwarePaginator
    {
        $studentId = isset($filters['student_id']) ? (int) $filters['student_id'] : null;
        $subjectId = isset($filters['subject_id']) ? (int) $filters['subject_id'] : null;
        $academicTermId = isset($filters['academic_term_id']) ? (int) $filters['academic_term_id'] : null;
        $status = isset($filters['status']) ? (string) $filters['status'] : null;
        $page = isset($filters['page']) ? (int) $filters['page'] : 1;
        $perPage = isset($filters['per_page']) ? (int) $filters['per_page'] : 20;

        return AcademicGrade::query()
            ->visibleTo($actor)
            ->with(['student', 'subject', 'section'])
            ->when($studentId !== null, fn ($query) => $query->where('student_id', $studentId))
            ->when($subjectId !== null, fn ($query) => $query->where('subject_id', $subjectId))
            ->when($academicTermId !== null, fn ($query) => $query->where('academic_term_id', $academicTermId))
            ->when($status !== null, fn ($query) => $query->where('status', $status))
            ->orderByDesc('academic_term_id')
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page)
            ->withQueryString();
    }
}
