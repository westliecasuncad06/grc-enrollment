import {
  facultyMembersEnvelopeSchema,
  type FacultyMember,
} from "@/features/schemas/scheduling-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
} from "@/features/services/api-client"

export const FACULTY_MEMBERS_PATH = "/api/v1/faculty-members"

export async function getFacultyMembers(
  signal?: AbortSignal,
): Promise<readonly FacultyMember[]> {
  const payload = await getAuthenticatedJson(FACULTY_MEMBERS_PATH, signal)
  const result = facultyMembersEnvelopeSchema.safeParse(payload)
  if (result.success) return result.data.data
  throw new ApiClientError({
    kind: "contract",
    message:
      "The API responded, but its faculty directory did not match the published v1 contract.",
    cause: result.error,
  })
}
