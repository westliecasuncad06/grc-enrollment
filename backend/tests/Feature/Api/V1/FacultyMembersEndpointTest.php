<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditableType;
use App\Domain\Audit\AuditAction;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class FacultyMembersEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_requests_receive_the_standard_unauthenticated_response(): void
    {
        $this->getJson('/api/v1/faculty-members')
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }

    #[DataProvider('nonChairRoleProvider')]
    public function test_every_non_program_chair_role_is_forbidden(UserRole $role): void
    {
        $user = $this->makeUser('forbidden-'.$role->value, $role);

        $this->withToken($this->tokenFor($user))
            ->getJson('/api/v1/faculty-members')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');

        self::assertSame(0, AuditLog::query()->count());
    }

    public function test_program_chair_receives_active_faculty_only_in_name_then_id_order_with_an_audit_record(): void
    {
        $chair = $this->makeUser('directory-chair', UserRole::ProgramChair);
        $firstFaculty = $this->makeUser('directory-first', UserRole::Faculty, 'Ada Faculty');
        $secondFaculty = $this->makeUser('directory-second', UserRole::Faculty, 'Ada Faculty');
        $disabledFaculty = $this->makeUser('directory-disabled', UserRole::Faculty, 'Disabled Faculty', UserStatus::Disabled);
        $nonFaculty = $this->makeUser('directory-non-faculty', UserRole::Dean, 'Dean User');

        $response = $this->withToken($this->tokenFor($chair))
            ->getJson('/api/v1/faculty-members');

        $response
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.type', 'faculty_member')
            ->assertJsonPath('data.0.id', $firstFaculty->id)
            ->assertJsonPath('data.0.name', 'Ada Faculty')
            ->assertJsonPath('data.0.status', UserStatus::Active->value)
            ->assertJsonPath('data.0.status_label', 'Active')
            ->assertJsonPath('data.1.id', $secondFaculty->id);

        self::assertSame(
            ['type', 'id', 'name', 'status', 'status_label'],
            array_keys($response->json('data.0')),
        );
        $response->assertDontSee($firstFaculty->email);
        $response->assertDontSee($secondFaculty->email);
        $response->assertDontSee($disabledFaculty->email);
        $response->assertDontSee($nonFaculty->email);
        self::assertNull($response->json('data.2'));

        $this->assertDatabaseHas('audit_logs', [
            'actor_user_id' => $chair->id,
            'action' => AuditAction::FACULTY_DIRECTORY_LIST_VIEWED,
            'auditable_type' => AuditableType::FACULTY_DIRECTORY,
            'auditable_id' => null,
            'after_values->result_count' => 2,
        ]);
    }

    public function test_an_audit_write_failure_returns_no_directory_payload(): void
    {
        $chair = $this->makeUser('failing-directory-chair', UserRole::ProgramChair);
        $this->makeUser('failing-directory-faculty', UserRole::Faculty);

        AuditLog::creating(static function (): never {
            throw new \RuntimeException('Injected audit write failure.');
        });

        try {
            $response = $this->withToken($this->tokenFor($chair))
                ->getJson('/api/v1/faculty-members');

            $response
                ->assertStatus(500)
                ->assertJsonPath('data', null);

            self::assertSame(0, AuditLog::query()->count());
        } finally {
            AuditLog::flushEventListeners();
            AuditLog::clearBootedModels();
        }
    }

    /**
     * @return iterable<string, array{UserRole}>
     */
    public static function nonChairRoleProvider(): iterable
    {
        foreach (UserRole::cases() as $role) {
            if ($role !== UserRole::ProgramChair) {
                yield $role->value => [$role];
            }
        }
    }

    private function makeUser(
        string $handle,
        UserRole $role = UserRole::Student,
        ?string $name = null,
        UserStatus $status = UserStatus::Active,
    ): User {
        return User::create([
            'name' => $name ?? 'Faculty directory '.$handle,
            'email' => $handle.'@private.grc.test',
            'password' => 'irrelevant-password',
            'role' => $role,
            'status' => $status,
        ]);
    }

    private function tokenFor(User $user): string
    {
        return $user->createToken('faculty-member-test')->plainTextToken;
    }
}
