<?php

namespace Database\Seeders;

use App\Domain\Identity\UserRole;
use App\Domain\Identity\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Seeds exactly one synthetic development identity per PRD role.
 *
 * These are database fixtures for local development and automated tests. They
 * are not production accounts, and they deliberately do not share a password
 * with the UI-only demo credentials in docs/testing/DEMO_CREDENTIALS.md.
 */
final class RoleUserSeeder extends Seeder
{
    /**
     * Deterministic display name and email per role. Emails use the reserved
     * `.test` TLD (RFC 2606) so they can never resolve to a real mailbox.
     *
     * @var array<string, array{name: string, email: string}>
     */
    private const IDENTITIES = [
        'student' => ['name' => 'Seed Student', 'email' => 'student.seed@grc.test'],
        'admission_staff' => ['name' => 'Seed Admission Staff', 'email' => 'admission.seed@grc.test'],
        'faculty' => ['name' => 'Seed Faculty', 'email' => 'faculty.seed@grc.test'],
        'program_chair' => ['name' => 'Seed Program Chair', 'email' => 'chair.seed@grc.test'],
        'dean' => ['name' => 'Seed Dean', 'email' => 'dean.seed@grc.test'],
        'executive_director' => ['name' => 'Seed Executive Director', 'email' => 'executive.seed@grc.test'],
        'registrar_head' => ['name' => 'Seed Registrar Head', 'email' => 'registrar-head.seed@grc.test'],
        'registrar_staff' => ['name' => 'Seed Registrar Staff', 'email' => 'registrar-staff.seed@grc.test'],
        'accounting_staff' => ['name' => 'Seed Accounting Staff', 'email' => 'accounting.seed@grc.test'],
    ];

    public function run(): void
    {
        $this->guardEnvironment();

        $password = $this->seedPassword();

        DB::transaction(function () use ($password): void {
            foreach (UserRole::cases() as $role) {
                $identity = self::IDENTITIES[$role->value];

                User::updateOrCreate(
                    ['email' => $identity['email']],
                    [
                        'name' => $identity['name'],
                        'password' => $password,
                        'role' => $role,
                        'status' => UserStatus::Active,
                    ],
                );
            }
        });
    }

    /**
     * Synthetic credentials must never reach a production-like environment.
     */
    private function guardEnvironment(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException(
                'RoleUserSeeder may only run in the local or testing environment. '
                .'Refusing to seed synthetic credentials into "'.app()->environment().'".',
            );
        }
    }

    /**
     * Fails closed: an absent password must stop the seeder rather than
     * silently produce accounts with a guessable or empty secret.
     */
    private function seedPassword(): string
    {
        $password = getenv('GRC_SEED_PASSWORD');

        if (! is_string($password) || trim($password) === '') {
            throw new RuntimeException(
                'GRC_SEED_PASSWORD is not set. Set it to a local development '
                .'secret before seeding; it is never committed or logged.',
            );
        }

        return $password;
    }
}
