import { z } from "zod"

const prerequisiteSchema = z
  .object({
    prerequisite_subject_id: z.number().int().positive(),
    minimum_grade: z
      .string()
      .trim()
      .min(1, "Enter the required minimum grade."),
  })
  .strict()

export const curriculumSubjectInputSchema = z
  .object({
    subject_id: z.number().int().positive(),
    year_level: z.number().int().positive("Year level must be at least 1."),
    semester: z.string().trim().min(1, "Select a semester."),
    is_required: z.boolean(),
    prerequisites: z.array(prerequisiteSchema),
  })
  .strict()

const replacementShape = {
  name: z.string().trim().min(1, "Enter a curriculum name."),
  effective_school_year: z
    .string()
    .trim()
    .min(1, "Enter the effective school year."),
  subjects: z.array(curriculumSubjectInputSchema),
}

function graphHasCycle(subjects: readonly CurriculumSubjectInput[]): boolean {
  const graph = new Map<number, number[]>()
  for (const subject of subjects) {
    graph.set(
      subject.subject_id,
      subject.prerequisites.map((edge) => edge.prerequisite_subject_id),
    )
  }
  const visited = new Set<number>()
  const active = new Set<number>()
  const visit = (node: number): boolean => {
    if (active.has(node)) return true
    if (visited.has(node)) return false
    visited.add(node)
    active.add(node)
    const cyclic = (graph.get(node) ?? []).some(visit)
    active.delete(node)
    return cyclic
  }
  return [...graph.keys()].some(visit)
}

export const curriculumReplacementSchema = z
  .object(replacementShape)
  .strict()
  .superRefine((value, context) => {
    const ids = value.subjects.map((subject) => subject.subject_id)
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["subjects"],
        message: "A subject can only be placed once in a curriculum.",
      })
    }
    for (const [index, subject] of value.subjects.entries()) {
      if (
        subject.prerequisites.some(
          (edge) => edge.prerequisite_subject_id === subject.subject_id,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["subjects", index, "prerequisites"],
          message: "A subject cannot be its own prerequisite.",
        })
      }
    }
    if (graphHasCycle(value.subjects)) {
      context.addIssue({
        code: "custom",
        path: ["subjects"],
        message: "The prerequisite graph contains a cycle.",
      })
    }
  })

export const storeCurriculumInputSchema = z
  .object({
    program_id: z.number().int().positive("Select a program."),
    ...replacementShape,
  })
  .strict()
  .superRefine((value, context) => {
    const result = curriculumReplacementSchema.safeParse({
      name: value.name,
      effective_school_year: value.effective_school_year,
      subjects: value.subjects,
    })
    if (!result.success) {
      for (const issue of result.error.issues) {
        context.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        })
      }
    }
  })

export const curriculumTransitionSchema = z
  .object({
    action: z.enum([
      "submit",
      "dean_approve",
      "dean_return",
      "executive_approve",
      "executive_return",
    ]),
    reason: z.string().trim().min(1).optional(),
  })
  .strict()

export type CurriculumTransition = z.infer<typeof curriculumTransitionSchema>
export type CurriculumAction = CurriculumTransition["action"]

export type CurriculumSubjectInput = z.infer<
  typeof curriculumSubjectInputSchema
>
export type UpdateCurriculumInput = z.infer<typeof curriculumReplacementSchema>
export type StoreCurriculumInput = z.infer<typeof storeCurriculumInputSchema>
export interface CurriculumEditorValues {
  name: string
  effective_school_year: string
  subjects: readonly {
    subject_id: number
    year_level: number
    semester: string
    is_required: boolean
    prerequisites: readonly {
      prerequisite_subject_id: number
      minimum_grade: string
    }[]
  }[]
  id?: number
  program_id?: number
}
