<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\FacultySubjectPreference\StoreFacultySubjectPreferenceRequest;
use App\Http\Requests\Api\V1\FacultySubjectPreference\UpdateFacultySubjectPreferenceRequest;
use App\Http\Resources\Api\V1\FacultySubjectPreferenceResource;
use App\Models\FacultySubjectPreference;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class FacultySubjectPreferenceController extends Controller
{
    /**
     * @throws AuthenticationException
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        $this->authorize('viewAny', FacultySubjectPreference::class);

        $preferences = FacultySubjectPreference::query()
            ->visibleTo($user)
            ->orderBy('academic_term_id')
            ->orderBy('rank')
            ->get();

        return $this->cachePrivateResponse(FacultySubjectPreferenceResource::collection($preferences)->response($request));
    }

    /**
     * @throws AuthenticationException
     */
    public function store(StoreFacultySubjectPreferenceRequest $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $this->authorize('create', FacultySubjectPreference::class);

        $preference = FacultySubjectPreference::create([
            'professor_id' => $user->id,
            'academic_term_id' => $request->validated('academic_term_id'),
            'subject_id' => $request->validated('subject_id'),
            'rank' => $request->validated('rank'),
        ]);

        $response = FacultySubjectPreferenceResource::make($preference)->response($request);
        $response->setStatusCode(201);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function update(
        UpdateFacultySubjectPreferenceRequest $request,
        FacultySubjectPreference $facultySubjectPreference,
    ): JsonResponse {
        $this->authenticatedUser($request);
        $this->authorize('update', $facultySubjectPreference);

        $facultySubjectPreference->update([
            'academic_term_id' => $request->validated('academic_term_id'),
            'subject_id' => $request->validated('subject_id'),
            'rank' => $request->validated('rank'),
        ]);

        return $this->cachePrivateResponse(
            FacultySubjectPreferenceResource::make($facultySubjectPreference)->response($request),
        );
    }

    /**
     * @throws AuthenticationException
     */
    public function destroy(Request $request, FacultySubjectPreference $facultySubjectPreference): JsonResponse
    {
        $this->authenticatedUser($request);
        $this->authorize('delete', $facultySubjectPreference);

        $facultySubjectPreference->delete();

        $response = new JsonResponse(null, 204);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
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
     * `private`: results and authoring rights differ by role, so no shared
     * cache may retain any response from these endpoints.
     */
    private function cachePrivateResponse(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
