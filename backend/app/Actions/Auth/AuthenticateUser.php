<?php

namespace App\Actions\Auth;

use App\Domain\Identity\Exceptions\InvalidCredentialsException;
use App\Domain\Identity\UserStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\NewAccessToken;

final class AuthenticateUser
{
    /**
     * Verify credentials and issue a bearer personal access token.
     *
     * Every failure path raises the same exception so the response cannot
     * distinguish a missing account from a wrong password or a disabled one.
     *
     * @return array{user: User, token: NewAccessToken, expiresAt: ?CarbonImmutable}
     *
     * @throws InvalidCredentialsException
     */
    public function handle(string $email, string $password, string $tokenName): array
    {
        $user = User::where('email', $email)->first();

        // Hash::check against a dummy hash when the user is missing keeps the
        // response time comparable, so timing cannot reveal account existence.
        if (! $user instanceof User) {
            Hash::check($password, '$2y$12$'.str_repeat('0', 53));

            throw InvalidCredentialsException::make();
        }

        if (! Hash::check($password, $user->password)) {
            throw InvalidCredentialsException::make();
        }

        if ($user->status !== UserStatus::Active) {
            throw InvalidCredentialsException::make();
        }

        $expiresAt = $this->expiresAt();

        return DB::transaction(function () use ($user, $tokenName, $expiresAt): array {
            $token = $user->createToken($tokenName, ['*'], $expiresAt?->toDateTime());

            $user->forceFill(['last_login_at' => CarbonImmutable::now()])->save();

            return [
                'user' => $user,
                'token' => $token,
                'expiresAt' => $expiresAt,
            ];
        });
    }

    /**
     * Derived from config('sanctum.expiration'), which carries a provisional
     * local default pending the approved institutional policy (PRD §17).
     */
    private function expiresAt(): ?CarbonImmutable
    {
        $minutes = config('sanctum.expiration');

        if (! is_numeric($minutes)) {
            return null;
        }

        return CarbonImmutable::now()->addMinutes((int) $minutes);
    }
}
