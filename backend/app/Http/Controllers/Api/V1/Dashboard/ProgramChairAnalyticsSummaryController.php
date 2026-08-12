<?php

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Analytics\BuildProgramChairAnalyticsSummary;
use App\Domain\Organization\AcademicTermStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Dashboard\IndexDashboardRequest;
use App\Http\Resources\Api\V1\Dashboard\ProgramChairAnalyticsSummaryResource;
use App\Models\AcademicTerm;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class ProgramChairAnalyticsSummaryController extends Controller
{
    public function __invoke(
        IndexDashboardRequest $request,
        BuildProgramChairAnalyticsSummary $buildProgramChairAnalyticsSummary,
    ): JsonResponse {
        $this->authorize('view-analytics');

        $college = $request->user()->college;

        if ($college === null) {
            abort(403, 'No college is assigned to this Program Chair account.');
        }

        $termId = $request->validated('academic_term_id');
        $term = $termId !== null
            ? AcademicTerm::query()->where('id', $termId)->firstOrFail()
            : AcademicTerm::query()->where('status', AcademicTermStatus::SemesterOngoing)->first();

        if (! $term instanceof AcademicTerm) {
            throw new NotFoundHttpException('No academic_term_id was given and no term is currently active.');
        }

        $summary = $buildProgramChairAnalyticsSummary->execute($term, $college);

        $response = ProgramChairAnalyticsSummaryResource::make($summary)->response($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
