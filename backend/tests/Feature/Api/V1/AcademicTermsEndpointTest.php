<?php

namespace Tests\Feature\Api\V1;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Domain\Organization\AcademicTermStatus;
use App\Models\AcademicTerm;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AcademicTermsEndpointTest extends TestCase
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

    private function seedTerms(): void
    {
        AcademicTerm::create(['school_year' => '2025-2026', 'semester' => '2nd', 'status' => AcademicTermStatus::Closed]);
        AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::Planning]);
    }

    public function test_anonymous_request_is_unauthenticated(): void
    {
        $this->getJson('/api/v1/academic-terms')->assertUnauthorized();
    }

    public function test_a_faculty_member_does_not_see_the_planning_term_with_the_exact_envelope(): void
    {
        $this->seedTerms();
        $token = $this->tokenFor(UserRole::Faculty, 'faculty.terms@grc.test');

        $response = $this->withToken($token)->getJson('/api/v1/academic-terms');

        $response->assertOk()->assertHeader('Cache-Control', 'no-store, private');

        $term = AcademicTerm::where('semester', '2nd')->sole();
        $response->assertExactJson([
            'data' => [
                [
                    'type' => 'academic-term',
                    'id' => $term->id,
                    'school_year' => '2025-2026',
                    'semester' => '2nd',
                    'starts_at' => null,
                    'ends_at' => null,
                    'enrollment_opens_at' => null,
                    'enrollment_closes_at' => null,
                    'status' => 'closed',
                    'status_label' => 'Closed',
                ],
            ],
        ]);
    }

    public function test_a_registrar_head_receives_every_term_including_planning(): void
    {
        $this->seedTerms();
        $token = $this->tokenFor(UserRole::RegistrarHead, 'registrar-head.terms@grc.test');

        $response = $this->withToken($token)->getJson('/api/v1/academic-terms');

        $response->assertOk();
        self::assertCount(2, $response->json('data'));
    }

    public function test_results_are_ordered_by_school_year_descending_then_semester(): void
    {
        AcademicTerm::create(['school_year' => '2024-2025', 'semester' => '1st', 'status' => AcademicTermStatus::Closed]);
        AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '2nd', 'status' => AcademicTermStatus::Active]);
        AcademicTerm::create(['school_year' => '2026-2027', 'semester' => '1st', 'status' => AcademicTermStatus::Active]);
        $token = $this->tokenFor(UserRole::Dean, 'dean.terms@grc.test');

        $response = $this->withToken($token)->getJson('/api/v1/academic-terms');

        $ordering = collect($response->json('data'))
            ->map(fn (array $term): string => $term['school_year'].'-'.$term['semester'])
            ->all();

        self::assertSame(
            ['2026-2027-1st', '2026-2027-2nd', '2024-2025-1st'],
            $ordering,
        );
    }
}
