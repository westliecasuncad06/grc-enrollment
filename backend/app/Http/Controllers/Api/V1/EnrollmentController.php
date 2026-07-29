<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Enrollment\SubmitEnrollment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Enrollment\StoreEnrollmentRequest;
use App\Http\Resources\Api\V1\EnrollmentResource;
use App\Models\AcademicTerm;
use App\Models\Enrollment;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class EnrollmentController extends Controller
{
    /**
     * @throws AuthenticationException
     */
    public function index(Request $request): JsonResponse
    {
        $actor = $this->authenticatedUser($request);
        $this->authorize('viewAny', Enrollment::class);

        $student = StudentProfile::query()->where('user_id', $actor->id)->firstOrFail();

        $enrollments = Enrollment::query()
            ->where('student_id', $student->id)
            ->with(['enrollmentSubjects.section.subject', 'queueTicket'])
            ->orderByDesc('submitted_at')
            ->orderByDesc('id')
            ->get();

        $response = EnrollmentResource::collection($enrollments)->response($request);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function store(
        StoreEnrollmentRequest $request,
        SubmitEnrollment $submitEnrollment,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('create', Enrollment::class);

        $student = StudentProfile::query()->where('user_id', $actor->id)->firstOrFail();
        $term = AcademicTerm::query()->where('id', $request->validated('academic_term_id'))->firstOrFail();

        $sectionIds = array_values(array_map(
            static fn (array $section): int => (int) $section['section_id'],
            $request->validated('sections'),
        ));

        $enrollment = $submitEnrollment->execute($student, $term, $sectionIds, $actor, $contextFactory->fromRequest($request));

        $response = EnrollmentResource::make($enrollment)->response($request);
        $response->setStatusCode(201);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    private function authenticatedUser(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        return $user;
    }

    /**
     * `private`: this is one student's own enrollment data — no shared cache
     * may retain any response from these endpoints.
     */
    private function cachePrivateResponse(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
