<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\CollegeCode;
use App\Domain\Organization\ProgramStatus;
use App\Models\Curriculum;
use App\Models\Program;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class CurriculumEndpointLockTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function chairToken(): string
    {
        User::create([
            'name' => 'Test program_chair',
            'email' => 'chair@grc.test',
            'password' => self::PASSWORD,
            'role' => UserRole::ProgramChair,
            'college' => CollegeCode::Ccs,
            'status' => UserStatus::Active,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => 'chair@grc.test',
            'password' => self::PASSWORD,
        ])->json('data.token');
    }

    private function makeProgram(): Program
    {
        return Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'college' => CollegeCode::Ccs, 'status' => ProgramStatus::Active]);
    }

    public function test_a_created_curriculum_always_starts_as_draft_even_if_status_is_sent(): void
    {
        $token = $this->chairToken();
        $program = $this->makeProgram();

        $response = $this->withToken($token)->postJson('/api/v1/curricula', [
            'program_id' => $program->id,
            'name' => 'BSCS Curriculum 2026-2027',
            'effective_school_year' => '2026-2027',
            'status' => 'active',
            'subjects' => [],
        ]);

        $response->assertCreated();
        self::assertSame('draft', $response->json('data.status'));
    }

    public function test_update_is_rejected_once_the_curriculum_has_left_draft(): void
    {
        $token = $this->chairToken();
        $program = $this->makeProgram();
        $curriculum = Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSCS Curriculum 2026-2027',
            'effective_school_year' => '2026-2027',
            'status' => CurriculumStatus::PendingDeanReview,
        ]);

        $response = $this->withToken($token)->patchJson("/api/v1/curricula/{$curriculum->id}", [
            'name' => 'BSCS Curriculum 2026-2027 (edited)',
            'effective_school_year' => '2026-2027',
            'subjects' => [],
        ]);

        $response->assertUnprocessable();
        $curriculum->refresh();
        self::assertSame('BSCS Curriculum 2026-2027', $curriculum->name);
    }

    public function test_update_still_succeeds_while_the_curriculum_is_draft(): void
    {
        $token = $this->chairToken();
        $program = $this->makeProgram();
        $curriculum = Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSCS Curriculum 2026-2027',
            'effective_school_year' => '2026-2027',
            'status' => CurriculumStatus::Draft,
        ]);

        $response = $this->withToken($token)->patchJson("/api/v1/curricula/{$curriculum->id}", [
            'name' => 'BSCS Curriculum 2026-2027 (edited)',
            'effective_school_year' => '2026-2027',
            'subjects' => [],
        ]);

        $response->assertOk();
        self::assertSame('BSCS Curriculum 2026-2027 (edited)', $response->json('data.name'));
    }
}
