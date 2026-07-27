<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Actions\Auth\AuthenticateUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Auth\LoginRequest;
use App\Http\Resources\Api\V1\AuthResource;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

final class LoginController extends Controller
{
    private const MAX_ATTEMPTS = 5;

    private const DECAY_SECONDS = 60;

    public function __invoke(LoginRequest $request, AuthenticateUser $authenticate): AuthResource
    {
        $throttleKey = $request->throttleKey();

        $this->ensureNotRateLimited($throttleKey);

        try {
            $session = $authenticate->handle(
                $request->email(),
                $request->password(),
                'spa-'.$request->ip(),
            );
        } catch (\Throwable $exception) {
            RateLimiter::hit($throttleKey, self::DECAY_SECONDS);

            throw $exception;
        }

        RateLimiter::clear($throttleKey);

        return AuthResource::make($session);
    }

    private function ensureNotRateLimited(string $throttleKey): void
    {
        if (! RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            return;
        }

        throw new TooManyRequestsHttpException(
            RateLimiter::availableIn($throttleKey),
            'Too many login attempts.',
        );
    }
}
