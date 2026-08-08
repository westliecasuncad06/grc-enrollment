<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Scheduling\BuildFacultyLoadReport;
use App\Domain\Scheduling\ScheduleGenerationStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\ScheduleGenerationRunResource;
use App\Jobs\GenerateScheduleRecommendations;
use App\Models\AcademicTerm;
use App\Models\AcademicTermSectionPlan;
use App\Models\ScheduleGenerationRun;
use App\Models\SectionDemandForecast;
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
                ->whereIn('status', [ScheduleGenerationStatus::Queued->value, ScheduleGenerationStatus::Running->value])
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

    public function show(Request $request, ScheduleGenerationRun $scheduleGenerationRun, BuildFacultyLoadReport $facultyLoadReport): JsonResponse
    {
        $this->authorize('view', $scheduleGenerationRun);

        return response()->json(['data' => array_merge(
            (new ScheduleGenerationRunResource($scheduleGenerationRun))->resolve($request),
            $this->result($scheduleGenerationRun, $facultyLoadReport),
        )]);
    }

    public function latest(Request $request, AcademicTerm $academicTerm, BuildFacultyLoadReport $facultyLoadReport): JsonResponse
    {
        $user = $this->authenticatedUser($request);
        $college = $user->college?->value;
        if ($college === null) {
            throw ValidationException::withMessages(['college' => 'A college-scoped Program Chair is required.']);
        }
        $run = ScheduleGenerationRun::query()
            ->where('academic_term_id', $academicTerm->id)
            ->where('college', $college)
            ->latest('id')
            ->first();
        if ($run === null) {
            return response()->json(['data' => null]);
        }
        $this->authorize('view', $run);

        return response()->json(['data' => array_merge(
            (new ScheduleGenerationRunResource($run))->resolve($request),
            $this->result($run, $facultyLoadReport),
        )]);
    }

    /** @return array<string, mixed> */
    private function result(ScheduleGenerationRun $run, BuildFacultyLoadReport $facultyLoadReport): array
    {
        $forecasts = $run->prediction_run_id === null ? collect() : SectionDemandForecast::query()
            ->with('subject')
            ->where('prediction_run_id', $run->prediction_run_id)
            ->orderBy('year_level')
            ->orderBy('subject_id')
            ->get()
            ->map(fn (SectionDemandForecast $forecast): array => [
                'subject_id' => $forecast->subject_id,
                'subject_code' => $forecast->subject->code,
                'subject_title' => $forecast->subject->title,
                'year_level' => $forecast->year_level,
                'predicted_demand' => (float) $forecast->predicted_demand,
                'suggested_section_count' => $forecast->suggested_section_count,
                'confidence_lower' => $forecast->confidence_lower === null ? null : (float) $forecast->confidence_lower,
                'confidence_upper' => $forecast->confidence_upper === null ? null : (float) $forecast->confidence_upper,
                'historical_basis' => [
                    'school_year' => $forecast->historical_school_year,
                    'semester' => $forecast->historical_semester,
                    'year_level' => $forecast->historical_year_level,
                ],
                'rationale' => $forecast->rationale ?? [],
            ]);
        $metrics = $run->predictionRun?->metrics ?? [];

        return [
            'model' => [
                'strategy' => $metrics['strategy'] ?? null,
                'model_version' => $run->predictionRun?->model_version,
                'training_observation_count' => $metrics['training_observation_count'] ?? $metrics['observation_count'] ?? 0,
                'mae' => $metrics['mae'] ?? null,
                'rmse' => $metrics['rmse'] ?? null,
            ],
            'forecasts' => $forecasts->values()->all(),
            'section_block_recommendations' => AcademicTermSectionPlan::query()
                ->with('curriculum.program')
                ->where('academic_term_id', $run->academic_term_id)
                ->where('college', $run->college)
                ->orderBy('year_level')
                ->get()
                ->map(fn (AcademicTermSectionPlan $plan): array => [
                    'program_code' => $plan->curriculum->program->code,
                    'program_name' => $plan->curriculum->program->name,
                    'year_level' => $plan->year_level,
                    'recommended_block_sections' => $plan->recommended_section_count ?? $plan->section_count,
                    'students_per_block' => $plan->students_per_block,
                    'is_overridden' => $plan->recommendation_is_overridden,
                ])->values()->all(),
            'faculty_load' => $facultyLoadReport->execute($run->academicTerm, $run->college),
        ];
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
