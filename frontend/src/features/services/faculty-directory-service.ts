import {
  facultyMemberEnvelopeSchema,
  facultyMembersEnvelopeSchema,
  facultyWorkforceProfileInputSchema,
  type FacultyMember,
  type FacultyWorkforceProfileInput,
} from "@/features/schemas/scheduling-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  patchAuthenticatedJson,
} from "@/features/services/api-client"

export const FACULTY_MEMBERS_PATH = "/api/v1/faculty-members"

export async function getFacultyMembers(
  signal?: AbortSignal,
  includeInactive = false,
): Promise<readonly FacultyMember[]> {
  const payload = await getAuthenticatedJson(
    includeInactive
      ? `${FACULTY_MEMBERS_PATH}?include_inactive=1`
      : FACULTY_MEMBERS_PATH,
    signal,
  )
  const result = facultyMembersEnvelopeSchema.safeParse(payload)
  if (result.success) return result.data.data
  throw new ApiClientError({
    kind: "contract",
    message:
      "The API responded, but its faculty directory did not match the published v1 contract.",
    cause: result.error,
  })
}

export async function updateFacultyWorkforceProfile(
  facultyId: number,
  input: FacultyWorkforceProfileInput,
): Promise<FacultyMember> {
  const payload = await patchAuthenticatedJson(
    `${FACULTY_MEMBERS_PATH}/${facultyId}/workforce-profile`,
    facultyWorkforceProfileInputSchema.parse(input),
  )
  const result = facultyMemberEnvelopeSchema.safeParse(payload)
  if (result.success) return result.data.data
  throw new ApiClientError({
    kind: "contract",
    message:
      "The API responded, but its faculty workforce update did not match the published v1 contract.",
    cause: result.error,
  })
}
