<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Enrollment\ListEnrollmentDocuments;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\EnrollmentDocument\IndexEnrollmentDocumentRequest;
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
    private function authenticatedUser(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        return $user;
    }

    /**
     * `private`: a generated Digital COM is one student's own academic
     * record — no shared cache may retain any response from this endpoint.
     */
    private function cachePrivateResponse(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
