<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Identity\ProvisionStudent;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StudentProfile\StoreStudentProfileRequest;
use App\Http\Resources\Api\V1\StudentProfileResource;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class StudentProfileController extends Controller
{
    /**
     * @throws AuthenticationException
     */
    public function store(StoreStudentProfileRequest $request, ProvisionStudent $provisioner): JsonResponse
    {
        $this->authenticatedUser($request);
        $this->authorize('create', StudentProfile::class);

        $profile = $provisioner->handle([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
            'password' => $request->validated('password'),
            'student_number' => $request->validated('student_number'),
            'program_id' => $request->validated('program_id'),
            'curriculum_id' => $request->validated('curriculum_id'),
            'year_level' => $request->validated('year_level'),
        ]);

        $response = StudentProfileResource::make($profile)->response($request);
        $response->setStatusCode(201);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function show(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        $profile = StudentProfile::query()->where('user_id', $user->id)->firstOrFail();

        $this->authorize('view', $profile);

        return $this->cachePrivateResponse(StudentProfileResource::make($profile)->response($request));
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
     * `private`: this is one user's own record — no shared cache may retain
     * any response from these endpoints.
     */
    private function cachePrivateResponse(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
