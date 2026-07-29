<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\AuditLog;
use App\Models\FacultySubjectPreference;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class FacultySubjectPreferencesEndpointTest extends TestCase
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

    private function makeSubject(string $code): Subject
    {
        return Subject::create(['code' => $code, 'title' => 'Test Subject '.$code, 'units' => 3, 'status' => SubjectStatus::Active]);
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/faculty-subject-preferences')->assertUnauthorized();
        $this->postJson('/api/v1/faculty-subject-preferences', [])->assertUnauthorized();
    }

    public function test_a_faculty_member_can_rank_a_subject(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        [$professor, $token] = $this->tokenFor(UserRole::Faculty, 'professor.create@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/faculty-subject-preferences', [
            'academic_term_id' => $term->id,
            'subject_id' => $subject->id,
            'rank' => 1,
        ]);

        $response->assertCreated()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonPath('data.professor_id', $professor->id);
        $this->assertDatabaseHas('faculty_subject_preferences', ['professor_id' => $professor->id, 'subject_id' => $subject->id]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_user_id' => $professor->id,
            'action' => AuditAction::FACULTY_SUBJECT_PREFERENCE_CREATED,
            'auditable_id' => $response->json('data.id'),
        ]);
        self::assertSame(1, AuditLog::query()->count());
    }

    public function test_a_non_faculty_role_cannot_create_a_preference(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        [, $token] = $this->tokenFor(UserRole::RegistrarStaff, 'registrar.create@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/faculty-subject-preferences', [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'rank' => 1,
        ]);

        $response->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_ranking_the_same_subject_twice_in_one_term_is_rejected_with_a_clean_422(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        $otherSubject = $this->makeSubject('CS102');
        [, $token] = $this->tokenFor(UserRole::Faculty, 'professor.dup-subject@grc.test');

        $this->withToken($token)->postJson('/api/v1/faculty-subject-preferences', [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'rank' => 1,
        ])->assertCreated();

        $response = $this->withToken($token)->postJson('/api/v1/faculty-subject-preferences', [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'rank' => 2,
        ]);
        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');

        $rankResponse = $this->withToken($token)->postJson('/api/v1/faculty-subject-preferences', [
            'academic_term_id' => $term->id, 'subject_id' => $otherSubject->id, 'rank' => 1,
        ]);
        $rankResponse->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_a_faculty_member_sees_only_their_own_preferences_in_the_index(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        [$professorA, $tokenA] = $this->tokenFor(UserRole::Faculty, 'professor.a@grc.test');
        [$professorB] = $this->tokenFor(UserRole::Faculty, 'professor.b@grc.test');

        FacultySubjectPreference::create([
            'professor_id' => $professorA->id, 'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'rank' => 1,
        ]);
        FacultySubjectPreference::create([
            'professor_id' => $professorB->id, 'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'rank' => 1,
        ]);

        $response = $this->withToken($tokenA)->getJson('/api/v1/faculty-subject-preferences');

        $response->assertOk();
        self::assertSame([$professorA->id], collect($response->json('data'))->pluck('professor_id')->all());
    }

    public function test_a_faculty_member_cannot_delete_another_professors_preference(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        [$owner] = $this->tokenFor(UserRole::Faculty, 'owner@grc.test');
        [, $otherToken] = $this->tokenFor(UserRole::Faculty, 'other@grc.test');

        $preference = FacultySubjectPreference::create([
            'professor_id' => $owner->id, 'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'rank' => 1,
        ]);

        $response = $this->withToken($otherToken)->deleteJson("/api/v1/faculty-subject-preferences/{$preference->id}");

        $response->assertForbidden();
        $this->assertDatabaseHas('faculty_subject_preferences', ['id' => $preference->id]);
    }

    public function test_a_faculty_member_can_update_their_own_preference_rank(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        [$owner, $token] = $this->tokenFor(UserRole::Faculty, 'owner.update@grc.test');

        $preference = FacultySubjectPreference::create([
            'professor_id' => $owner->id, 'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'rank' => 1,
        ]);

        $response = $this->withToken($token)->patchJson("/api/v1/faculty-subject-preferences/{$preference->id}", [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id, 'rank' => 2,
        ]);

        $response->assertOk()->assertJsonPath('data.rank', 2);
    }
}
