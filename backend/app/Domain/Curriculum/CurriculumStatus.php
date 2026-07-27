<?php

namespace App\Domain\Curriculum;

/**
 * PROVISIONAL VOCABULARY — NOT AN APPROVED INSTITUTIONAL POLICY VALUE.
 *
 * PRD §17 lists institutional status vocabularies as an open decision
 * requiring GRC approval. These three values exist only so this slice has
 * something concrete to authorize against; they must be replaced with the
 * confirmed vocabulary via a data migration before any production-like
 * deployment. The `curricula.status` column stays a plain string for exactly
 * this reason.
 */
enum CurriculumStatus: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Archived = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Active => 'Active',
            self::Archived => 'Archived',
        };
    }

    /**
     * Whether learner-scoped roles (student, faculty, accounting staff) may
     * see this curriculum. A curriculum still being authored is not yet
     * learner-facing; active and archived curricula are (students already
     * following an archived curriculum still need to see it). Planning
     * roles always see every curriculum regardless of this value — see
     * Curriculum::scopeVisibleTo().
     */
    public function isVisibleToLearners(): bool
    {
        return match ($this) {
            self::Draft => false,
            self::Active, self::Archived => true,
        };
    }
}
