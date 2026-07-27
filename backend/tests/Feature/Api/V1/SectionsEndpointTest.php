<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Domain\Scheduling\SectionStatus;
use App\Models\AcademicTerm;
use App\Models\Section;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class SectionsEndpointTest extends TestCase
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
        $this->getJson('/api/v1/sections')->assertUnauthorized();
        $this->postJson('/api/v1/sections', [])->assertUnauthorized();
    }

    public function test_a_learner_scoped_role_does_not_see_a_planned_section(): void
    {
        $term = $this->makeTerm();
        Section::create(['academic_term_id' => $term->id, 'subject_id' => $this->makeSubject('CS101')->id, 'section_code' => 'A', 'capacity' => 40, 'status' => SectionStatus::Published]);
        Section::create(['academic_term_id' => $term->id, 'subject_id' => $this->makeSubject('CS102')->id, 'section_code' => 'A', 'capacity' => 40, 'status' => SectionStatus::Planned]);
        $token = $this->tokenFor(UserRole::Student, 'student.sections@grc.test');

        $response = $this->withToken($token)->getJson('/api/v1/sections');

        $response->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        self::assertCount(1, $response->json('data'));
    }

    public function test_a_program_chair_can_create_a_section(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.create@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/sections', [
            'academic_term_id' => $term->id,
            'subject_id' => $subject->id,
            'section_code' => 'A',
            'capacity' => 40,
            'status' => 'planned',
        ]);

        $response->assertCreated()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonPath('data.section_code', 'A');
        $response->assertJsonPath('data.remaining_seats', 40);
        $this->assertDatabaseHas('sections', ['section_code' => 'A', 'capacity' => 40]);
    }

    public function test_a_non_program_chair_role_cannot_create_a_section(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        $token = $this->tokenFor(UserRole::Dean, 'dean.create@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/sections', [
            'academic_term_id' => $term->id,
            'subject_id' => $subject->id,
            'section_code' => 'A',
            'capacity' => 40,
            'status' => 'planned',
        ]);

        $response->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->assertDatabaseMissing('sections', ['section_code' => 'A']);
    }

    public function test_the_same_section_code_cannot_repeat_for_one_subject_in_one_term(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.dup@grc.test');

        $this->withToken($token)->postJson('/api/v1/sections', [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id,
            'section_code' => 'A', 'capacity' => 40, 'status' => 'planned',
        ])->assertCreated();

        $response = $this->withToken($token)->postJson('/api/v1/sections', [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id,
            'section_code' => 'A', 'capacity' => 35, 'status' => 'planned',
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_a_program_chair_cannot_double_book_a_professor(): void
    {
        $term = $this->makeTerm();
        $professor = User::create([
            'name' => 'Professor', 'email' => 'professor.conflict@grc.test',
            'password' => 'irrelevant', 'role' => UserRole::Faculty, 'status' => UserStatus::Active,
        ]);
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.conflict@grc.test');

        $this->withToken($token)->postJson('/api/v1/sections', [
            'academic_term_id' => $term->id, 'subject_id' => $this->makeSubject('CS101')->id,
            'section_code' => 'A', 'professor_id' => $professor->id,
            'schedule_days' => 'MWF', 'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
            'capacity' => 40, 'status' => 'planned',
        ])->assertCreated();

        $response = $this->withToken($token)->postJson('/api/v1/sections', [
            'academic_term_id' => $term->id, 'subject_id' => $this->makeSubject('CS102')->id,
            'section_code' => 'A', 'professor_id' => $professor->id,
            'schedule_days' => 'MWF', 'starts_at_time' => '08:30:00', 'ends_at_time' => '09:30:00',
            'capacity' => 40, 'status' => 'planned',
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_the_same_professor_may_teach_non_overlapping_sections(): void
    {
        $term = $this->makeTerm();
        $professor = User::create([
            'name' => 'Professor', 'email' => 'professor.nonoverlap@grc.test',
            'password' => 'irrelevant', 'role' => UserRole::Faculty, 'status' => UserStatus::Active,
        ]);
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.nonoverlap@grc.test');

        $this->withToken($token)->postJson('/api/v1/sections', [
            'academic_term_id' => $term->id, 'subject_id' => $this->makeSubject('CS101')->id,
            'section_code' => 'A', 'professor_id' => $professor->id,
            'schedule_days' => 'MWF', 'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
            'capacity' => 40, 'status' => 'planned',
        ])->assertCreated();

        $response = $this->withToken($token)->postJson('/api/v1/sections', [
            'academic_term_id' => $term->id, 'subject_id' => $this->makeSubject('CS102')->id,
            'section_code' => 'A', 'professor_id' => $professor->id,
            'schedule_days' => 'MWF', 'starts_at_time' => '09:00:00', 'ends_at_time' => '10:00:00',
            'capacity' => 40, 'status' => 'planned',
        ]);

        $response->assertCreated();
    }

    public function test_updating_a_section_fully_replaces_its_fields(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.update@grc.test');

        $created = $this->withToken($token)->postJson('/api/v1/sections', [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id,
            'section_code' => 'A', 'capacity' => 40, 'status' => 'planned',
        ]);
        $sectionId = $created->json('data.id');

        $response = $this->withToken($token)->patchJson("/api/v1/sections/{$sectionId}", [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id,
            'section_code' => 'A', 'capacity' => 45, 'status' => 'published',
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.capacity', 45);
        $response->assertJsonPath('data.status', 'published');
    }

    public function test_updating_a_section_does_not_conflict_with_itself(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        $professor = User::create([
            'name' => 'Professor', 'email' => 'professor.selfupdate@grc.test',
            'password' => 'irrelevant', 'role' => UserRole::Faculty, 'status' => UserStatus::Active,
        ]);
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.selfupdate@grc.test');

        $created = $this->withToken($token)->postJson('/api/v1/sections', [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id,
            'section_code' => 'A', 'professor_id' => $professor->id,
            'schedule_days' => 'MWF', 'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
            'capacity' => 40, 'status' => 'planned',
        ]);
        $sectionId = $created->json('data.id');

        $response = $this->withToken($token)->patchJson("/api/v1/sections/{$sectionId}", [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id,
            'section_code' => 'A', 'professor_id' => $professor->id,
            'schedule_days' => 'MWF', 'starts_at_time' => '08:00:00', 'ends_at_time' => '09:00:00',
            'capacity' => 45, 'status' => 'planned',
        ]);

        $response->assertOk()->assertJsonPath('data.capacity', 45);
    }

    public function test_a_non_program_chair_role_cannot_update_a_section(): void
    {
        $term = $this->makeTerm();
        $subject = $this->makeSubject('CS101');
        $section = Section::create(['academic_term_id' => $term->id, 'subject_id' => $subject->id, 'section_code' => 'A', 'capacity' => 40, 'status' => SectionStatus::Planned]);
        $token = $this->tokenFor(UserRole::RegistrarHead, 'registrar-head.update@grc.test');

        $response = $this->withToken($token)->patchJson("/api/v1/sections/{$section->id}", [
            'academic_term_id' => $term->id, 'subject_id' => $subject->id,
            'section_code' => 'A', 'capacity' => 999, 'status' => 'planned',
        ]);

        $response->assertForbidden();
        $this->assertDatabaseHas('sections', ['id' => $section->id, 'capacity' => 40]);
    }
}
