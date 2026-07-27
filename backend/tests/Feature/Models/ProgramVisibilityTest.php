<?php

namespace Tests\Feature\Models;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\Program;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ProgramVisibilityTest extends TestCase
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

    public function test_learner_scoped_role_sees_only_active_programs(): void
    {
        Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);
        Program::create(['code' => 'BSIT', 'name' => 'BS Information Technology', 'status' => ProgramStatus::Inactive]);

        $student = $this->makeUser(UserRole::Student);

        $visible = Program::query()->visibleTo($student)->pluck('code')->all();

        self::assertSame(['BSCS'], $visible);
    }

    public function test_planning_role_sees_every_program_regardless_of_status(): void
    {
        Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);
        Program::create(['code' => 'BSIT', 'name' => 'BS Information Technology', 'status' => ProgramStatus::Inactive]);

        $chair = $this->makeUser(UserRole::ProgramChair);

        $visible = Program::query()->visibleTo($chair)->pluck('code')->sort()->values()->all();

        self::assertSame(['BSCS', 'BSIT'], $visible);
    }
}
