import { z } from "zod"

import { sectionSchema } from "@/features/schemas/reference-data-schema"

export const eligibleSubjectReasonSchema = z
  .object({
    code: z.enum([
      "eligible",
      "completed",
      "already_selected",
      "prerequisite",
      "prerequisite_advisory",
      "no_sections_available",
      "block_restricted",
      "block_other_year",
    ]),
    message: z.string().min(1),
  })
  .strict()

export const eligibleSubjectSchema = z
  .object({
    type: z.literal("eligible_subject"),
    subject_id: z.number().int().positive(),
    code: z.string().min(1),
    title: z.string().min(1),
    units: z.number().positive(),
    year_level: z.number().int().positive(),
    semester: z.string().min(1),
    is_required: z.boolean(),
    is_eligible: z.boolean(),
    reasons: z.array(eligibleSubjectReasonSchema),
    available_sections: z.array(sectionSchema),
  })
  .strict()

export const eligibleSubjectsEnvelopeSchema = z
  .object({ data: z.array(eligibleSubjectSchema) })
  .strict()

const enrollmentSubjectSchema = z
  .object({
    section_id: z.number().int().positive(),
    subject_code: z.string().min(1),
    subject_title: z.string().min(1),
    status: z.enum(["selected", "enrolled", "dropped"]),
    status_label: z.string().min(1),
  })
  .strict()

const queueTicketSchema = z
  .object({
    ticket_number: z.string().min(1),
    queue_date: z.string().min(1),
    status: z.enum(["waiting", "serving", "served", "cancelled"]),
    status_label: z.string().min(1),
  })
  .strict()

const enrollmentStatusValues = [
  "draft",
  "pending_registrar_approval",
  "pending_payment",
  "enrolled",
  "rejected",
  "cancelled",
  "withdrawn",
] as const

export const enrollmentSchema = z
  .object({
    type: z.literal("enrollment"),
    id: z.number().int().positive(),
    student_id: z.number().int().positive(),
    student_number: z.string().min(1),
    academic_term_id: z.number().int().positive(),
    status: z.enum(enrollmentStatusValues),
    status_label: z.string().min(1),
    total_units: z.number().nonnegative(),
    submitted_at: z.iso.datetime().nullable(),
    registrar_decided_at: z.iso.datetime().nullable(),
    payment_confirmed_at: z.iso.datetime().nullable(),
    enrolled_at: z.iso.datetime().nullable(),
    subjects: z.array(enrollmentSubjectSchema),
    queue_ticket: queueTicketSchema.nullable(),
  })
  .strict()

export const enrollmentEnvelopeSchema = z
  .object({ data: enrollmentSchema })
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

export const paginatedEnrollmentsSchema = z
  .object({
    data: z.array(enrollmentSchema),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  })
  .strict()

export const enrollmentFiltersSchema = z
  .object({
    status: z.enum(enrollmentStatusValues).optional(),
    academic_term_id: z.number().int().positive().optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()

/**
 * Two mutually exclusive submission shapes, matching
 * `StoreEnrollmentRequest`'s `sections` xor `block_code`: an irregular
 * student submits explicit per-subject sections, a regular student submits
 * one block code and the server expands it to sections itself.
 */
export const storeEnrollmentInputSchema = z.union([
  z
    .object({
      academic_term_id: z.number().int().positive("Select an academic term."),
      sections: z
        .array(z.object({ section_id: z.number().int().positive() }).strict())
        .min(1, "Select at least one section before submitting."),
    })
    .strict(),
  z
    .object({
      academic_term_id: z.number().int().positive("Select an academic term."),
      block_code: z.string().min(1, "Select a block before submitting."),
    })
    .strict(),
])

export const updateEnrollmentInputSchema = z
  .object({
    action: z.enum(["registrar_approve", "registrar_reject", "void"]),
    reason: z.string().min(1).optional(),
  })
  .strict()

export const confirmPaymentInputSchema = z
  .object({
    external_reference: z.string().optional(),
    amount: z.number().nonnegative().optional(),
  })
  .strict()

const paymentConfirmationPaymentSchema = z
  .object({
    external_reference: z.string().nullable(),
    amount: z.string().nullable(),
    confirmed_at: z.iso.datetime().nullable(),
  })
  .strict()

const paymentConfirmationDocumentSchema = z
  .object({
    document_type: z.literal("com").nullable(),
    document_number: z.string().nullable(),
    generated_at: z.iso.datetime().nullable(),
  })
  .strict()

export const paymentConfirmationEnvelopeSchema = z
  .object({
    data: z
      .object({
        enrollment: enrollmentSchema,
        payment: paymentConfirmationPaymentSchema,
        document: paymentConfirmationDocumentSchema,
      })
      .strict(),
  })
  .strict()

export type EligibleSubjectReason = z.infer<typeof eligibleSubjectReasonSchema>
export type EligibleSubject = z.infer<typeof eligibleSubjectSchema>
export type Enrollment = z.infer<typeof enrollmentSchema>
export type EnrollmentFilters = z.input<typeof enrollmentFiltersSchema>
export type StoreEnrollmentInput = z.infer<typeof storeEnrollmentInputSchema>
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentInputSchema>
export type ConfirmPaymentInput = z.infer<typeof confirmPaymentInputSchema>
export type PaymentConfirmation = z.infer<
  typeof paymentConfirmationEnvelopeSchema
>["data"]
export interface Paginated<T> {
  data: readonly T[]
  links: z.infer<typeof paginationLinksSchema>
  meta: z.infer<typeof paginationMetaSchema>
}
