<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\CollegeCode;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class FacultySpecializationsEndpointTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    /** @return array{User, string} */
    private function faculty(string $email, CollegeCode $college = CollegeCode::Ccs): array
    {
        $faculty = User::create([
            'name' => 'Test Faculty',
            'email' => $email,
            'password' => self::PASSWORD,
            'role' => UserRole::Faculty,
            'college' => $college,
            'status' => UserStatus::Active,
        ]);

        $token = (string) $this->postJson('/api/v1/auth/login', [
            'email' => $email,
            'password' => self::PASSWORD,
        ])->json('data.token');

        return [$faculty, $token];
    }

    private function subject(string $code, CollegeCode $college): Subject
    {
        return Subject::create([
            'code' => $code,
            'college' => $college,
            'title' => 'Test Subject '.$code,
            'units' => 3,
            'status' => SubjectStatus::Active,
        ]);
    }

    public function test_a_professor_declares_and_lists_their_teaching_specializations(): void
    {
        [$professor, $token] = $this->faculty('faculty.specialization@grc.test');
        $subject = $this->subject('IT101', CollegeCode::Ccs);

        $this->withToken($token)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $subject->id,
            'proficiency' => 'primary',
            'notes' => 'Experienced in introductory computing.',
        ])->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.type', 'faculty-specialization')
            ->assertJsonPath('data.professor_id', $professor->id)
            ->assertJsonPath('data.subject_id', $subject->id)
            ->assertJsonPath('data.proficiency', 'primary')
            ->assertJsonPath('data.proficiency_label', 'Primary');

        $this->withToken($token)->getJson('/api/v1/faculty-specializations')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.professor_id', $professor->id);
    }

    public function test_it_rejects_a_duplicate_subject_with_the_validation_error_envelope(): void
    {
        [, $token] = $this->faculty('faculty.specialization-duplicate@grc.test');
        $subject = $this->subject('IT102', CollegeCode::Ccs);

        $payload = ['subject_id' => $subject->id, 'proficiency' => 'secondary'];
        $this->withToken($token)->postJson('/api/v1/faculty-specializations', $payload)->assertCreated();

        $this->withToken($token)->postJson('/api/v1/faculty-specializations', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonPath('error.errors.subject_id.0', 'The subject id has already been taken.');
    }

    public function test_it_rejects_a_subject_outside_the_professors_college(): void
    {
        [, $token] = $this->faculty('faculty.specialization-college@grc.test', CollegeCode::Ccs);
        $otherCollegeSubject = $this->subject('ED101', CollegeCode::Coe);

        $this->withToken($token)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $otherCollegeSubject->id,
            'proficiency' => 'secondary',
        ])->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonPath('error.errors.subject_id.0', 'The selected subject id is invalid.');
    }

    public function test_a_professor_cannot_delete_another_professors_specialization(): void
    {
        [$owner, $ownerToken] = $this->faculty('faculty.specialization-owner@grc.test');
        [$other, $otherToken] = $this->faculty('faculty.specialization-other@grc.test');
        self::assertNotSame($owner->id, $other->id);
        $subject = $this->subject('IT103', CollegeCode::Ccs);

        $specializationId = $this->withToken($ownerToken)->postJson('/api/v1/faculty-specializations', [
            'subject_id' => $subject->id,
            'proficiency' => 'secondary',
        ])->assertCreated()->json('data.id');

        // The test client reuses the cached Sanctum guard after the owner's
        // POST. Forget it before sending a different bearer token, matching
        // the real fresh-request behavior covered by SessionEndpointTest.
        $this->app['auth']->forgetGuards();

        $this->withToken($otherToken)->deleteJson("/api/v1/faculty-specializations/{$specializationId}")
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');

        $this->assertDatabaseHas('faculty_specializations', ['id' => $specializationId]);
    }
}
