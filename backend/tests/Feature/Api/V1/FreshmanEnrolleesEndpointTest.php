<?php

namespace Tests\Feature\Api\V1;

use App\Actions\Enrollment\ConfirmFreshmanPayment;
use App\Domain\Audit\AuditRequestContext;
use App\Domain\Identity\StudentType;
use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\Section;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\BuildsBlockSections;
use Tests\Support\BuildsFreshmen;
use Tests\TestCase;

/**
 * Registrar Staff and the Registrar Head get a read-only list of the freshmen who
 * enrolled by paying first (ADR 0043), including the ones still waiting for a section.
 */
final class FreshmanEnrolleesEndpointTest extends TestCase
{
    use BuildsBlockSections;
    use BuildsFreshmen;
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery-staple';

    public function test_registrar_staff_and_the_registrar_head_see_enrolled_and_waiting_freshmen(): void
    {
        $this->enrolledFreshman('2026-10-00001');
        $this->waitingFreshman('2026-10-00002');
        $this->unpaidFreshman('2026-10-00003');

        foreach ([UserRole::RegistrarStaff, UserRole::RegistrarHead] as $role) {
            $token = $this->tokenFor($role, $role->value.'@grc.test');
            $this->app['auth']->forgetGuards();

            $response = $this->withToken($token)->getJson('/api/v1/freshman-enrollees')->assertOk()
                ->assertHeader('Cache-Control', 'no-store, private');

            $byNumber = collect($response->json('data'))->keyBy('student_number');
            // Paid and submitted, waiting for the Registrar's approval (2026-10-04).
            self::assertSame('enrolling', $byNumber['2026-10-00001']['status']);
            self::assertSame('IT101', $byNumber['2026-10-00001']['block_code']);
            self::assertSame('1000.00', $byNumber['2026-10-00001']['amount_paid']);
            self::assertSame('awaiting_section', $byNumber['2026-10-00002']['status']);
            self::assertNull($byNumber['2026-10-00002']['block_code']);
            self::assertSame('1000.00', $byNumber['2026-10-00002']['amount_paid']);
            self::assertSame('awaiting_payment', $byNumber['2026-10-00003']['status']);
            $this->app['auth']->forgetGuards();
        }
    }

    public function test_the_list_can_be_filtered_by_status_and_searched(): void
    {
        $this->enrolledFreshman('2026-10-00001');
        $this->waitingFreshman('2026-10-00002');
        $token = $this->tokenFor(UserRole::RegistrarStaff, 'registrar.staff@grc.test');

        $this->withToken($token)->getJson('/api/v1/freshman-enrollees?status=awaiting_section')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.student_number', '2026-10-00002');
        $this->withToken($token)->getJson('/api/v1/freshman-enrollees?search=2026-10-00001')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', 'enrolling');
    }

    public function test_only_freshmen_are_listed(): void
    {
        $this->enrolledFreshman('2026-10-00001');
        $this->freshmanProfile('2026-10-00007', StudentType::Transferee);
        $token = $this->tokenFor(UserRole::RegistrarStaff, 'registrar.staff@grc.test');

        $this->withToken($token)->getJson('/api/v1/freshman-enrollees')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_it_is_paginated(): void
    {
        foreach (range(1, 3) as $n) {
            $this->unpaidFreshman(sprintf('2026-10-%05d', $n));
        }
        $token = $this->tokenFor(UserRole::RegistrarStaff, 'registrar.staff@grc.test');

        $this->withToken($token)->getJson('/api/v1/freshman-enrollees?per_page=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 3);
    }

    public function test_nobody_else_can_read_it(): void
    {
        $this->enrolledFreshman('2026-10-00001');
        // Before any token is attached: `withToken` stays on the test for every later request.
        $this->getJson('/api/v1/freshman-enrollees')->assertUnauthorized();

        foreach ([UserRole::AccountingStaff, UserRole::AdmissionStaff, UserRole::ProgramChair, UserRole::Dean, UserRole::ExecutiveDirector, UserRole::Student, UserRole::Faculty] as $role) {
            $token = $this->tokenFor($role, 'other.'.$role->value.'@grc.test');
            $this->app['auth']->forgetGuards();
            $this->withToken($token)->getJson('/api/v1/freshman-enrollees')->assertForbidden();
            $this->app['auth']->forgetGuards();
        }
    }

    private function enrolledFreshman(string $number): StudentProfile
    {
        $profile = $this->freshmanProfile($number);
        $term = $this->ongoingTerm();
        $this->blockSection($term, $this->yearOnePlan($term, $profile->curriculum), 'IT101', 'ITP1'.substr($number, -2));
        $this->issueFreshmanTicket($profile);
        $this->pay($profile);

        return $profile;
    }

    private function waitingFreshman(string $number): StudentProfile
    {
        $profile = $this->freshmanProfile($number);
        $term = $this->ongoingTerm();
        // No block at all for this one: the payment is held.
        $this->issueFreshmanTicket($profile);
        Section::query()->update(['capacity' => 1, 'enrolled_count' => 1]);
        $this->pay($profile);

        return $profile;
    }

    private function unpaidFreshman(string $number): StudentProfile
    {
        $profile = $this->freshmanProfile($number);
        $this->issueFreshmanTicket($profile);

        return $profile;
    }

    private function pay(StudentProfile $profile): void
    {
        $this->app->make(ConfirmFreshmanPayment::class)->execute(
            $profile->fresh(),
            ['amount' => '1000.00'],
            $this->staffUser(UserRole::AccountingStaff, 'cashier@grc.test'),
            new AuditRequestContext('test', null),
        );
    }

    private function tokenFor(UserRole $role, string $email): string
    {
        User::query()->where('email', $email)->first() ?? User::create([
            'name' => 'Test '.$role->value, 'email' => $email, 'password' => self::PASSWORD,
            'role' => $role, 'status' => UserStatus::Active, 'last_otp_verified_at' => now(),
        ]);

        return (string) $this->postJson('/api/v1/auth/login', ['email' => $email, 'password' => self::PASSWORD])->json('data.token');
    }
}
