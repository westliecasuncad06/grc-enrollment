<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Academic\CreateTransfereeCredit;
use App\Actions\Academic\ListTransfereeCredits;
use App\Actions\Academic\SuggestCreditSubjects;
use App\Actions\Academic\UpdateTransfereeCredit;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\TransfereeCredit\IndexTransfereeCreditRequest;
use App\Http\Requests\Api\V1\TransfereeCredit\StoreTransfereeCreditRequest;
use App\Http\Requests\Api\V1\TransfereeCredit\UpdateTransfereeCreditRequest;
use App\Http\Resources\Api\V1\CreditSubjectSuggestionResource;
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
     * `action` field. Registrar Staff decide (`approve`, `reject`); anything
     * else — a content edit, `endorse`, `decline` — is the Program Chair's
     * `update`. Same shape as `AcademicGradeController::ABILITY_FOR_ACTION`.
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
     * A request that repeats a still-open one returns that row (200) rather
     * than a duplicate; a new one is 201.
     *
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
        $response->setStatusCode($credit->wasRecentlyCreated ? 201 : 200);

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

        $transfereeCredit->loadMissing('student.program');
        $this->authorize($ability, $ability === 'update' ? $transfereeCredit : TransfereeCredit::class);

        $credit = $updater->execute($transfereeCredit, $request->validated(), $actor, $contextFactory->fromRequest($request));

        return $this->cachePrivateResponse(TransfereeCreditResource::make($credit)->response($request));
    }

    /**
     * Which subjects of the student's curriculum this credit could be mapped
     * to, best first. Advice for the Program Chair, computed on demand and
     * never stored.
     *
     * @throws AuthenticationException
     */
    public function suggestions(
        Request $request,
        TransfereeCredit $transfereeCredit,
        SuggestCreditSubjects $suggester,
    ): JsonResponse {
        $this->authenticatedUser($request);
        $transfereeCredit->loadMissing('student.program');
        $this->authorize('update', $transfereeCredit);

        $response = CreditSubjectSuggestionResource::collection(
            $suggester->execute($transfereeCredit),
        )->response($request);

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
     * `private`: transferee credits carry an academic record — no shared
     * cache may retain any response from these endpoints.
     */
    private function cachePrivateResponse(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
