<?php

namespace Tests\Feature\Policies;

use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\Curriculum;
use App\Models\Program;
use App\Models\User;
use App\Policies\CurriculumPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class CurriculumPolicyTest extends TestCase
{
    use RefreshDatabase;

    private function makeUser(UserRole $role): User
    {
        return User::create([
            'name' => 'Test '.$role->value,
            'email' => $role->value.'@grc.test',
            'password' => 'irrelevant-password',
            'role' => $role,
            'status' => UserStatus::Active,
        ]);
    }

    private function makeCurriculum(CurriculumStatus $status): Curriculum
    {
        $program = Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);

        return Curriculum::create([
            'program_id' => $program->id,
            'name' => 'BSCS Curriculum',
            'effective_school_year' => '2026-2027',
            'status' => $status,
        ]);
    }

    public function test_every_role_may_view_any(): void
    {
        $policy = new CurriculumPolicy;

        self::assertTrue($policy->viewAny($this->makeUser(UserRole::Faculty)));
        self::assertTrue($policy->viewAny($this->makeUser(UserRole::RegistrarHead)));
    }

    public function test_a_learner_scoped_role_cannot_view_a_draft_curriculum_by_direct_id(): void
    {
        $policy = new CurriculumPolicy;
        $faculty = $this->makeUser(UserRole::Faculty);
        $draft = $this->makeCurriculum(CurriculumStatus::Draft);

        self::assertFalse($policy->view($faculty, $draft));
    }

    public function test_a_planning_role_can_view_a_draft_curriculum_by_direct_id(): void
    {
        $policy = new CurriculumPolicy;
        $dean = $this->makeUser(UserRole::Dean);
        $draft = $this->makeCurriculum(CurriculumStatus::Draft);

        self::assertTrue($policy->view($dean, $draft));
    }

    public function test_only_a_program_chair_may_create_a_curriculum(): void
    {
        $policy = new CurriculumPolicy;

        self::assertTrue($policy->create($this->makeUser(UserRole::ProgramChair)));
        self::assertFalse($policy->create($this->makeUser(UserRole::Dean)));
        self::assertFalse($policy->create($this->makeUser(UserRole::Student)));
    }

    public function test_only_a_program_chair_may_update_a_curriculum(): void
    {
        $policy = new CurriculumPolicy;
        $curriculum = $this->makeCurriculum(CurriculumStatus::Draft);

        self::assertTrue($policy->update($this->makeUser(UserRole::ProgramChair), $curriculum));
        self::assertFalse($policy->update($this->makeUser(UserRole::RegistrarHead), $curriculum));
    }
}
