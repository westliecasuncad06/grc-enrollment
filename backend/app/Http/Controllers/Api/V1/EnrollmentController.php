<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Enrollment\ConfirmPayment;
use App\Actions\Enrollment\ListEnrollments;
use App\Actions\Enrollment\RequestWithdrawal;
use App\Actions\Enrollment\SubmitEnrollment;
use App\Actions\Enrollment\TransitionEnrollment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Enrollment\ConfirmPaymentRequest;
use App\Http\Requests\Api\V1\Enrollment\IndexEnrollmentRequest;
use App\Http\Requests\Api\V1\Enrollment\StoreEnrollmentRequest;
use App\Http\Requests\Api\V1\Enrollment\UpdateEnrollmentRequest;
use App\Http\Requests\Api\V1\WithdrawalRequest\StoreWithdrawalRequestRequest;
use App\Http\Resources\Api\V1\EnrollmentResource;
use App\Http\Resources\Api\V1\PaymentConfirmationResource;
use App\Http\Resources\Api\V1\WithdrawalRequestResource;
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
     * Which Policy ability governs each transition action — see
     * EnrollmentPolicy and ADR 0011 for why one route serves two Registrar
     * Head checkpoints instead of a single `role:` middleware.
     *
     * @var array<string, string>
     */
    private const ABILITY_FOR_ACTION = [
        'registrar_approve' => 'decideApproval',
        'registrar_reject' => 'decideApproval',
        'void' => 'void',
    ];

    /**
     * @throws AuthenticationException
     */
    public function index(IndexEnrollmentRequest $request, ListEnrollments $listEnrollments): JsonResponse
    {
        $actor = $this->authenticatedUser($request);
        $this->authorize('viewAny', Enrollment::class);

        $enrollments = $listEnrollments->execute($actor, $request->validated());

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
    public function update(
        UpdateEnrollmentRequest $request,
        Enrollment $enrollment,
        TransitionEnrollment $transitioner,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);

        $action = $request->validated('action');
        $ability = self::ABILITY_FOR_ACTION[$action];

        $this->authorize($ability, Enrollment::class);

        $enrollment = $transitioner->execute(
            $enrollment,
            $action,
            $actor,
            $request->validated('reason'),
            $contextFactory->fromRequest($request),
        );

        $response = EnrollmentResource::make($enrollment)->response($request);

        return $this->cachePrivateResponse($response);
    }

    /**
     * FR-FIN-007–009: idempotent — a repeat call returns the existing
     * payment/document rather than erroring or duplicating either. `201`
     * is returned only the first time; a repeat call gets `200` since
     * nothing new was created.
     *
     * @throws AuthenticationException
     */
    public function confirmPayment(
        ConfirmPaymentRequest $request,
        Enrollment $enrollment,
        ConfirmPayment $confirmPayment,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('confirmPayment', Enrollment::class);

        $result = $confirmPayment->execute($enrollment, $request->validated(), $actor, $contextFactory->fromRequest($request));

        $response = PaymentConfirmationResource::make($result['enrollment'])->response($request);
        $response->setStatusCode($result['created'] ? 201 : 200);

        return $this->cachePrivateResponse($response);
    }

    /**
     * FR-FIN-004 / PRD §4.2 rule 7: Student-only, own enrollment, only from
     * `enrolled`. Creates a `pending` `WithdrawalRequest` — never touches
     * the enrollment or releases a seat directly; that happens only once
     * Registrar Staff approves it (`WithdrawalRequestController::update`).
     *
     * @throws AuthenticationException
     */
    public function withdraw(
        StoreWithdrawalRequestRequest $request,
        Enrollment $enrollment,
        RequestWithdrawal $requestWithdrawal,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('withdraw', $enrollment);

        $withdrawalRequest = $requestWithdrawal->execute(
            $enrollment,
            $request->validated('reason'),
            $actor,
            $contextFactory->fromRequest($request),
        );

        $response = WithdrawalRequestResource::make($withdrawalRequest)->response($request);
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
