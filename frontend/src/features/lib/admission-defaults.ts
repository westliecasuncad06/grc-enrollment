/**
 * Mirrors the backend's App\Domain\Identity\AdmissionIntakeDefaults exactly,
 * so the create/edit forms preview the same value the server will store.
 * Display-only: the server derives and stores the real value (Stakeholder
 * Doc 17) — this never gets submitted back as form input.
 */
export function deriveEnrollmentCategoryFromYearLevel(
  yearLevel: number,
): "regular" | "irregular" {
  return yearLevel === 1 ? "regular" : "irregular"
}

export function deriveStudentTypeFromYearLevel(
  yearLevel: number,
): "freshman" | "transferee" {
  return yearLevel === 1 ? "freshman" : "transferee"
}
