<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\ActivateStaffAccount;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\StaffAccountSetupRequest;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Http\JsonResponse;

final class StaffAccountSetupController extends Controller
{
    public function __invoke(
        StaffAccountSetupRequest $request,
        ActivateStaffAccount $activate,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $activate->handle(
            $request->validated('email'),
            $request->validated('code'),
            $request->validated('password'),
            $request->validated('name'),
            $contextFactory->fromRequest($request),
        );

        return response()->json([
            'data' => [
                'type' => 'staff-account-setup',
                'status' => 'active',
            ],
        ])->header('Cache-Control', 'no-store, private');
    }
}
