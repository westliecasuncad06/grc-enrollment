<?php

namespace App\Http\Controllers\Api\V1\ItControl;

use App\Domain\ItControl\AutomationRunStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ItControl\StoreAutomationRunRequest;
use App\Http\Resources\Api\V1\ItControl\AutomationRunResource;
use App\Jobs\RunItControlAutomationStep;
use App\Models\ItControlAutomationRun;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AutomationRunController extends Controller
{
    /** @throws AuthenticationException */
    public function index(Request $request): JsonResponse
    {
        $this->authenticatedUser($request);
        $this->authorize('view-it-control-automation-runs');

        $response = AutomationRunResource::collection(
            ItControlAutomationRun::query()->latest('id')->paginate(25),
        )->response($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }

    /** @throws AuthenticationException */
    public function store(StoreAutomationRunRequest $request): JsonResponse
    {
        if (! app()->environment(['local', 'testing'])) {
            abort(403);
        }

        $user = $this->authenticatedUser($request);
        $this->authorize('create-it-control-automation-runs');
        $validated = $request->validated();

        $run = DB::transaction(function () use ($user, $validated): ItControlAutomationRun {
            $academicTermId = DB::table('academic_term_current_slots')
                ->where('id', 1)
                ->lockForUpdate()
                ->value('academic_term_id');

            if (! is_int($academicTermId)) {
                throw ValidationException::withMessages([
                    'academic_term_id' => 'A current academic term is required to run IT-control automation.',
                ]);
            }

            $activeRun = ItControlAutomationRun::query()
                ->where('step', $validated['step'])
                ->where('academic_term_id', $academicTermId)
                ->whereIn('status', [AutomationRunStatus::Queued->value, AutomationRunStatus::Running->value])
                ->lockForUpdate()
                ->latest('id')
                ->first();

            if ($activeRun !== null) {
                abort(409);
            }

            return ItControlAutomationRun::create([
                'step' => $validated['step'],
                'academic_term_id' => $academicTermId,
                'status' => AutomationRunStatus::Queued,
                'initiated_by' => $user->id,
            ]);
        });

        RunItControlAutomationStep::dispatch($run->id);
        $run->refresh();

        $response = (new AutomationRunResource($run))->response($request);
        $response->setStatusCode(201);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }

    /** @throws AuthenticationException */
    public function show(Request $request, ItControlAutomationRun $run): JsonResponse
    {
        $this->authenticatedUser($request);
        $this->authorize('view-it-control-automation-runs');

        $response = (new AutomationRunResource($run))->response($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }

    /** @throws AuthenticationException */
    private function authenticatedUser(Request $request): User
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        return $user;
    }
}
