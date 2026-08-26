<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Enrollment\BuildCorSnapshot;
use App\Actions\Enrollment\ListEnrollmentDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\EnrollmentDocument\IndexEnrollmentDocumentRequest;
use App\Http\Requests\Api\V1\EnrollmentDocument\ShowEnrollmentDocumentRequest;
use App\Http\Resources\Api\V1\EnrollmentDocumentDetailResource;
use App\Http\Resources\Api\V1\EnrollmentDocumentResource;
use App\Models\EnrollmentDocument;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class EnrollmentDocumentController extends Controller
{
    /**
     * @throws AuthenticationException
     */
    public function index(IndexEnrollmentDocumentRequest $request, ListEnrollmentDocuments $listEnrollmentDocuments): JsonResponse
    {
        $actor = $this->authenticatedUser($request);
        $this->authorize('viewAny', EnrollmentDocument::class);

        $documents = $listEnrollmentDocuments->execute($actor, $request->validated());

        $response = EnrollmentDocumentResource::collection($documents)->response($request);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function show(
        ShowEnrollmentDocumentRequest $request,
        EnrollmentDocument $enrollmentDocument,
        BuildCorSnapshot $buildCorSnapshot,
    ): JsonResponse {
        $this->authenticatedUser($request);
        $this->authorize('view', $enrollmentDocument);

        $this->hydrateLegacyCorSnapshot($enrollmentDocument, $buildCorSnapshot);

        return $this->cachePrivateResponse(
            EnrollmentDocumentDetailResource::make($enrollmentDocument)->response($request),
        );
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
     * The conversion migration may be temporarily unavailable on an existing
     * database. Every enrolled legacy record remains a student record even
     * when an old import has no payment row, so render a transient COR
     * snapshot for this protected response rather than making the student
     * wait for schema privileges. It is never saved: the `cor:backfill`
     * command persists the immutable snapshot once migrated.
     */
    private function hydrateLegacyCorSnapshot(
        EnrollmentDocument $document,
        BuildCorSnapshot $buildCorSnapshot,
    ): void {
        if ($document->snapshot !== null) {
            return;
        }

        $document->loadMissing([
            'enrollment.student.user',
            'enrollment.student.program',
            'enrollment.academicTerm',
            'enrollment.enrollmentSubjects.section.subject',
            'enrollment.assessment.items',
            'enrollment.payment.confirmer',
        ]);
        $document->setAttribute(
            'snapshot',
            $buildCorSnapshot->execute($document->enrollment, $document->enrollment->payment),
        );
    }

    /**
     * `private`: a generated COR is one student's own academic
     * record — no shared cache may retain any response from this endpoint.
     */
    private function cachePrivateResponse(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
