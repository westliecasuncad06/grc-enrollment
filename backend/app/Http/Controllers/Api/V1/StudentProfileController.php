<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Identity\ListAdmissionStudentProfiles;
use App\Actions\Identity\ProvisionStudent;
use App\Actions\Identity\SendStudentAccountSetupInvitation;
use App\Actions\Identity\UpdateStudentProfile;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StudentProfile\IndexStudentProfileRequest;
use App\Http\Requests\Api\V1\StudentProfile\StoreStudentProfileRequest;
use App\Http\Requests\Api\V1\StudentProfile\UpdateStudentProfileRequest;
use App\Http\Resources\Api\V1\StudentProfileResource;
use App\Models\StudentProfile;
use App\Models\User;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class StudentProfileController extends Controller
{
    public function index(
        IndexStudentProfileRequest $request,
        ListAdmissionStudentProfiles $listProfiles,
    ): JsonResponse {
        $this->authorize('viewAny', StudentProfile::class);

        return $this->cachePrivateResponse(
            StudentProfileResource::collection($listProfiles->handle($request->validated()))->response($request),
        );
    }

    /**
     * @throws AuthenticationException
     */
    public function store(
        StoreStudentProfileRequest $request,
        ProvisionStudent $provisioner,
        SendStudentAccountSetupInvitation $sendInvitation,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('create', StudentProfile::class);

        $profile = $provisioner->handle([
            'first_name' => $request->validated('first_name'),
            'middle_initial' => $request->validated('middle_initial'),
            'last_name' => $request->validated('last_name'),
            'suffix' => $request->validated('suffix'),
            'email' => $request->validated('email'),
            'address' => $request->validated('address'),
            'student_number' => $request->validated('student_number'),
            'program_id' => $request->validated('program_id'),
            'entry_year' => $request->validated('entry_year'),
            'year_level' => $request->validated('year_level'),
            'enrollment_category' => $request->validated('enrollment_category'),
            'financial_status' => $request->validated('financial_status'),
        ], $actor, $contextFactory->fromRequest($request));

        $sendInvitation->handle($profile, $actor, $contextFactory->fromRequest($request));
        $profile->refresh();

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

        $profile = StudentProfile::query()
            ->with(['user', 'program', 'curriculum'])
            ->withExists('enrollments')
            ->where('user_id', $user->id)
            ->firstOrFail();

        $this->authorize('view', $profile);

        return $this->cachePrivateResponse(StudentProfileResource::make($profile)->response($request));
    }

    public function showForAdmission(Request $request, StudentProfile $studentProfile): JsonResponse
    {
        $this->authorize('view', $studentProfile);
        $studentProfile->load(['user', 'program', 'curriculum'])->loadExists('enrollments');

        return $this->cachePrivateResponse(StudentProfileResource::make($studentProfile)->response($request));
    }

    public function update(
        UpdateStudentProfileRequest $request,
        StudentProfile $studentProfile,
        UpdateStudentProfile $updateProfile,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('update', $studentProfile);

        $updated = $updateProfile->handle(
            $studentProfile,
            $request->validated(),
            $actor,
            $contextFactory->fromRequest($request),
        );
        $updated->loadExists('enrollments');

        return $this->cachePrivateResponse(StudentProfileResource::make($updated)->response($request));
    }

    public function resendSetupInvitation(
        Request $request,
        StudentProfile $studentProfile,
        SendStudentAccountSetupInvitation $sendInvitation,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('update', $studentProfile);
        $studentProfile->load('user');
        $sendInvitation->handle($studentProfile, $actor, $contextFactory->fromRequest($request));
        $studentProfile->refresh()->load(['user', 'program', 'curriculum'])->loadExists('enrollments');

        return $this->cachePrivateResponse(StudentProfileResource::make($studentProfile)->response($request));
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
