import type { Curriculum } from "@/features/schemas/reference-data-schema"
import { z } from "zod"
import {
  storeCurriculumInputSchema,
  curriculumReplacementSchema,
  curriculumTransitionSchema,
  type CurriculumEditorValues,
  type CurriculumTransition,
  type StoreCurriculumInput,
  type UpdateCurriculumInput,
} from "@/features/schemas/curriculum-schema"
import { curriculumSchema } from "@/features/schemas/reference-data-schema"
import {
  ApiClientError,
  patchAuthenticatedJson,
  postAuthenticatedJson,
} from "@/features/services/api-client"

export const CURRICULA_PATH = "/api/v1/curricula"

function parse<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false; error: unknown }
  },
  value: unknown,
  label: string,
): T {
  const parsed = schema.safeParse(value)
  if (parsed.success) return parsed.data
  throw new ApiClientError({
    kind: "contract",
    message: `The ${label} did not match the published v1 contract.`,
    cause: parsed.error,
  })
}

export function toCurriculumReplacement(
  values: CurriculumEditorValues,
): UpdateCurriculumInput {
  return parse(
    curriculumReplacementSchema,
    {
      name: values.name,
      effective_school_year: values.effective_school_year,
      subjects: values.subjects.map((subject) => ({
        subject_id: subject.subject_id,
        year_level: subject.year_level,
        semester: subject.semester,
        is_required: subject.is_required,
        prerequisites: subject.prerequisites.map((edge) => ({
          prerequisite_subject_id: edge.prerequisite_subject_id,
          minimum_grade: edge.minimum_grade,
        })),
      })),
    },
    "curriculum replacement",
  )
}

export async function createCurriculum(
  input: StoreCurriculumInput,
): Promise<Curriculum> {
  const payload = await postAuthenticatedJson(
    CURRICULA_PATH,
    parse(storeCurriculumInputSchema, input, "curriculum create request"),
  )
  return parse(zEnvelope, payload, "created curriculum").data
}

export async function replaceCurriculum(
  id: number,
  input: UpdateCurriculumInput,
): Promise<Curriculum> {
  const payload = await patchAuthenticatedJson(
    `${CURRICULA_PATH}/${id}`,
    parse(curriculumReplacementSchema, input, "curriculum replacement request"),
  )
  return parse(zEnvelope, payload, "updated curriculum").data
}

export async function transitionCurriculum(
  id: number,
  transition: CurriculumTransition,
): Promise<Curriculum> {
  const payload = await patchAuthenticatedJson(
    `${CURRICULA_PATH}/${id}/transition`,
    parse(curriculumTransitionSchema, transition, "curriculum transition request"),
  )
  return parse(zEnvelope, payload, "transitioned curriculum").data
}

const curriculumEnvelopeSchema = z.object({ data: curriculumSchema }).strict()

const zEnvelope = {
  safeParse: (payload: unknown) => curriculumEnvelopeSchema.safeParse(payload),
}
