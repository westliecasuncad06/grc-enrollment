import {
  academicGradeEnvelopeSchema,
  academicGradeFiltersSchema,
  paginatedAcademicGradesSchema,
  storeAcademicGradeInputSchema,
  updateAcademicGradeInputSchema,
  type AcademicGrade,
  type AcademicGradeFilters,
  type Paginated,
  type StoreAcademicGradeInput,
  type UpdateAcademicGradeInput,
} from "@/features/schemas/academic-grade-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  patchAuthenticatedJson,
  postAuthenticatedJson,
} from "@/features/services/api-client"

export const ACADEMIC_GRADES_PATH = "/api/v1/academic-grades"

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

export async function listAcademicGrades(
  filters: AcademicGradeFilters,
  signal?: AbortSignal,
): Promise<Paginated<AcademicGrade>> {
  const parsed = parse(academicGradeFiltersSchema, filters, "grade filter")
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined) query.set(key, String(value))
  }
  return parse(
    paginatedAcademicGradesSchema,
    await getAuthenticatedJson(
      `${ACADEMIC_GRADES_PATH}?${query.toString()}`,
      signal,
    ),
    "grade list",
  )
}

export async function createAcademicGrade(
  input: StoreAcademicGradeInput,
): Promise<AcademicGrade> {
  const payload = await postAuthenticatedJson(
    ACADEMIC_GRADES_PATH,
    parse(storeAcademicGradeInputSchema, input, "grade request"),
  )
  return parse(academicGradeEnvelopeSchema, payload, "created grade").data
}

export async function updateAcademicGrade(
  id: number,
  input: UpdateAcademicGradeInput,
): Promise<AcademicGrade> {
  const payload = await patchAuthenticatedJson(
    `${ACADEMIC_GRADES_PATH}/${id}`,
    parse(updateAcademicGradeInputSchema, input, "grade update"),
  )
  return parse(academicGradeEnvelopeSchema, payload, "updated grade").data
}
