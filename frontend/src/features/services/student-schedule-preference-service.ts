import {
  studentSchedulePreferenceEnvelopeSchema,
  studentSchedulePreferenceInputSchema,
  type StudentSchedulePreference,
  type StudentSchedulePreferenceInput,
} from "@/features/schemas/student-schedule-preference-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  putAuthenticatedJson,
} from "@/features/services/api-client"

export const STUDENT_SCHEDULE_PREFERENCE_PATH =
  "/api/v1/student-schedule-preferences"

function parse<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false; error: unknown }
  },
  value: unknown,
  label: string,
): T {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  throw new ApiClientError({
    kind: "contract",
    message: `The API responded, but its ${label} did not match the published v1 contract.`,
    cause: result.error,
  })
}

/** The caller's own row, or an unsaved default when none exists yet. */
export async function getStudentSchedulePreference(
  signal?: AbortSignal,
): Promise<StudentSchedulePreference> {
  const payload = await getAuthenticatedJson(
    STUDENT_SCHEDULE_PREFERENCE_PATH,
    signal,
  )
  return parse(
    studentSchedulePreferenceEnvelopeSchema,
    payload,
    "student schedule preference",
  ).data
}

/**
 * PUT is a full-replace upsert (Task 1 review) — every field not included in
 * the body is reset to its default on the backend, so callers must always
 * pass the complete current form state, never a partial diff.
 */
export async function saveStudentSchedulePreference(
  input: StudentSchedulePreferenceInput,
): Promise<StudentSchedulePreference> {
  const payload = await putAuthenticatedJson(
    STUDENT_SCHEDULE_PREFERENCE_PATH,
    parse(
      studentSchedulePreferenceInputSchema,
      input,
      "student schedule preference",
    ),
  )
  return parse(
    studentSchedulePreferenceEnvelopeSchema,
    payload,
    "saved student schedule preference",
  ).data
}
