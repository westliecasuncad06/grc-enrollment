<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\AuditLog;
use App\Models\FacultyAvailability;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class FacultyAvailabilitiesEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    private function tokenFor(UserRole $role, string $email): array
    {
        $user = User::create([
            'name' => 'Test '.$role->value,
            'email' => $email,
            'password' => self::PASSWORD,
            'role' => $role,
            'status' => UserStatus::Active,
        ]);

        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => self::PASSWORD,
        ])->json('data.token');

        return [$user, $token];
    }

    private function makeTerm(): AcademicTerm
    {
        return AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::Active]);
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/faculty-availabilities')->assertUnauthorized();
        $this->postJson('/api/v1/faculty-availabilities', [])->assertUnauthorized();
    }

    public function test_a_faculty_member_can_create_their_own_availability(): void
    {
        $term = $this->makeTerm();
        [$professor, $token] = $this->tokenFor(UserRole::Faculty, 'professor.create@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/faculty-availabilities', [
            'academic_term_id' => $term->id,
            'day_of_week' => 1,
            'starts_at_time' => '08:00:00',
            'ends_at_time' => '09:00:00',
        ]);

        $response->assertCreated()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonPath('data.professor_id', $professor->id);
        $this->assertDatabaseHas('faculty_availabilities', ['professor_id' => $professor->id, 'day_of_week' => 1]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_user_id' => $professor->id,
            'action' => AuditAction::FACULTY_AVAILABILITY_CREATED,
            'auditable_id' => $response->json('data.id'),
        ]);
        self::assertSame(1, AuditLog::query()->count());
    }

    public function test_a_non_faculty_role_cannot_create_availability(): void
    {
        $term = $this->makeTerm();
        [, $token] = $this->tokenFor(UserRole::ProgramChair, 'chair.create@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/faculty-availabilities', [
            'academic_term_id' => $term->id,
            'day_of_week' => 1,
            'starts_at_time' => '08:00:00',
            'ends_at_time' => '09:00:00',
        ]);

        $response->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_declaring_the_same_slot_twice_is_rejected_with_a_clean_422(): void
    {
        $term = $this->makeTerm();
        [, $token] = $this->tokenFor(UserRole::Faculty, 'professor.dup@grc.test');

        $this->withToken($token)->postJson('/api/v1/faculty-availabilities', [
            'academic_term_id' => $term->id, 'day_of_week' => 1,
            'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
        ])->assertCreated();

        $response = $this->withToken($token)->postJson('/api/v1/faculty-availabilities', [
            'academic_term_id' => $term->id, 'day_of_week' => 1,
            'starts_at_time' => '08:00:00', 'ends_at_time' => '10:00:00',
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_a_faculty_member_sees_only_their_own_availability_in_the_index(): void
    {
        $term = $this->makeTerm();
        [$professorA, $tokenA] = $this->tokenFor(UserRole::Faculty, 'professor.a@grc.test');
        [$professorB] = $this->tokenFor(UserRole::Faculty, 'professor.b@grc.test');

        FacultyAvailability::create([
            'professor_id' => $professorA->id, 'academic_term_id' => $term->id,
            'day_of_week' => 1, 'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
        ]);
        FacultyAvailability::create([
            'professor_id' => $professorB->id, 'academic_term_id' => $term->id,
            'day_of_week' => 2, 'starts_at_time' => '10:00:00', 'ends_at_time' => '11:00:00',
        ]);

        $response = $this->withToken($tokenA)->getJson('/api/v1/faculty-availabilities');

        $response->assertOk();
        self::assertSame([$professorA->id], collect($response->json('data'))->pluck('professor_id')->all());
    }

    public function test_a_faculty_member_cannot_update_another_professors_availability(): void
    {
        $term = $this->makeTerm();
        [$owner] = $this->tokenFor(UserRole::Faculty, 'owner@grc.test');
        [, $otherToken] = $this->tokenFor(UserRole::Faculty, 'other@grc.test');

        $availability = FacultyAvailability::create([
            'professor_id' => $owner->id, 'academic_term_id' => $term->id,
            'day_of_week' => 1, 'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
        ]);

        $response = $this->withToken($otherToken)->patchJson("/api/v1/faculty-availabilities/{$availability->id}", [
            'academic_term_id' => $term->id, 'day_of_week' => 3,
            'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
        ]);

        $response->assertForbidden();
        $this->assertDatabaseHas('faculty_availabilities', ['id' => $availability->id, 'day_of_week' => 1]);
    }

    public function test_a_faculty_member_can_update_and_delete_their_own_availability(): void
    {
        $term = $this->makeTerm();
        [$owner, $token] = $this->tokenFor(UserRole::Faculty, 'owner.update@grc.test');

        $availability = FacultyAvailability::create([
            'professor_id' => $owner->id, 'academic_term_id' => $term->id,
            'day_of_week' => 1, 'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
        ]);

        $updateResponse = $this->withToken($token)->patchJson("/api/v1/faculty-availabilities/{$availability->id}", [
            'academic_term_id' => $term->id, 'day_of_week' => 3,
            'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
        ]);
        $updateResponse->assertOk()->assertJsonPath('data.day_of_week', 3);

        $deleteResponse = $this->withToken($token)->deleteJson("/api/v1/faculty-availabilities/{$availability->id}");
        $deleteResponse->assertNoContent();
        $this->assertDatabaseMissing('faculty_availabilities', ['id' => $availability->id]);
    }
}
