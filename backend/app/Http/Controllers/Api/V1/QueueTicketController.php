<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Enrollment\ListQueueTickets;
use App\Actions\Enrollment\TransitionQueueTicket;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\QueueTicket\IndexQueueTicketRequest;
use App\Http\Requests\Api\V1\QueueTicket\UpdateQueueTicketRequest;
use App\Http\Resources\Api\V1\QueueTicketResource;
use App\Models\QueueTicket;
use App\Models\User;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class QueueTicketController extends Controller
{
    /**
     * @throws AuthenticationException
     */
    public function index(IndexQueueTicketRequest $request, ListQueueTickets $listQueueTickets): JsonResponse
    {
        $this->authenticatedUser($request);
        $this->authorize('viewAny', QueueTicket::class);

        $tickets = $listQueueTickets->execute($request->validated());

        $response = QueueTicketResource::collection($tickets)->response($request);

        return $this->cachePrivateResponse($response);
    }

    /**
     * @throws AuthenticationException
     */
    public function update(
        UpdateQueueTicketRequest $request,
        QueueTicket $queueTicket,
        TransitionQueueTicket $transitioner,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $actor = $this->authenticatedUser($request);
        $this->authorize('update', QueueTicket::class);

        $ticket = $transitioner->execute(
            $queueTicket,
            $request->validated('action'),
            $actor,
            $contextFactory->fromRequest($request),
        );

        return $this->cachePrivateResponse(QueueTicketResource::make($ticket)->response($request));
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
     * `private`: the payment queue is Accounting-internal operational
     * data — no shared cache may retain any response from these endpoints.
     */
    private function cachePrivateResponse(JsonResponse $response): JsonResponse
    {
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
