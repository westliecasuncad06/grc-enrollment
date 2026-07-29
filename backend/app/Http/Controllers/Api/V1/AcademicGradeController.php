<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Academic\ListAcademicGrades;
use App\Actions\Academic\RecordAcademicGrade;
use App\Actions\Academic\UpdateAcademicGrade;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AcademicGrade\IndexAcademicGradeRequest;
use App\Http\Requests\Api\V1\AcademicGrade\StoreAcademicGradeRequest;
use App\Http\Requests\Api\V1\AcademicGrade\UpdateAcademicGradeRequest;
use App\Http\Resources\Api\V1\AcademicGradeResource;
use App\Models\AcademicGrade;
use App\Models\User;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AcademicGradeController extends Controller
{
    /**
     * Which Policy ability governs a PATCH, resolved from the request's
     * `action` field — no `action` means a plain content edit. Same shape
     * as `EnrollmentController::ABILITY_FOR_ACTION` (ADR 0011).
     *
     * @var array<string, string>
     */
    private const ABILITY_FOR_ACTION = [
        'submit' => 'submit',
        'lock' => 'lock',
    ];

    /**
     * @throws AuthenticationException
     */
    public function index(IndexAcademicGradeRequest $request, ListAcademicGrades $listAcademicGrades): JsonResponse
    {
        $actor = $this->authenticatedUser($request);
        $this->authorize('viewAny', AcademicGrade::class);

        $grades = $listAcademicGrades->execute($actor, $request->validated());

        $response = AcademicGradeResource::collection($grades)->response($request);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function store(
        StoreAcademicGradeRequest $request,
        RecordAcademicGrade $recorder,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('create', AcademicGrade::class);

        $grade = $recorder->execute($request->validated(), $actor, $contextFactory->fromRequest($request));

        $response = AcademicGradeResource::make($grade)->response($request);
        $response->setStatusCode(201);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function update(
        UpdateAcademicGradeRequest $request,
        AcademicGrade $academicGrade,
        UpdateAcademicGrade $updater,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);

        $action = $request->validated('action');
        $ability = is_string($action) && isset(self::ABILITY_FOR_ACTION[$action])
            ? self::ABILITY_FOR_ACTION[$action]
            : 'update';

        $this->authorize($ability, $academicGrade);

        $grade = $updater->execute($academicGrade, $request->validated(), $actor, $contextFactory->fromRequest($request));

        return $this->cachePrivateResponse(AcademicGradeResource::make($grade)->response($request));
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
     * `private`: grade records are academic data — no shared cache may
     * retain any response from these endpoints.
     */
    private function cachePrivateResponse(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
