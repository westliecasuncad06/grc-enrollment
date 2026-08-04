import { z } from "zod"

export const sectionPlanSchema = z
  .object({
    type: z.literal("academic-term-section-plan"),
    id: z.number().int().positive(),
    academic_term_id: z.number().int().positive(),
    curriculum_id: z.number().int().positive(),
    college: z.enum(["ccs", "coe", "coa", "cbae"]),
    year_level: z.number().int().min(1).max(4),
    section_count: z.number().int().min(0),
    students_per_block: z.number().int().min(1),
    status: z.enum(["draft", "submitted"]),
    status_label: z.string(),
    submitted_at: z.string().nullable(),
  })
  .strict()

export const sectionPlansEnvelopeSchema = z.object({ data: z.array(sectionPlanSchema) }).strict()
export const sectionPlanCountsSchema = z.object({
  academic_term_id: z.number().int().positive(),
  curriculum_id: z.number().int().positive(),
  counts: z.record(z.string(), z.number().int().min(0).max(99)).refine((value) => Object.keys(value).length === 4),
  // One entry per year level, matching `StoreSectionPlanRequest`'s
  // `size:4` rule on the same key.
  students_per_block: z
    .record(z.string(), z.number().int().min(1).max(300))
    .refine((value) => Object.keys(value).length === 4),
}).strict()

export type SectionPlan = z.infer<typeof sectionPlanSchema>
export type SectionPlanCounts = z.infer<typeof sectionPlanCountsSchema>
