import { z } from "zod"

export const enrollmentDocumentSchema = z
  .object({
    type: z.literal("enrollment_document"),
    id: z.number().int().positive(),
    enrollment_id: z.number().int().positive(),
    student_number: z.string().min(1),
    student_name: z.string().min(1).nullable().optional(),
    document_type: z.literal("cor"),
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
    student_number: z.string().trim().min(1).max(100).optional(),
    student_name: z.string().trim().min(1).max(100).optional(),
    document_type: z.literal("cor").optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()

export type EnrollmentDocument = z.infer<typeof enrollmentDocumentSchema>
export type EnrollmentDocumentFilters = z.input<
  typeof enrollmentDocumentFiltersSchema
>

const corMoneyItemSchema = z
  .object({
    label: z.string().min(1),
    quantity: z.string().nullable(),
    unit_amount: z.string().nullable(),
    amount: z.string(),
  })
  .strict()

export const corSnapshotSchema = z
  .object({
    document_title: z.literal("Certificate of Registration"),
    institution: z
      .object({ name: z.string().min(1), address: z.string().min(1) })
      .strict(),
    student: z
      .object({
        student_number: z.string().min(1),
        name: z.string().min(1),
        address: z.string().min(1),
        course: z.string().min(1),
        level: z.string().min(1),
        platform: z.string().min(1),
      })
      .strict(),
    term: z
      .object({ school_year: z.string().min(1), semester: z.string().min(1) })
      .strict(),
    subjects: z.array(
      z
        .object({
          code: z.string().min(1),
          title: z.string().min(1),
          units: z.string(),
          section: z.string().min(1),
          schedule_id: z.string().min(1),
          schedule: z.string().min(1),
          room: z.string().min(1),
        })
        .strict(),
    ),
    total_units: z.string(),
    admission_certification: z.string().min(1),
    fees: z
      .object({
        currency: z.string().min(1),
        tuition: z.array(corMoneyItemSchema),
        other_fees: z.array(corMoneyItemSchema),
        total_tuition: z.string(),
        total_other_fees: z.string(),
        grand_total: z.string(),
        payment_amount: z.string(),
      })
      .strict(),
    signatories: z
      .object({ cashier: z.string().min(1), registrar: z.string().min(1) })
      .strict(),
    withdrawal_terms: z.array(z.string().min(1)),
  })
  .strict()

export const certificateOfRegistrationSchema = z
  .object({
    type: z.literal("certificate_of_registration"),
    id: z.number().int().positive(),
    enrollment_id: z.number().int().positive(),
    document_number: z.string().min(1),
    generated_at: z.iso.datetime(),
    content_hash: z.string().nullable(),
    snapshot: corSnapshotSchema.nullable(),
  })
  .strict()

export const certificateOfRegistrationResponseSchema = z
  .object({ data: certificateOfRegistrationSchema })
  .strict()

export type CorSnapshot = z.infer<typeof corSnapshotSchema>
export type CertificateOfRegistration = z.infer<
  typeof certificateOfRegistrationSchema
>
export interface Paginated<T> {
  data: readonly T[]
  links: z.infer<typeof paginationLinksSchema>
  meta: z.infer<typeof paginationMetaSchema>
}
