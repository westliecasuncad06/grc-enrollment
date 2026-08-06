<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Audit\AuditAction;
use App\Domain\Curriculum\CurriculumStatus;
use App\Domain\Curriculum\SubjectStatus;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\ProgramStatus;
use App\Models\AuditLog;
use App\Models\Curriculum;
use App\Models\CurriculumSubject;
use App\Models\Program;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class CurriculaEndpointTest extends TestCase
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

    private function makeProgram(): Program
    {
        return Program::create(['code' => 'BSCS', 'name' => 'BS Computer Science', 'status' => ProgramStatus::Active]);
    }

    /** @return array{0: Subject, 1: Subject} */
    private function makeTwoSubjects(): array
    {
        return [
            Subject::create(['code' => 'CS101', 'title' => 'Intro to Programming', 'units' => 3, 'status' => SubjectStatus::Active]),
            Subject::create(['code' => 'CS102', 'title' => 'Data Structures', 'units' => 3, 'status' => SubjectStatus::Active]),
        ];
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/curricula')->assertUnauthorized();
        $this->postJson('/api/v1/curricula', [])->assertUnauthorized();
    }

    public function test_a_learner_scoped_role_does_not_see_a_draft_curriculum(): void
    {
        $program = $this->makeProgram();
        Curriculum::create(['program_id' => $program->id, 'name' => 'Active Curriculum', 'effective_school_year' => '2025-2026', 'status' => CurriculumStatus::Active]);
        Curriculum::create(['program_id' => $program->id, 'name' => 'Draft Curriculum', 'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Draft]);
        $token = $this->tokenFor(UserRole::Faculty, 'faculty.curricula@grc.test');

        $response = $this->withToken($token)->getJson('/api/v1/curricula');

        $response
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Active Curriculum');
    }

    public function test_a_program_chair_can_create_a_curriculum_with_subjects_and_prerequisites(): void
    {
        $program = $this->makeProgram();
        [$intro, $dataStructures] = $this->makeTwoSubjects();
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.create@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/curricula', [
            'program_id' => $program->id,
            'name' => 'BSCS 2026 Curriculum',
            'effective_school_year' => '2026-2027',
            'status' => 'draft',
            'subjects' => [
                ['subject_id' => $intro->id, 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
                [
                    'subject_id' => $dataStructures->id, 'year_level' => 1, 'semester' => '2nd', 'is_required' => true,
                    'prerequisites' => [
                        ['prerequisite_subject_id' => $intro->id, 'minimum_grade' => '75'],
                    ],
                ],
            ],
        ]);

        $response->assertCreated()->assertHeader('Cache-Control', 'no-store, private');
        $response->assertJsonPath('data.name', 'BSCS 2026 Curriculum');
        $response->assertJsonPath('data.status', 'draft');
        $response->assertJsonCount(2, 'data.subjects');
        $response->assertJsonPath('data.subjects.1.code', 'CS102');
        $response->assertJsonCount(1, 'data.subjects.1.prerequisites');
        $response->assertJsonPath(
            'data.subjects.1.prerequisites.0.prerequisite_subject_id',
            $intro->id,
        );

        $this->assertDatabaseHas('curricula', ['name' => 'BSCS 2026 Curriculum']);
        $this->assertDatabaseCount('curriculum_subjects', 2);
        $this->assertDatabaseCount('subject_prerequisites', 1);
        self::assertSame(
            AuditAction::CURRICULUM_CREATED,
            AuditLog::query()->sole()->action,
        );
    }

    public function test_a_non_program_chair_role_cannot_create_a_curriculum(): void
    {
        $program = $this->makeProgram();
        $token = $this->tokenFor(UserRole::Dean, 'dean.create@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/curricula', [
            'program_id' => $program->id,
            'name' => 'Should Not Exist',
            'effective_school_year' => '2026-2027',
            'status' => 'draft',
            'subjects' => [],
        ]);

        $response->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->assertDatabaseMissing('curricula', ['name' => 'Should Not Exist']);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    /**
     * Direct acceptance criterion from PRD §5.1: "A Program Chair cannot
     * create a prerequisite cycle."
     */
    public function test_a_program_chair_cannot_create_a_direct_prerequisite_cycle(): void
    {
        $program = $this->makeProgram();
        [$a, $b] = $this->makeTwoSubjects();
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.cycle@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/curricula', [
            'program_id' => $program->id,
            'name' => 'Cyclic Curriculum',
            'effective_school_year' => '2026-2027',
            'status' => 'draft',
            'subjects' => [
                ['subject_id' => $a->id, 'year_level' => 1, 'semester' => '1st', 'is_required' => true, 'prerequisites' => [
                    ['prerequisite_subject_id' => $b->id, 'minimum_grade' => '75'],
                ]],
                ['subject_id' => $b->id, 'year_level' => 1, 'semester' => '1st', 'is_required' => true, 'prerequisites' => [
                    ['prerequisite_subject_id' => $a->id, 'minimum_grade' => '75'],
                ]],
            ],
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertDatabaseMissing('curricula', ['name' => 'Cyclic Curriculum']);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_a_program_chair_cannot_create_a_transitive_prerequisite_cycle(): void
    {
        $program = $this->makeProgram();
        $a = Subject::create(['code' => 'CS1', 'title' => 'Subject A', 'units' => 3, 'status' => SubjectStatus::Active]);
        $b = Subject::create(['code' => 'CS2', 'title' => 'Subject B', 'units' => 3, 'status' => SubjectStatus::Active]);
        $c = Subject::create(['code' => 'CS3', 'title' => 'Subject C', 'units' => 3, 'status' => SubjectStatus::Active]);
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.transitive-cycle@grc.test');

        $response = $this->withToken($token)->postJson('/api/v1/curricula', [
            'program_id' => $program->id,
            'name' => 'Transitively Cyclic Curriculum',
            'effective_school_year' => '2026-2027',
            'status' => 'draft',
            'subjects' => [
                ['subject_id' => $a->id, 'year_level' => 1, 'semester' => '1st', 'is_required' => true, 'prerequisites' => [
                    ['prerequisite_subject_id' => $b->id, 'minimum_grade' => '75'],
                ]],
                ['subject_id' => $b->id, 'year_level' => 1, 'semester' => '1st', 'is_required' => true, 'prerequisites' => [
                    ['prerequisite_subject_id' => $c->id, 'minimum_grade' => '75'],
                ]],
                ['subject_id' => $c->id, 'year_level' => 1, 'semester' => '1st', 'is_required' => true, 'prerequisites' => [
                    ['prerequisite_subject_id' => $a->id, 'minimum_grade' => '75'],
                ]],
            ],
        ]);

        $response->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED');
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_updating_a_curriculum_fully_replaces_its_subject_placements(): void
    {
        $program = $this->makeProgram();
        [$intro, $dataStructures] = $this->makeTwoSubjects();
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.update@grc.test');

        $created = $this->withToken($token)->postJson('/api/v1/curricula', [
            'program_id' => $program->id,
            'name' => 'BSCS 2026 Curriculum',
            'effective_school_year' => '2026-2027',
            'status' => 'draft',
            'subjects' => [
                ['subject_id' => $intro->id, 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
            ],
        ]);
        $curriculumId = $created->json('data.id');

        $response = $this->withToken($token)->patchJson("/api/v1/curricula/{$curriculumId}", [
            'name' => 'BSCS 2026 Curriculum (revised)',
            'effective_school_year' => '2026-2027',
            'status' => 'active',
            'subjects' => [
                ['subject_id' => $dataStructures->id, 'year_level' => 1, 'semester' => '2nd', 'is_required' => true],
            ],
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.name', 'BSCS 2026 Curriculum (revised)');
        $response->assertJsonPath('data.status', 'active');
        $response->assertJsonCount(1, 'data.subjects');
        $response->assertJsonPath('data.subjects.0.code', 'CS102');
        $this->assertDatabaseCount('curriculum_subjects', 1);
        self::assertSame(
            1,
            AuditLog::query()->where('action', AuditAction::CURRICULUM_UPDATED)->count(),
        );
    }

    /**
     * Regression coverage for a data-loss bug: the `reference_*` columns on
     * `curriculum_subjects` hold real schedule/faculty data transcribed from
     * GRC's official Excel files and seeded once by
     * `GrcCurriculumScheduleReferenceSeeder`. The Curriculum Editor autosaves
     * on a debounce and never sends those columns, so
     * `SynchronizeCurriculumSubjects`' delete-and-recreate used to null them
     * out on every single save, silently and irreversibly.
     */
    public function test_updating_a_curriculum_preserves_its_placements_reference_schedule_data(): void
    {
        $program = $this->makeProgram();
        [$intro, $dataStructures] = $this->makeTwoSubjects();
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'BSCS 2026 Curriculum',
            'effective_school_year' => '2026-2027', 'status' => CurriculumStatus::Draft,
        ]);
        CurriculumSubject::create([
            'curriculum_id' => $curriculum->id, 'subject_id' => $intro->id,
            'year_level' => 1, 'semester' => '1st', 'is_required' => true,
            'reference_day' => 'Tue', 'reference_start_time' => '07:30:00', 'reference_end_time' => '09:30:00',
            'reference_room' => 'ONLINE', 'reference_modality' => 'ONLINE',
            'reference_professor_name' => 'MR. MACINAS', 'reference_sched_id' => 'S-101',
            'reference_notes' => 'From the 2024-2029 sheet.',
        ]);
        $token = $this->tokenFor(UserRole::ProgramChair, 'chair.reference-data@grc.test');

        // The editor re-sends the untouched placement verbatim while adding
        // an unrelated second subject — the exact shape of an autosave.
        $response = $this->withToken($token)->patchJson("/api/v1/curricula/{$curriculum->id}", [
            'name' => 'BSCS 2026 Curriculum',
            'effective_school_year' => '2026-2027',
            'status' => 'active',
            'subjects' => [
                ['subject_id' => $intro->id, 'year_level' => 1, 'semester' => '1st', 'is_required' => true],
                ['subject_id' => $dataStructures->id, 'year_level' => 1, 'semester' => '2nd', 'is_required' => true],
            ],
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('curriculum_subjects', [
            'curriculum_id' => $curriculum->id,
            'subject_id' => $intro->id,
            'reference_day' => 'Tue',
            'reference_start_time' => '07:30:00',
            'reference_end_time' => '09:30:00',
            'reference_room' => 'ONLINE',
            'reference_modality' => 'ONLINE',
            'reference_professor_name' => 'MR. MACINAS',
            'reference_sched_id' => 'S-101',
            'reference_notes' => 'From the 2024-2029 sheet.',
        ]);
        // A genuinely new placement has no reference data to carry forward,
        // and none is invented for it.
        $this->assertDatabaseHas('curriculum_subjects', [
            'curriculum_id' => $curriculum->id,
            'subject_id' => $dataStructures->id,
            'reference_day' => null,
            'reference_professor_name' => null,
        ]);
    }

    public function test_a_non_program_chair_role_cannot_update_a_curriculum(): void
    {
        $program = $this->makeProgram();
        $curriculum = Curriculum::create([
            'program_id' => $program->id, 'name' => 'Existing', 'effective_school_year' => '2026-2027',
            'status' => CurriculumStatus::Draft,
        ]);
        $token = $this->tokenFor(UserRole::RegistrarHead, 'registrar-head.update@grc.test');

        $response = $this->withToken($token)->patchJson("/api/v1/curricula/{$curriculum->id}", [
            'name' => 'Hijacked', 'effective_school_year' => '2026-2027', 'status' => 'active', 'subjects' => [],
        ]);

        $response->assertForbidden();
        $this->assertDatabaseHas('curricula', ['name' => 'Existing']);
        $this->assertDatabaseCount('audit_logs', 0);
    }
}
