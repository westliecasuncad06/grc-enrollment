<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class SubjectsEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function tokenFor(UserRole $role, string $email): string
    {
        User::create([
            'name' => 'Test '.$role->value,
            'email' => $email,
            'password' => self::PASSWORD,
            'role' => $role,
            'status' => UserStatus::Active,
        ]);

        return (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => self::PASSWORD,
        ])->json('data.token');
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/subjects')->assertUnauthorized();
    }

    public function test_a_student_receives_only_active_subjects(): void
    {
        Subject::create(['code' => 'CS101', 'title' => 'Intro to Programming', 'units' => 3, 'status' => SubjectStatus::Active]);
        Subject::create(['code' => 'CS999', 'title' => 'Deprecated', 'units' => 3, 'status' => SubjectStatus::Inactive]);
        $token = $this->tokenFor(UserRole::Student, 'student.subjects@grc.test');

        $response = $this->withToken($token)->getJson('/api/v1/subjects');

        $response->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        self::assertSame(['CS101'], collect($response->json('data'))->pluck('code')->all());
    }

    public function test_a_program_chair_receives_every_subject_regardless_of_status(): void
    {
        Subject::create(['code' => 'CS101', 'title' => 'Intro to Programming', 'units' => 3, 'status' => SubjectStatus::Active]);
        Subject::create(['code' => 'CS999', 'title' => 'Deprecated', 'units' => 3, 'status' => SubjectStatus::Inactive]);
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.subjects@grc.test');

        $response = $this->withToken($token)->getJson('/api/v1/subjects');

        $response->assertOk();
        self::assertSame(['CS101', 'CS999'], collect($response->json('data'))->pluck('code')->all());
    }
}
