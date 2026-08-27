<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\ActivateStudentAccount;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\AccountSetupRequest;
use App\Support\Audit\AuditRequestContextFactory;
use Illuminate\Http\JsonResponse;

final class AccountSetupController extends Controller
{
    public function __invoke(
        AccountSetupRequest $request,
        ActivateStudentAccount $activate,
        AuditRequestContextFactory $contextFactory,
    ): JsonResponse {
        $activate->handle(
            $request->validated('email'),
            $request->validated('code'),
            $request->validated('password'),
            $contextFactory->fromRequest($request),
        );

        return response()->json([
            'data' => [
                'type' => 'account-setup',
                'status' => 'active',
            ],
        ])->header('Cache-Control', 'no-store, private');
    }
}
