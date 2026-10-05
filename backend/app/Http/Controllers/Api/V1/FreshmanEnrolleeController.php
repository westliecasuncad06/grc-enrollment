<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Enrollment\ListFreshmanEnrollees;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StudentProfile\IndexFreshmanEnrolleeRequest;
use App\Http\Resources\Api\V1\FreshmanEnrolleeResource;
use App\Models\StudentProfile;
use Illuminate\Http\JsonResponse;

/**
 * Registrar Staff and the Registrar Head's read-only list of freshmen who pay first
 * (ADR 0043). There is no write here: a freshman's enrollment needs no Registrar
 * approval, so this is where the Registrar sees who was enrolled, where, and who is
 * still waiting for a section.
 */
final class FreshmanEnrolleeController extends Controller
{
    public function index(IndexFreshmanEnrolleeRequest $request, ListFreshmanEnrollees $listFreshmanEnrollees): JsonResponse
    {
        $this->authorize('viewFreshmanEnrollees', StudentProfile::class);

        $response = FreshmanEnrolleeResource::collection($listFreshmanEnrollees->execute($request->validated()))->response($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
