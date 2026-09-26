import {
  admissionChecklistEnvelopeSchema,
  admissionRequirementTypeEnvelopeSchema,
  createAdmissionRequirementTypeSchema,
  setAdmissionRequirementSchema,
  type AdmissionChecklist,
  type CreateAdmissionRequirementTypeInput,
} from "@/features/schemas/admission-requirements-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  postAuthenticatedJson,
  putAuthenticatedJson,
} from "@/features/services/api-client"

function parseChecklist(payload: unknown): AdmissionChecklist {
  const result = admissionChecklistEnvelopeSchema.safeParse(payload)
  if (result.success) return result.data.data

  throw new ApiClientError({
    kind: "contract",
    message:
      "The API responded, but its Admission checklist did not match the published v1 contract.",
    cause: result.error,
  })
}

/** `studentId` null reads the signed-in Student's own; a number is Admission Staff's read of that student. */
export async function getAdmissionChecklist(
  studentId: number | null,
  signal?: AbortSignal,
): Promise<AdmissionChecklist> {
  return parseChecklist(
    await getAuthenticatedJson(
      studentId === null
        ? "/api/v1/me/admission-requirements"
        : `/api/v1/student-profiles/${studentId}/admission-requirements`,
      signal,
    ),
  )
}

export async function setAdmissionRequirementSubmitted(
  studentId: number,
  requirementTypeId: number,
  isSubmitted: boolean,
): Promise<AdmissionChecklist> {
  const body = setAdmissionRequirementSchema.parse({
    is_submitted: isSubmitted,
  })

  return parseChecklist(
    await putAuthenticatedJson(
      `/api/v1/student-profiles/${studentId}/admission-requirements/${requirementTypeId}`,
      body,
    ),
  )
}

export async function createAdmissionRequirementType(
  input: CreateAdmissionRequirementTypeInput,
): Promise<void> {
  const body = createAdmissionRequirementTypeSchema.parse(input)
  const result = admissionRequirementTypeEnvelopeSchema.safeParse(
    await postAuthenticatedJson("/api/v1/admission-requirement-types", body),
  )
  if (result.success) return

  throw new ApiClientError({
    kind: "contract",
    message:
      "The API responded, but the new requirement did not match the published v1 contract.",
    cause: result.error,
  })
}
