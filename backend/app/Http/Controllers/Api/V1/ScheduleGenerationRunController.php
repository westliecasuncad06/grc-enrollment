<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Scheduling\ScheduleGenerationStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\ScheduleGenerationRunResource;
use App\Jobs\GenerateScheduleRecommendations;
use App\Models\AcademicTerm;
use App\Models\ScheduleGenerationRun;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ScheduleGenerationRunController extends Controller
{
    public function store(Request $request, AcademicTerm $academicTerm): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $this->authorize('create', [ScheduleGenerationRun::class, $academicTerm]);
        $college = $user->college?->value;

        if ($college === null) {
            throw ValidationException::withMessages(['college' => 'A college-scoped Program Chair is required.']);
        }

        [$run, $created] = DB::transaction(function () use ($academicTerm, $college, $user): array {
            $active = ScheduleGenerationRun::query()
                ->where('academic_term_id', $academicTerm->id)
                ->where('college', $college)
                ->lockForUpdate()
                ->latest('id')
                ->first();

            if ($active !== null) {
                return [$active, false];
            }

            return [ScheduleGenerationRun::create([
                'academic_term_id' => $academicTerm->id,
                'college' => $college,
                'initiated_by' => $user->id,
                'status' => ScheduleGenerationStatus::Queued,
            ]), true];
        });

        if ($created) {
            GenerateScheduleRecommendations::dispatch($run->id);
        }

        $response = (new ScheduleGenerationRunResource($run))->response($request);
        $response->setStatusCode($created ? 201 : 200);

        return $response;
    }

    public function show(Request $request, ScheduleGenerationRun $scheduleGenerationRun): JsonResponse
    {
        $this->authorize('view', $scheduleGenerationRun);

        return (new ScheduleGenerationRunResource($scheduleGenerationRun))->response($request);
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
