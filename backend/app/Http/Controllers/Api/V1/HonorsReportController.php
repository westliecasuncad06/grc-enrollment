<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Academic\BuildHonorsReport;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Reports\IndexHonorsRequest;
use App\Http\Resources\Api\V1\HonorStudentResource;
use App\Models\AcademicTerm;
use Illuminate\Http\JsonResponse;

final class HonorsReportController extends Controller
{
    public function __invoke(IndexHonorsRequest $request, BuildHonorsReport $report): JsonResponse
    {
        $this->authorize('view-honors-report');
        $validated = $request->validated();
        $term = AcademicTerm::query()->findOrFail($validated['academic_term_id']);
        $page = (int) ($validated['page'] ?? 1);
        $pageSize = (int) ($validated['page_size'] ?? 25);
        $results = $report->execute($term, $validated, $page, $pageSize);

        $response = HonorStudentResource::collection($results)
            ->additional(['summary' => ['qualifier_count' => $results->total()]])
            ->response($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
