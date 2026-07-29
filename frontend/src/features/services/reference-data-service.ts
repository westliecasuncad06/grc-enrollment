import {
  academicTermsEnvelopeSchema,
  curriculaEnvelopeSchema,
  programsEnvelopeSchema,
  subjectsEnvelopeSchema,
  type AcademicTerm,
  type Curriculum,
  type Program,
  type Subject,
} from "@/features/schemas/reference-data-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
} from "@/features/services/api-client"

export const ACADEMIC_TERMS_PATH = "/api/v1/academic-terms"
export const PROGRAMS_PATH = "/api/v1/programs"
export const SUBJECTS_PATH = "/api/v1/subjects"
export const CURRICULA_PATH = "/api/v1/curricula"

function parseResponse<T>(
  schema: {
    safeParse: (
      payload: unknown,
    ) => { success: true; data: T } | { success: false; error: unknown }
  },
  payload: unknown,
  resourceName: string,
): T {
  const parsed = schema.safeParse(payload)

  if (!parsed.success) {
    throw new ApiClientError({
      kind: "contract",
      message: `The API responded, but its ${resourceName} payload did not match the published v1 contract.`,
      cause: parsed.error,
    })
  }

  return parsed.data
}

export async function getAcademicTerms(
  signal?: AbortSignal,
): Promise<readonly AcademicTerm[]> {
  const payload = await getAuthenticatedJson(ACADEMIC_TERMS_PATH, signal)
  return parseResponse(academicTermsEnvelopeSchema, payload, "academic terms")
    .data
}

export async function getPrograms(
  signal?: AbortSignal,
): Promise<readonly Program[]> {
  const payload = await getAuthenticatedJson(PROGRAMS_PATH, signal)
  return parseResponse(programsEnvelopeSchema, payload, "programs").data
}

export async function getSubjects(
  signal?: AbortSignal,
): Promise<readonly Subject[]> {
  const payload = await getAuthenticatedJson(SUBJECTS_PATH, signal)
  return parseResponse(subjectsEnvelopeSchema, payload, "subjects").data
}

export async function getCurricula(
  signal?: AbortSignal,
): Promise<readonly Curriculum[]> {
  const payload = await getAuthenticatedJson(CURRICULA_PATH, signal)
  return parseResponse(curriculaEnvelopeSchema, payload, "curricula").data
}

export function getActiveAcademicTerm(
  terms: readonly AcademicTerm[] | undefined,
): AcademicTerm | null {
  return terms?.find((term) => term.status === "active") ?? null
}

export function formatAcademicTerm(term: AcademicTerm): string {
  return `${term.school_year} · ${term.semester}`
}
