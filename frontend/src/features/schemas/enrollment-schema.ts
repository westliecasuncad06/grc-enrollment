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

export const enrollmentSchema = z
  .object({
    type: z.literal("enrollment"),
    id: z.number().int().positive(),
    academic_term_id: z.number().int().positive(),
    status: z.enum([
      "draft",
      "pending_registrar_approval",
      "pending_payment",
      "enrolled",
      "rejected",
      "cancelled",
      "withdrawn",
    ]),
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

export const enrollmentsEnvelopeSchema = z
  .object({ data: z.array(enrollmentSchema) })
  .strict()

export const storeEnrollmentInputSchema = z
  .object({
    academic_term_id: z.number().int().positive("Select an academic term."),
    sections: z
      .array(z.object({ section_id: z.number().int().positive() }).strict())
      .min(1, "Select at least one section before submitting."),
  })
  .strict()

export type EligibleSubjectReason = z.infer<typeof eligibleSubjectReasonSchema>
export type EligibleSubject = z.infer<typeof eligibleSubjectSchema>
export type Enrollment = z.infer<typeof enrollmentSchema>
export type StoreEnrollmentInput = z.infer<typeof storeEnrollmentInputSchema>
