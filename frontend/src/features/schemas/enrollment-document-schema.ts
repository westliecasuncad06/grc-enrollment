import { z } from "zod"

export const enrollmentDocumentSchema = z
  .object({
    type: z.literal("enrollment_document"),
    id: z.number().int().positive(),
    enrollment_id: z.number().int().positive(),
    student_number: z.string().min(1),
    document_type: z.literal("com"),
    document_type_label: z.string().min(1),
    document_number: z.string().min(1),
    generated_at: z.iso.datetime(),
  })
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

export const paginatedEnrollmentDocumentsSchema = z
  .object({
    data: z.array(enrollmentDocumentSchema),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  })
  .strict()

export const enrollmentDocumentFiltersSchema = z
  .object({
    enrollment_id: z.number().int().positive().optional(),
    document_type: z.literal("com").optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()

export type EnrollmentDocument = z.infer<typeof enrollmentDocumentSchema>
export type EnrollmentDocumentFilters = z.input<
  typeof enrollmentDocumentFiltersSchema
>
export interface Paginated<T> {
  data: readonly T[]
  links: z.infer<typeof paginationLinksSchema>
  meta: z.infer<typeof paginationMetaSchema>
}
