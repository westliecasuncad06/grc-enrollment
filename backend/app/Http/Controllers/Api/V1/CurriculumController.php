<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Curriculum\CreateCurriculum;
use App\Actions\Curriculum\TransitionCurriculum;
use App\Actions\Curriculum\UpdateCurriculum;
use App\Domain\Identity\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Curriculum\StoreCurriculumRequest;
use App\Http\Requests\Api\V1\Curriculum\UpdateCurriculumRequest;
use App\Http\Resources\Api\V1\CurriculumResource;
use App\Models\Curriculum;
use App\Models\User;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class CurriculumController extends Controller
{
    private const EAGER_LOAD = ['subjectPlacements.subject', 'subjectPlacements.prerequisites.prerequisiteSubject'];

    /**
     * @throws AuthenticationException
     */
    public function index(Request $request): JsonResponse
    {
        $user = $this->authenticatedUser($request);

        $this->authorize('viewAny', Curriculum::class);

        $curricula = Curriculum::query()
            ->visibleTo($user)
            ->when($user->role === UserRole::ProgramChair && $user->college !== null, fn ($query) => $query->whereHas('program', fn ($programs) => $programs->where('college', $user->college->value)))
            ->with(self::EAGER_LOAD)
            ->orderByDesc('effective_school_year')
            ->orderBy('name')
            ->get();

        return $this->cachePrivateResponse(CurriculumResource::collection($curricula)->response($request));
    }

    /**
     * @throws AuthenticationException
     */
    public function store(
        StoreCurriculumRequest $request,
        CreateCurriculum $action,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $user = $this->authenticatedUser($request);
        $this->authorize('create', Curriculum::class);

        $curriculum = $action->execute($user, [
            'program_id' => $request->validated('program_id'),
            'name' => $request->validated('name'),
            'effective_school_year' => $request->validated('effective_school_year'),
        ], $request->subjects(), $contextFactory->fromRequest($request));

        $response = CurriculumResource::make($curriculum)->response($request);
        $response->setStatusCode(201);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function update(
        UpdateCurriculumRequest $request,
        Curriculum $curriculum,
        UpdateCurriculum $action,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $user = $this->authenticatedUser($request);
        $this->authorize('update', $curriculum);

        $curriculum = $action->execute($user, [
            'name' => $request->validated('name'),
            'effective_school_year' => $request->validated('effective_school_year'),
        ], $request->subjects(), $curriculum, $contextFactory->fromRequest($request));

        return $this->cachePrivateResponse(CurriculumResource::make($curriculum)->response($request));
    }

    /**
     * Which Policy ability governs each transition action — one route
     * serves the Program Chair, Dean, and Executive Director instead of a
     * single `role:` middleware, matching ScheduleProposalController.
     *
     * @var array<string, string>
     */
    private const ABILITY_FOR_ACTION = [
        'submit' => 'submit',
        'dean_approve' => 'approveAsDean',
        'dean_return' => 'approveAsDean',
        'executive_approve' => 'approveAsExecutive',
        'executive_return' => 'approveAsExecutive',
    ];

    /**
     * @throws AuthenticationException
     */
    public function transition(
        Request $request,
        Curriculum $curriculum,
        TransitionCurriculum $action,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $user = $this->authenticatedUser($request);

        $validated = $request->validate([
            'action' => ['required', 'string', Rule::in(array_keys(self::ABILITY_FOR_ACTION))],
            'reason' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        $ability = self::ABILITY_FOR_ACTION[$validated['action']];
        $ability === 'submit'
            ? $this->authorize($ability, $curriculum)
            : $this->authorize($ability, Curriculum::class);

        $curriculum = $action->execute(
            $curriculum,
            $validated['action'],
            $user,
            $validated['reason'] ?? null,
            $contextFactory->fromRequest($request),
        );

        return $this->cachePrivateResponse(CurriculumResource::make($curriculum)->response($request));
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
