<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\RoomCatalogEntryResource;
use App\Models\RoomCatalogEntry;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RoomCatalogEntryController extends Controller
{
    /** @throws AuthenticationException */
    public function __invoke(Request $request): JsonResponse
    {
        $actor = $request->user();
        if (! $actor instanceof User) {
            throw new AuthenticationException;
        }

        abort_unless($actor->college !== null, 403, 'A college-scoped Program Chair is required.');

        $rooms = RoomCatalogEntry::query()
            ->where('college', $actor->college->value)
            ->orderBy('name')
            ->orderBy('id')
            ->get();

        $response = RoomCatalogEntryResource::collection($rooms)->response($request);
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }
}
