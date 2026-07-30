<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Academic\CreateTransfereeCredit;
use App\Actions\Academic\ListTransfereeCredits;
use App\Actions\Academic\UpdateTransfereeCredit;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\TransfereeCredit\IndexTransfereeCreditRequest;
use App\Http\Requests\Api\V1\TransfereeCredit\StoreTransfereeCreditRequest;
use App\Http\Requests\Api\V1\TransfereeCredit\UpdateTransfereeCreditRequest;
use App\Http\Resources\Api\V1\TransfereeCreditResource;
use App\Models\TransfereeCredit;
use App\Models\User;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TransfereeCreditController extends Controller
{
    /**
     * Which Policy ability governs a PATCH, resolved from the request's
     * `action` field — no `action` means a plain content edit. Same shape as
     * `AcademicGradeController::ABILITY_FOR_ACTION`.
     *
     * @var array<string, string>
     */
    private const ABILITY_FOR_ACTION = [
        'approve' => 'decide',
        'reject' => 'decide',
    ];

    /**
     * @throws AuthenticationException
     */
    public function index(IndexTransfereeCreditRequest $request, ListTransfereeCredits $listTransfereeCredits): JsonResponse
    {
        $actor = $this->authenticatedUser($request);
        $this->authorize('viewAny', TransfereeCredit::class);

        $credits = $listTransfereeCredits->execute($actor, $request->validated());

        $response = TransfereeCreditResource::collection($credits)->response($request);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function store(
        StoreTransfereeCreditRequest $request,
        CreateTransfereeCredit $creator,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('create', TransfereeCredit::class);

        $credit = $creator->execute($request->validated(), $actor, $contextFactory->fromRequest($request));

        $response = TransfereeCreditResource::make($credit)->response($request);
        $response->setStatusCode(201);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function update(
        UpdateTransfereeCreditRequest $request,
        TransfereeCredit $transfereeCredit,
        UpdateTransfereeCredit $updater,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);

        $action = $request->validated('action');
        $ability = is_string($action) && isset(self::ABILITY_FOR_ACTION[$action])
            ? self::ABILITY_FOR_ACTION[$action]
            : 'update';

        $this->authorize($ability, TransfereeCredit::class);

        $credit = $updater->execute($transfereeCredit, $request->validated(), $actor, $contextFactory->fromRequest($request));

        return $this->cachePrivateResponse(TransfereeCreditResource::make($credit)->response($request));
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
     * `private`: transferee credits carry an academic record — no shared
     * cache may retain any response from these endpoints.
     */
    private function cachePrivateResponse(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
