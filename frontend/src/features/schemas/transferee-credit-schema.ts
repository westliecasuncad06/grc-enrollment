import { z } from "zod"

const transfereeCreditStatusValues = [
  "pending",
  "approved",
  "rejected",
] as const

export const transfereeCreditResourceSchema = z
  .object({
    type: z.literal("transferee_credit"),
    id: z.number().int().positive(),
    student_id: z.number().int().positive(),
    student_number: z.string().min(1),
    source_institution: z.string().min(1),
    source_subject_code: z.string().min(1),
    source_subject_title: z.string().min(1),
    source_grade: z.string().nullable(),
    credited_units: z.number().int().min(1),
    subject_id: z.number().int().positive().nullable(),
    subject_code: z.string().nullable(),
    status: z.enum(transfereeCreditStatusValues),
    status_label: z.string().min(1),
    processed_at: z.iso.datetime().nullable(),
    created_at: z.iso.datetime().nullable(),
  })
  .strict()

export const transfereeCreditEnvelopeSchema = z
  .object({ data: transfereeCreditResourceSchema })
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

export const paginatedTransfereeCreditsSchema = z
  .object({
    data: z.array(transfereeCreditResourceSchema),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  })
  .strict()

export const transfereeCreditFiltersSchema = z
  .object({
    status: z.enum(transfereeCreditStatusValues).optional(),
    student_id: z.number().int().positive().optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()

export const createTransfereeCreditInputSchema = z
  .object({
    student_id: z.number().int().positive(),
    source_institution: z.string().min(1),
    source_subject_code: z.string().min(1),
    source_subject_title: z.string().min(1),
    source_grade: z.string().min(1).optional(),
    credited_units: z.number().int().min(1).max(255),
    subject_id: z.number().int().positive().optional(),
  })
  .strict()

export const decideTransfereeCreditInputSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    reason: z.string().min(1).optional(),
  })
  .strict()

export type TransfereeCredit = z.infer<typeof transfereeCreditResourceSchema>
export type TransfereeCreditFilters = z.input<
  typeof transfereeCreditFiltersSchema
>
export type CreateTransfereeCreditInput = z.infer<
  typeof createTransfereeCreditInputSchema
>
export type DecideTransfereeCreditInput = z.infer<
  typeof decideTransfereeCreditInputSchema
>
export interface Paginated<T> {
  data: readonly T[]
  links: z.infer<typeof paginationLinksSchema>
  meta: z.infer<typeof paginationMetaSchema>
}
