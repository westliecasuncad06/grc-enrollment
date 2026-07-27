<?php

namespace App\Domain\Scheduling;

/**
 * The schedule lifecycle defined in PRD §4.1:
 *
 *   draft → dean_approved → executive_approved → published → closed
 *
 * A returned proposal moves back to `draft` with a required reason. Specified
 * by the PRD, so this enum is authoritative rather than provisional.
 *
 * The section-viability threshold that gates publication is NOT encoded here:
 * PRD §17 lists it as an open decision, so `sections.viability_threshold`
 * stays nullable and unconstrained until GRC confirms the value.
 */
enum ScheduleProposalStatus: string
{
    case Draft = 'draft';
    case DeanApproved = 'dean_approved';
    case ExecutiveApproved = 'executive_approved';
    case Published = 'published';
    case Closed = 'closed';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::DeanApproved => 'Dean Approved',
            self::ExecutiveApproved => 'Executive Approved',
            self::Published => 'Published',
            self::Closed => 'Closed',
        };
    }

    /**
     * Publication exposes the schedule to students and professors
     * (PRD §5.1). Before that point a proposal is planning-role only.
     */
    public function isVisibleToLearners(): bool
    {
        return match ($this) {
            self::Published, self::Closed => true,
            self::Draft, self::DeanApproved, self::ExecutiveApproved => false,
        };
    }
}
