<?php

namespace Tests\Feature\Api\V1\ItControl;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Jobs\RunItControlAutomationStep;
use App\Models\AcademicTerm;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class AutomationRunsEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_requests_are_unauthenticated(): void
    {
        $this->getJson('/api/v1/it-control/automation-runs')
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }

    public function test_it_queues_a_run_and_reports_progress(): void
    {
        $itAdmin = $this->makeUser('it-admin', UserRole::ItAdmin);
        $term = $this->makeCurrentTerm();

        $response = $this->withToken($this->tokenFor($itAdmin))
            ->postJson('/api/v1/it-control/automation-runs', ['step' => 'dean_approve_all']);

        $response->assertCreated()
            ->assertJsonPath('data.type', 'it-control-automation-run')
            ->assertJsonPath('data.step', 'dean_approve_all')
            ->assertJsonPath('data.academic_term_id', $term->id)
            ->assertJsonPath('data.status', 'succeeded')
            ->assertJsonPath('data.processed_count', 0)
            ->assertJsonPath('data.failed_count', 0)
            ->assertJsonPath('data.warnings', []);

        $this->withToken($this->tokenFor($itAdmin))
            ->getJson('/api/v1/it-control/automation-runs/'.$response->json('data.id'))
            ->assertOk()
            ->assertJsonStructure(['data' => ['status', 'processed_count', 'failed_count', 'warnings']]);
    }

    public function test_a_sync_queue_failure_returns_the_persisted_terminal_resource(): void
    {
        $itAdmin = $this->makeUser('it-admin-sync-failure', UserRole::ItAdmin);
        $this->makeCurrentTerm();

        $response = $this->withToken($this->tokenFor($itAdmin))
            ->postJson('/api/v1/it-control/automation-runs', ['step' => 'students_auto_enroll']);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'failed')
            ->assertJsonPath('data.error_summary', 'IT-control automation run failed. Review the run details and retry.');
        $this->assertDatabaseHas('it_control_automation_runs', [
            'id' => $response->json('data.id'),
            'status' => 'failed',
        ]);
    }

    public function test_it_lists_only_run_history_for_the_current_term(): void
    {
        $itAdmin = $this->makeUser('it-admin-history', UserRole::ItAdmin);
        $term = $this->makeCurrentTerm();
        $offTerm = AcademicTerm::create([
            'school_year' => '2025-2026',
            'semester' => '2nd',
            'status' => AcademicTermStatus::Archived,
        ]);
        $olderRunId = DB::table('it_control_automation_runs')->insertGetId([
            'step' => 'chair_generate_sections',
            'academic_term_id' => $term->id,
            'status' => 'succeeded',
            'processed_count' => 4,
            'failed_count' => 0,
            'initiated_by' => $itAdmin->id,
            'completed_at' => now()->subMinute(),
            'created_at' => now()->subMinute(),
            'updated_at' => now()->subMinute(),
        ]);
        $newerRunId = DB::table('it_control_automation_runs')->insertGetId([
            'step' => 'registrar_approve_all',
            'academic_term_id' => $term->id,
            'status' => 'partial',
            'processed_count' => 3,
            'failed_count' => 1,
            'warnings' => json_encode(['One record needs review.'], JSON_THROW_ON_ERROR),
            'initiated_by' => $itAdmin->id,
            'completed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $offTermSucceededRunId = DB::table('it_control_automation_runs')->insertGetId([
            'step' => 'chair_generate_sections',
            'academic_term_id' => $offTerm->id,
            'status' => 'succeeded',
            'processed_count' => 4,
            'failed_count' => 0,
            'initiated_by' => $itAdmin->id,
            'completed_at' => now()->addSecond(),
            'created_at' => now()->addSecond(),
            'updated_at' => now()->addSecond(),
        ]);
        $offTermActiveRunId = DB::table('it_control_automation_runs')->insertGetId([
            'step' => 'dean_approve_all',
            'academic_term_id' => $offTerm->id,
            'status' => 'running',
            'processed_count' => 1,
            'failed_count' => 0,
            'initiated_by' => $itAdmin->id,
            'started_at' => now()->addSeconds(2),
            'created_at' => now()->addSeconds(2),
            'updated_at' => now()->addSeconds(2),
        ]);

        $response = $this->withToken($this->tokenFor($itAdmin))
            ->getJson('/api/v1/it-control/automation-runs');

        $response->assertOk()
            ->assertJsonPath('data.0.id', $newerRunId)
            ->assertJsonPath('data.0.failed_count', 1)
            ->assertJsonPath('data.1.id', $olderRunId)
            ->assertJsonPath('meta.total', 2)
            ->assertJsonMissing(['id' => $offTermSucceededRunId])
            ->assertJsonMissing(['id' => $offTermActiveRunId]);
    }

    public function test_it_refuses_to_run_outside_local_and_testing(): void
    {
        $itAdmin = $this->makeUser('it-admin-production', UserRole::ItAdmin);
        $this->makeCurrentTerm();
        $originalEnvironment = app()->environment();

        app()->detectEnvironment(static fn (): string => 'production');

        try {
            $this->withToken($this->tokenFor($itAdmin))
                ->postJson('/api/v1/it-control/automation-runs', ['step' => 'dean_approve_all'])
                ->assertForbidden()
                ->assertJsonPath('error.code', 'FORBIDDEN');
        } finally {
            app()->detectEnvironment(static fn (): string => $originalEnvironment);
        }
    }

    public function test_it_refuses_an_invalid_payload_outside_local_and_testing_before_validation(): void
    {
        $itAdmin = $this->makeUser('it-admin-production-invalid', UserRole::ItAdmin);
        $this->makeCurrentTerm();
        $originalEnvironment = app()->environment();

        app()->detectEnvironment(static fn (): string => 'production');

        try {
            $this->withToken($this->tokenFor($itAdmin))
                ->postJson('/api/v1/it-control/automation-runs', ['step' => 'not-a-valid-step'])
                ->assertForbidden()
                ->assertJsonPath('error.code', 'FORBIDDEN');
        } finally {
            app()->detectEnvironment(static fn (): string => $originalEnvironment);
        }
    }

    public function test_it_rejects_a_second_run_of_the_same_step_while_one_is_active(): void
    {
        Queue::fake();
        $itAdmin = $this->makeUser('it-admin-active-run', UserRole::ItAdmin);
        $this->makeCurrentTerm();

        $this->withToken($this->tokenFor($itAdmin))
            ->postJson('/api/v1/it-control/automation-runs', ['step' => 'dean_approve_all'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'queued');

        $this->withToken($this->tokenFor($itAdmin))
            ->postJson('/api/v1/it-control/automation-runs', ['step' => 'dean_approve_all'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'CONFLICT');

        Queue::assertPushed(RunItControlAutomationStep::class, 1);
    }

    #[DataProvider('otherRoles')]
    public function test_every_other_role_is_forbidden(UserRole $role): void
    {
        $this->withToken($this->tokenFor($this->makeUser('forbidden-'.$role->value, $role)))
            ->getJson('/api/v1/it-control/automation-runs')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    /** @return iterable<string, array{UserRole}> */
    public static function otherRoles(): iterable
    {
        foreach (UserRole::cases() as $role) {
            if ($role !== UserRole::ItAdmin) {
                yield $role->value => [$role];
            }
        }
    }

    private function makeCurrentTerm(): AcademicTerm
    {
        $term = AcademicTerm::create([
            'school_year' => '2026-2027',
            'semester' => '1st',
            'status' => AcademicTermStatus::SemesterOngoing,
        ]);

        DB::table('academic_term_current_slots')
            ->where('id', 1)
            ->update(['academic_term_id' => $term->id, 'updated_at' => now()]);

        return $term;
    }

    private function makeUser(string $handle, UserRole $role): User
    {
        return User::create([
            'name' => 'User '.$handle,
            'email' => $handle.'@grc.test',
            'password' => 'password',
            'role' => $role,
            'status' => UserStatus::Active,
        ]);
    }

    private function tokenFor(User $user): string
    {
        return $user->createToken('it-control-automation-run-test')->plainTextToken;
    }
}
