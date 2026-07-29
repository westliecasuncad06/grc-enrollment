<?php

namespace App\Support\Audit;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Audit\AuditRequestContext;
use App\Models\AuditLog;
use App\Models\User;
use InvalidArgumentException;

final class AuditRecorder
{
    /** @var list<string> */
    private const SECRET_KEY_FRAGMENTS = ['password', 'token', 'secret'];

    /** @var list<string> */
    private const CONTACT_DATA_KEYS = ['email', 'phone', 'mobile', 'address'];

    /**
     * @param  ?array<string, mixed>  $beforeValues
     * @param  ?array<string, mixed>  $afterValues
     */
    public function record(
        User $actor,
        string $action,
        string $auditableType,
        ?int $auditableId,
        ?array $beforeValues,
        ?array $afterValues,
        ?string $reason,
        AuditRequestContext $context,
    ): AuditLog {
        $this->validate($action, $auditableType, $reason, $context);
        $this->assertSafePayload($beforeValues);
        $this->assertSafePayload($afterValues);

        return AuditLog::create([
            'actor_user_id' => $actor->id,
            'action' => $action,
            'auditable_type' => $auditableType,
            'auditable_id' => $auditableId,
            'before_values' => $beforeValues,
            'after_values' => $afterValues,
            'reason' => $reason,
            'request_id' => $context->requestId,
            'ip_address' => $context->ipAddress,
        ]);
    }

    private function validate(string $action, string $auditableType, ?string $reason, AuditRequestContext $context): void
    {
        if (trim($action) === '' || ! in_array($action, AuditAction::values(), true)) {
            throw new InvalidArgumentException('The audit action must be a known, non-blank value.');
        }

        if (trim($auditableType) === '' || ! in_array($auditableType, AuditableType::values(), true)) {
            throw new InvalidArgumentException('The auditable type must be a known, non-blank value.');
        }

        if (trim($context->requestId) === '') {
            throw new InvalidArgumentException('The audit request ID must not be blank.');
        }

        if ($reason !== null && trim($reason) === '') {
            throw new InvalidArgumentException('The audit reason must not be blank when supplied.');
        }
    }

    /**
     * @param  ?array<string, mixed>  $payload
     */
    private function assertSafePayload(?array $payload): void
    {
        if ($payload === null) {
            return;
        }

        foreach ($payload as $key => $value) {
            $normalizedKey = $this->normalizeKey((string) $key);

            if ($this->isForbiddenKey($normalizedKey)) {
                throw new InvalidArgumentException('Audit payloads may not contain secrets or contact data.');
            }

            if (is_array($value)) {
                $this->assertSafePayload($value);
            }
        }
    }

    private function normalizeKey(string $key): string
    {
        $normalized = preg_replace('/[^a-z0-9]+/', '_', strtolower($key));

        return trim($normalized ?? '', '_');
    }

    private function isForbiddenKey(string $key): bool
    {
        foreach (self::CONTACT_DATA_KEYS as $fragment) {
            if (str_contains($key, $fragment)) {
                return true;
            }
        }

        foreach (self::SECRET_KEY_FRAGMENTS as $fragment) {
            if (str_contains($key, $fragment)) {
                return true;
            }
        }

        return false;
    }
}
