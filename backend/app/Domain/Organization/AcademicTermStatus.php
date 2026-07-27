<?php

namespace App\Domain\Organization;

/**
 * PROVISIONAL VOCABULARY — NOT AN APPROVED INSTITUTIONAL POLICY VALUE.
 *
 * PRD §17 lists institutional status vocabularies as an open decision
 * requiring GRC approval. These three values exist only so this slice has
 * something concrete to authorize against; they must be replaced with the
 * confirmed vocabulary via a data migration before any production-like
 * deployment. The `academic_terms.status` column stays a plain string for
 * exactly this reason.
 */
enum AcademicTermStatus: string
{
    case Planning = 'planning';
    case Active = 'active';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Planning => 'Planning',
            self::Active => 'Active',
            self::Closed => 'Closed',
        };
    }

    /**
     * Whether learner-scoped roles (student, faculty, accounting staff) may
     * see this term. A term still being planned is not yet learner-facing;
     * active and closed terms are (students need term history). Planning
     * roles always see every term regardless of this value — see
     * AcademicTerm::scopeVisibleTo().
     */
    public function isVisibleToLearners(): bool
    {
        return match ($this) {
            self::Planning => false,
            self::Active, self::Closed => true,
        };
    }
}
