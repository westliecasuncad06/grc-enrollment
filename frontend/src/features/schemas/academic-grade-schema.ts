import { z } from "zod"

const gradeStatusValues = ["draft", "submitted", "locked"] as const

// Mirrors App\Domain\Academic\GradeMark's exact case order.
export const gradeMarkValues = [
  "1.00",
  "1.25",
  "1.50",
  "1.75",
  "2.00",
  "2.25",
  "2.50",
  "2.75",
  "3.00",
  "5.00",
  "C",
  "NC",
  "INC",
  "DRP",
] as const

/** The four non-numeric marks — never sent for an ordinary academic subject. */
export const completionOnlyMarkValues = ["C", "NC", "INC", "DRP"] as const

/** Every mark an ordinary (non-completion-only) subject may take. */
export const academicMarkValues = [
  "1.00",
  "1.25",
  "1.50",
  "1.75",
  "2.00",
  "2.25",
  "2.50",
  "2.75",
  "3.00",
  "5.00",
  "INC",
  "DRP",
] as const

export const academicGradeSchema = z
  .object({
    type: z.literal("academic_grade"),
    id: z.number().int().positive(),
    student_id: z.number().int().positive(),
    student_number: z.string().min(1),
    subject_id: z.number().int().positive(),
    subject_code: z.string().min(1),
    section_id: z.number().int().positive().nullable(),
    academic_term_id: z.number().int().positive(),
    mark: z.enum(gradeMarkValues).nullable(),
    mark_label: z.string().nullable(),
    final_grade: z.string().nullable(),
    remarks: z.string().nullable(),
    status: z.enum(gradeStatusValues),
    status_label: z.string().min(1),
    submitted_at: z.iso.datetime().nullable(),
    locked_at: z.iso.datetime().nullable(),
  })
  .strict()

export const academicGradeEnvelopeSchema = z
  .object({ data: academicGradeSchema })
  .strict()

const paginationLinksSchema = z
  .object({
    first: z.string().url(),
    last: z.string().url(),
    prev: z.string().url().nullable(),
    next: z.string().url().nullable(),
  })
  .strict()
const paginationMetaSchema = z
  .object({
    current_page: z.number().int().positive(),
    last_page: z.number().int().positive(),
    per_page: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
  })
  .passthrough()

export const paginatedAcademicGradesSchema = z
  .object({
    data: z.array(academicGradeSchema),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  })
  .strict()

export const academicGradeFiltersSchema = z
  .object({
    student_id: z.number().int().positive().optional(),
    subject_id: z.number().int().positive().optional(),
    academic_term_id: z.number().int().positive().optional(),
    status: z.enum(gradeStatusValues).optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()

export const storeAcademicGradeInputSchema = z
  .object({
    student_id: z.number().int().positive(),
    subject_id: z.number().int().positive(),
    section_id: z.number().int().positive(),
    academic_term_id: z.number().int().positive(),
    mark: z.enum(gradeMarkValues).optional(),
    remarks: z.string().optional(),
  })
  .strict()

/**
 * No `action` means a plain content edit; `action: submit`/`lock` is a pure
 * status transition — mirroring the backend's `UpdateAcademicGradeRequest`,
 * content fields and `action` are never sent together.
 */
export const updateAcademicGradeInputSchema = z.union([
  z
    .object({
      mark: z.enum(gradeMarkValues).optional(),
      remarks: z.string().optional(),
    })
    .strict(),
  z.object({ action: z.enum(["submit", "lock"]) }).strict(),
])

export type AcademicGrade = z.infer<typeof academicGradeSchema>
export type AcademicGradeFilters = z.input<typeof academicGradeFiltersSchema>
export type StoreAcademicGradeInput = z.infer<
  typeof storeAcademicGradeInputSchema
>
export type UpdateAcademicGradeInput = z.infer<
  typeof updateAcademicGradeInputSchema
>
export interface Paginated<T> {
  data: readonly T[]
  links: z.infer<typeof paginationLinksSchema>
  meta: z.infer<typeof paginationMetaSchema>
}
