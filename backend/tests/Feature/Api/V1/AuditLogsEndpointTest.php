<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Http\Middleware\AssignRequestId;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class AuditLogsEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_requests_receive_the_standard_unauthenticated_response(): void
    {
        $response = $this
            ->withHeader(AssignRequestId::HEADER, 'anonymous-audit-list')
            ->getJson('/api/v1/audit-logs');

        $response
            ->assertUnauthorized()
            ->assertHeader(AssignRequestId::HEADER, 'anonymous-audit-list')
            ->assertJsonPath('error.code', 'UNAUTHENTICATED')
            ->assertJsonPath('error.request_id', 'anonymous-audit-list');
    }

    #[DataProvider('nonRegistrarRoleProvider')]
    public function test_every_non_registrar_head_role_is_forbidden(UserRole $role): void
    {
        $user = $this->makeUser('forbidden-'.$role->value, $role);
        $token = $this->tokenFor($user);

        $response = $this
            ->withToken($token)
            ->withHeader(AssignRequestId::HEADER, 'audit-forbidden-'.$role->value)
            ->getJson('/api/v1/audit-logs');

        $response
            ->assertForbidden()
            ->assertHeader(AssignRequestId::HEADER, 'audit-forbidden-'.$role->value)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.request_id', 'audit-forbidden-'.$role->value);

        self::assertSame(0, AuditLog::query()->count());
    }

    /**
     * @return iterable<string, array{UserRole}>
     */
    public static function nonRegistrarRoleProvider(): iterable
    {
        foreach (UserRole::cases() as $role) {
            if ($role !== UserRole::RegistrarHead) {
                yield $role->value => [$role];
            }
        }
    }

    public function test_registrar_head_receives_the_exact_resource_pagination_and_private_response_shape(): void
    {
        $reader = $this->makeUser('successful-reader', UserRole::RegistrarHead);
        $actor = $this->makeUser('resource-actor', UserRole::ProgramChair);
        $token = $this->tokenFor($reader);
        $tieTime = '2026-07-10 09:00:00';

        for ($index = 1; $index <= 19; $index++) {
            $this->makeAuditLog(
                $actor,
                AuditAction::CURRICULUM_CREATED,
                AuditableType::CURRICULUM,
                CarbonImmutable::parse($tieTime, 'UTC')->subMinutes($index)->format('Y-m-d H:i:s'),
            );
        }

        $lowerTieId = $this->makeAuditLog(
            $actor,
            AuditAction::SECTION_CREATED,
            AuditableType::SECTION,
            $tieTime,
            501,
            ['status' => 'draft'],
            ['status' => 'published'],
            'Approved fixture.',
            'fixture-resource-lower',
            '203.0.113.41',
        );
        $higherTieId = $this->makeAuditLog(
            $actor,
            AuditAction::SECTION_UPDATED,
            AuditableType::SECTION,
            $tieTime,
            502,
            ['capacity' => 30],
            ['capacity' => 35],
            'Capacity adjusted.',
            'fixture-resource-higher',
            '2001:db8::41',
        );

        $response = $this
            ->withToken($token)
            ->withHeader(AssignRequestId::HEADER, 'audit-list-response-id')
            ->getJson('/api/v1/audit-logs');

        $response
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader(AssignRequestId::HEADER, 'audit-list-response-id')
            ->assertJsonCount(20, 'data')
            ->assertJsonPath('data.0.type', 'audit_log')
            ->assertJsonPath('data.0.id', $higherTieId->id)
            ->assertJsonPath('data.1.id', $lowerTieId->id)
            ->assertJsonPath('data.0.actor_user_id', $actor->id)
            ->assertJsonPath('data.0.actor_role', UserRole::ProgramChair->value)
            ->assertJsonPath('data.0.actor_role_label', UserRole::ProgramChair->label())
            ->assertJsonPath('data.0.action', AuditAction::SECTION_UPDATED)
            ->assertJsonPath('data.0.auditable_type', AuditableType::SECTION)
            ->assertJsonPath('data.0.auditable_id', 502)
            ->assertJsonPath('data.0.before_values.capacity', 30)
            ->assertJsonPath('data.0.after_values.capacity', 35)
            ->assertJsonPath('data.0.reason', 'Capacity adjusted.')
            ->assertJsonPath('data.0.request_id', 'fixture-resource-higher')
            ->assertJsonPath('data.0.ip_address', '2001:db8::41')
            ->assertJsonPath('data.0.created_at', '2026-07-10T09:00:00Z')
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.per_page', 20)
            ->assertJsonPath('meta.total', 21)
            ->assertJsonStructure([
                'links' => ['first', 'last', 'prev', 'next'],
                'meta' => ['current_page', 'last_page', 'per_page', 'total'],
            ]);

        self::assertSame([
            'type',
            'id',
            'actor_user_id',
            'actor_role',
            'actor_role_label',
            'action',
            'auditable_type',
            'auditable_id',
            'before_values',
            'after_values',
            'reason',
            'request_id',
            'ip_address',
            'created_at',
        ], array_keys($response->json('data.0')));
        $response->assertDontSee($actor->name);
        $response->assertDontSee($actor->email);

        self::assertSame(22, AuditLog::query()->count());
        self::assertDatabaseHas('audit_logs', [
            'actor_user_id' => $reader->id,
            'action' => AuditAction::AUDIT_LOG_LIST_VIEWED,
            'request_id' => 'audit-list-response-id',
        ]);
    }

    public function test_action_filter_is_applied(): void
    {
        $reader = $this->makeUser('action-filter-reader', UserRole::RegistrarHead);
        $actor = $this->makeUser('action-filter-actor');
        $token = $this->tokenFor($reader);
        $target = $this->makeAuditLog($actor, AuditAction::SECTION_CREATED, AuditableType::SECTION, '2026-07-10 09:00:00');
        $this->makeAuditLog($actor, AuditAction::CURRICULUM_CREATED, AuditableType::CURRICULUM, '2026-07-10 10:00:00');

        $this->withToken($token)
            ->getJson('/api/v1/audit-logs?action='.AuditAction::SECTION_CREATED)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $target->id)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_auditable_type_filter_is_applied(): void
    {
        $reader = $this->makeUser('type-filter-reader', UserRole::RegistrarHead);
        $actor = $this->makeUser('type-filter-actor');
        $token = $this->tokenFor($reader);
        $target = $this->makeAuditLog($actor, AuditAction::SECTION_CREATED, AuditableType::SECTION, '2026-07-10 09:00:00');
        $this->makeAuditLog($actor, AuditAction::CURRICULUM_CREATED, AuditableType::CURRICULUM, '2026-07-10 10:00:00');

        $this->withToken($token)
            ->getJson('/api/v1/audit-logs?auditable_type='.AuditableType::SECTION)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $target->id)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_actor_user_id_filter_is_applied(): void
    {
        $reader = $this->makeUser('actor-filter-reader', UserRole::RegistrarHead);
        $targetActor = $this->makeUser('actor-filter-target');
        $otherActor = $this->makeUser('actor-filter-other');
        $token = $this->tokenFor($reader);
        $target = $this->makeAuditLog($targetActor, AuditAction::SECTION_CREATED, AuditableType::SECTION, '2026-07-10 09:00:00');
        $this->makeAuditLog($otherActor, AuditAction::SECTION_CREATED, AuditableType::SECTION, '2026-07-10 10:00:00');

        $this->withToken($token)
            ->getJson('/api/v1/audit-logs?actor_user_id='.$targetActor->id)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $target->id)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_from_filter_is_inclusive_from_the_start_of_its_utc_date(): void
    {
        $reader = $this->makeUser('from-filter-reader', UserRole::RegistrarHead);
        $actor = $this->makeUser('from-filter-actor');
        $token = $this->tokenFor($reader);
        $target = $this->makeAuditLog($actor, AuditAction::SECTION_CREATED, AuditableType::SECTION, '2026-07-10 00:00:00');
        $this->makeAuditLog($actor, AuditAction::SECTION_CREATED, AuditableType::SECTION, '2026-07-09 23:59:59');

        $this->withToken($token)
            ->getJson('/api/v1/audit-logs?from=2026-07-10')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $target->id)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_to_filter_is_inclusive_through_the_end_of_its_utc_date(): void
    {
        $reader = $this->makeUser('to-filter-reader', UserRole::RegistrarHead);
        $actor = $this->makeUser('to-filter-actor');
        $token = $this->tokenFor($reader);
        $target = $this->makeAuditLog($actor, AuditAction::SECTION_CREATED, AuditableType::SECTION, '2026-07-10 23:59:59');
        $this->makeAuditLog($actor, AuditAction::SECTION_CREATED, AuditableType::SECTION, '2026-07-11 00:00:00');

        $this->withToken($token)
            ->getJson('/api/v1/audit-logs?to=2026-07-10')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $target->id)
            ->assertJsonPath('meta.total', 1);
    }

    public function test_page_size_page_number_and_filter_are_preserved_in_pagination(): void
    {
        $reader = $this->makeUser('pagination-reader', UserRole::RegistrarHead);
        $actor = $this->makeUser('pagination-actor');
        $token = $this->tokenFor($reader);

        for ($index = 1; $index <= 3; $index++) {
            $this->makeAuditLog(
                $actor,
                AuditAction::SECTION_CREATED,
                AuditableType::SECTION,
                '2026-07-10 0'.$index.':00:00',
            );
        }

        $response = $this->withToken($token)
            ->getJson('/api/v1/audit-logs?action='.AuditAction::SECTION_CREATED.'&per_page=1&page=2');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.last_page', 3)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonPath('meta.total', 3);

        $nextLink = $response->json('links.next');
        self::assertIsString($nextLink);
        parse_str((string) parse_url($nextLink, PHP_URL_QUERY), $query);
        self::assertSame([
            'action' => AuditAction::SECTION_CREATED,
            'per_page' => '1',
            'page' => '3',
        ], $query);
    }

    public function test_per_page_accepts_the_inclusive_one_to_one_hundred_bounds(): void
    {
        $reader = $this->makeUser('page-bounds-reader', UserRole::RegistrarHead);
        $token = $this->tokenFor($reader);

        $this->withToken($token)
            ->getJson('/api/v1/audit-logs?per_page=1')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 1);

        $this->withToken($token)
            ->getJson('/api/v1/audit-logs?per_page=100')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 100);
    }

    #[DataProvider('invalidQueryProvider')]
    public function test_invalid_query_values_receive_the_standard_validation_response(
        string $query,
        string $field,
    ): void {
        $reader = $this->makeUser('invalid-'.md5($query), UserRole::RegistrarHead);
        $token = $this->tokenFor($reader);

        $response = $this
            ->withToken($token)
            ->withHeader(AssignRequestId::HEADER, 'audit-invalid-'.md5($query))
            ->getJson('/api/v1/audit-logs?'.$query);

        $response
            ->assertUnprocessable()
            ->assertHeader(AssignRequestId::HEADER, 'audit-invalid-'.md5($query))
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonPath('error.message', 'The submitted data is invalid.')
            ->assertJsonPath('error.request_id', 'audit-invalid-'.md5($query))
            ->assertJsonStructure(['error' => ['errors' => [$field]]]);

        self::assertSame(0, AuditLog::query()->count());
    }

    /**
     * @return iterable<string, array{string, string}>
     */
    public static function invalidQueryProvider(): iterable
    {
        yield 'unknown action' => ['action=unknown.action', 'action'];
        yield 'unknown auditable type' => ['auditable_type=unknown_type', 'auditable_type'];
        yield 'nonexistent actor' => ['actor_user_id=999999', 'actor_user_id'];
        yield 'malformed from date' => ['from=not-a-date', 'from'];
        yield 'malformed to date' => ['to=not-a-date', 'to'];
        yield 'to before from' => ['from=2026-07-11&to=2026-07-10', 'to'];
        yield 'page below one' => ['page=0', 'page'];
        yield 'per page below one' => ['per_page=0', 'per_page'];
        yield 'per page above one hundred' => ['per_page=101', 'per_page'];
    }

    private function makeUser(string $handle, UserRole $role = UserRole::Student): User
    {
        return User::create([
            'name' => 'Private name '.$handle,
            'email' => $handle.'@private.grc.test',
            'password' => 'irrelevant-password',
            'role' => $role,
            'status' => UserStatus::Active,
        ]);
    }

    private function tokenFor(User $user): string
    {
        return $user->createToken('audit-log-test')->plainTextToken;
    }

    /**
     * @param  ?array<string, mixed>  $beforeValues
     * @param  ?array<string, mixed>  $afterValues
     */
    private function makeAuditLog(
        User $actor,
        string $action,
        string $auditableType,
        string $createdAt,
        ?int $auditableId = 100,
        ?array $beforeValues = null,
        ?array $afterValues = null,
        ?string $reason = null,
        ?string $requestId = null,
        ?string $ipAddress = null,
    ): AuditLog {
        $timestamp = CarbonImmutable::parse($createdAt, 'UTC');
        $id = DB::table('audit_logs')->insertGetId([
            'actor_user_id' => $actor->id,
            'action' => $action,
            'auditable_type' => $auditableType,
            'auditable_id' => $auditableId,
            'before_values' => $beforeValues === null ? null : json_encode($beforeValues, JSON_THROW_ON_ERROR),
            'after_values' => $afterValues === null ? null : json_encode($afterValues, JSON_THROW_ON_ERROR),
            'reason' => $reason,
            'request_id' => $requestId ?? 'fixture-'.uniqid(),
            'ip_address' => $ipAddress,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);

        return AuditLog::query()->findOrFail($id);
    }
}
