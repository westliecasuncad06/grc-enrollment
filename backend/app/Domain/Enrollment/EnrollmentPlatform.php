<?php

namespace App\Domain\Enrollment;

/**
 * How classes are delivered for a term's enrollees, as printed on the
 * Certificate of Registration (stakeholder Doc 14). Students have no platform
 * of their own, so the Registrar Head sets one value for the whole enrolling
 * population of a term (`academic_terms.enrollment_platform`); it is not the
 * per-section `SectionModality` (HyFlex / F2F).
 */
enum EnrollmentPlatform: string
{
    case Online = 'online';
    case FaceToFace = 'face_to_face';

    public function label(): string
    {
        return match ($this) {
            self::Online => 'Online',
            self::FaceToFace => 'Face-to-Face',
        };
    }
}
