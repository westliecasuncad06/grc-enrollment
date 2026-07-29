import type {
  AcademicTerm,
  Section,
  Subject,
} from "@/features/schemas/reference-data-schema"
import {
  facultyAvailabilitiesEnvelopeSchema,
  facultyAvailabilityEnvelopeSchema,
  facultyAvailabilityInputSchema,
  facultySubjectPreferenceEnvelopeSchema,
  facultySubjectPreferenceInputSchema,
  facultySubjectPreferencesEnvelopeSchema,
  type FacultyAvailability,
  type FacultyAvailabilityInput,
  type FacultySubjectPreference,
  type FacultySubjectPreferenceInput,
} from "@/features/schemas/faculty-schema"
import {
  ApiClientError,
  deleteAuthenticatedJson,
  getAuthenticatedJson,
  patchAuthenticatedJson,
  postAuthenticatedJson,
} from "@/features/services/api-client"
import { formatAcademicTerm } from "@/features/services/reference-data-service"

export const FACULTY_AVAILABILITIES_PATH = "/api/v1/faculty-availabilities"
export const FACULTY_SUBJECT_PREFERENCES_PATH =
  "/api/v1/faculty-subject-preferences"

function parseContract<T>(
  schema: {
    safeParse: (
      payload: unknown,
    ) => { success: true; data: T } | { success: false; error: unknown }
  },
  payload: unknown,
  label: string,
): T {
  const parsed = schema.safeParse(payload)

  if (parsed.success) {
    return parsed.data
  }

  throw new ApiClientError({
    kind: "contract",
    message: `The API responded, but its ${label} did not match the published v1 contract.`,
    cause: parsed.error,
  })
}

function parseInput<T>(
  schema: {
    safeParse: (
      payload: unknown,
    ) => { success: true; data: T } | { success: false; error: unknown }
  },
  input: unknown,
  label: string,
): T {
  const parsed = schema.safeParse(input)

  if (parsed.success) {
    return parsed.data
  }

  throw new ApiClientError({
    kind: "contract",
    message: `The ${label} request did not match the published v1 contract.`,
    cause: parsed.error,
  })
}

export async function getFacultyAvailabilities(
  signal?: AbortSignal,
): Promise<readonly FacultyAvailability[]> {
  const payload = await getAuthenticatedJson(
    FACULTY_AVAILABILITIES_PATH,
    signal,
  )
  return parseContract(
    facultyAvailabilitiesEnvelopeSchema,
    payload,
    "faculty availability list",
  ).data
}

export async function createFacultyAvailability(
  input: FacultyAvailabilityInput,
): Promise<FacultyAvailability> {
  const payload = await postAuthenticatedJson(
    FACULTY_AVAILABILITIES_PATH,
    parseInput(facultyAvailabilityInputSchema, input, "faculty availability"),
  )
  return parseContract(
    facultyAvailabilityEnvelopeSchema,
    payload,
    "created faculty availability",
  ).data
}

export async function updateFacultyAvailability(
  id: number,
  input: FacultyAvailabilityInput,
): Promise<FacultyAvailability> {
  const payload = await patchAuthenticatedJson(
    `${FACULTY_AVAILABILITIES_PATH}/${id}`,
    parseInput(facultyAvailabilityInputSchema, input, "faculty availability"),
  )
  return parseContract(
    facultyAvailabilityEnvelopeSchema,
    payload,
    "updated faculty availability",
  ).data
}

export async function deleteFacultyAvailability(id: number): Promise<void> {
  await deleteAuthenticatedJson(`${FACULTY_AVAILABILITIES_PATH}/${id}`)
}

export async function getFacultySubjectPreferences(
  signal?: AbortSignal,
): Promise<readonly FacultySubjectPreference[]> {
  const payload = await getAuthenticatedJson(
    FACULTY_SUBJECT_PREFERENCES_PATH,
    signal,
  )
  return parseContract(
    facultySubjectPreferencesEnvelopeSchema,
    payload,
    "faculty subject preference list",
  ).data
}

export async function createFacultySubjectPreference(
  input: FacultySubjectPreferenceInput,
): Promise<FacultySubjectPreference> {
  const payload = await postAuthenticatedJson(
    FACULTY_SUBJECT_PREFERENCES_PATH,
    parseInput(
      facultySubjectPreferenceInputSchema,
      input,
      "faculty subject preference",
    ),
  )
  return parseContract(
    facultySubjectPreferenceEnvelopeSchema,
    payload,
    "created faculty subject preference",
  ).data
}

export async function updateFacultySubjectPreference(
  id: number,
  input: FacultySubjectPreferenceInput,
): Promise<FacultySubjectPreference> {
  const payload = await patchAuthenticatedJson(
    `${FACULTY_SUBJECT_PREFERENCES_PATH}/${id}`,
    parseInput(
      facultySubjectPreferenceInputSchema,
      input,
      "faculty subject preference",
    ),
  )
  return parseContract(
    facultySubjectPreferenceEnvelopeSchema,
    payload,
    "updated faculty subject preference",
  ).data
}

export async function deleteFacultySubjectPreference(
  id: number,
): Promise<void> {
  await deleteAuthenticatedJson(`${FACULTY_SUBJECT_PREFERENCES_PATH}/${id}`)
}

export interface TeachingScheduleRow {
  sectionId: number
  subjectCode: string
  subjectTitle: string
  termLabel: string
  days: string
  time: string
  room: string
  statusLabel: string
}

function formatTime(value: string | null): string {
  return value?.slice(0, 5) ?? "Time pending"
}

/**
 * Translates only the already API-scoped section list into display rows. The
 * browser never asks for rosters or grades, and does not broaden that scope.
 */
export function getFacultyTeachingSchedule(
  sections: readonly Section[],
  subjects: readonly Subject[],
  terms: readonly AcademicTerm[],
): TeachingScheduleRow[] {
  const subjectsById = new Map(subjects.map((subject) => [subject.id, subject]))
  const termsById = new Map(terms.map((term) => [term.id, term]))

  return sections.map((section) => {
    const subject = subjectsById.get(section.subject_id)
    const term = termsById.get(section.academic_term_id)

    return {
      sectionId: section.id,
      subjectCode: subject?.code ?? "Subject unavailable",
      subjectTitle: subject?.title ?? "Subject details unavailable",
      termLabel: term ? formatAcademicTerm(term) : "Term unavailable",
      days: section.schedule_days ?? "Days pending",
      time:
        section.starts_at_time && section.ends_at_time
          ? `${formatTime(section.starts_at_time)}–${formatTime(section.ends_at_time)}`
          : "Time pending",
      room: section.room ?? "Room pending",
      statusLabel: section.status_label,
    }
  })
}
