<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\AcademicTermResource;
use App\Models\AcademicTerm;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AcademicTermController extends Controller
{
    /**
     * @throws AuthenticationException
     */
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        $this->authorize('viewAny', AcademicTerm::class);

        $terms = AcademicTerm::query()
            ->visibleTo($user)
            ->orderByDesc('school_year')
            ->orderBy('semester')
            ->get();

        $response = AcademicTermResource::collection($terms)->response($request);

        // `private`: a student and a program chair receive different bodies
        // from this same URL, so no shared cache may retain either response.
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
