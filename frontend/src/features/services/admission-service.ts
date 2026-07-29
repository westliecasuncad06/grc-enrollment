import {
  studentProfileEnvelopeSchema,
  type ProvisionStudentInput,
  type StudentProfile,
} from "@/features/schemas/admission-schema"
import {
  ApiClientError,
  postAuthenticatedJson,
} from "@/features/services/api-client"

export const STUDENT_PROFILES_PATH = "/api/v1/student-profiles"

export type { ProvisionStudentInput, StudentProfile }

export async function provisionStudent(
  input: ProvisionStudentInput,
): Promise<StudentProfile> {
  const payload = await postAuthenticatedJson(STUDENT_PROFILES_PATH, input)
  const parsed = studentProfileEnvelopeSchema.safeParse(payload)

  if (!parsed.success) {
    throw new ApiClientError({
      kind: "contract",
      message:
        "The API responded, but its created student profile did not match the published v1 contract.",
      cause: parsed.error,
    })
  }

  return parsed.data.data
}
