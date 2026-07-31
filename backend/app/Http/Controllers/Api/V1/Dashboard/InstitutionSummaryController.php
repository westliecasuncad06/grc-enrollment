<?php

namespace App\Http\Controllers\Api\V1\Dashboard;

use App\Actions\Dashboard\BuildInstitutionSummary;
use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\Dashboard\InstitutionSummaryResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class InstitutionSummaryController extends Controller
{
    public function __invoke(
        Request $request,
        BuildInstitutionSummary $buildInstitutionSummary,
    ): JsonResponse {
        $this->authorize('view-institution-summary');

        $summary = $buildInstitutionSummary->execute();

        $response = InstitutionSummaryResource::make($summary)->response($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
