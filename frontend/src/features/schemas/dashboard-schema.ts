import { z } from "zod"

export const enrollmentSummarySchema = z
  .object({
    type: z.literal("enrollment_summary"),
    academic_term_id: z.number().int().positive(),
    status_counts: z.record(z.string(), z.number().int().nonnegative()),
    funnel_counts: z.record(z.string(), z.number().int().nonnegative()),
    total_sections: z.number().int().nonnegative(),
    published_sections: z.number().int().nonnegative(),
    total_capacity: z.number().int().nonnegative(),
    total_enrolled_seats: z.number().int().nonnegative(),
    grade_status_counts: z.record(z.string(), z.number().int().nonnegative()),
  })
  .strict()

export const enrollmentSummaryEnvelopeSchema = z
  .object({ data: enrollmentSummarySchema })
  .strict()

const yearOverYearCountSchema = z
  .object({
    school_year: z.string().min(1),
    enrollment_count: z.number().int().nonnegative(),
  })
  .strict()

export const institutionSummarySchema = z
  .object({
    type: z.literal("institution_summary"),
    status_counts: z.record(z.string(), z.number().int().nonnegative()),
    total_programs: z.number().int().nonnegative(),
    active_programs: z.number().int().nonnegative(),
    total_sections: z.number().int().nonnegative(),
    published_sections: z.number().int().nonnegative(),
    program_counts: z.record(z.string(), z.number().int().nonnegative()),
    year_over_year: z.array(yearOverYearCountSchema),
  })
  .strict()

export const institutionSummaryEnvelopeSchema = z
  .object({ data: institutionSummarySchema })
  .strict()

const policyValueStatusSchema = z.enum([
  "configured",
  "provisional",
  "unset",
  "no_mechanism",
])

const policyValueStateSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    current_value: z.string().nullable(),
    status: policyValueStatusSchema,
    status_label: z.string().min(1),
    description: z.string().min(1),
    prd_reference: z.string().nullable(),
  })
  .strict()

export const policySettingsSummarySchema = z
  .object({
    type: z.literal("policy_settings_summary"),
    values: z.array(policyValueStateSchema),
  })
  .strict()

export const policySettingsEnvelopeSchema = z
  .object({ data: policySettingsSummarySchema })
  .strict()

export const stuckEnrollmentSchema = z
  .object({
    type: z.literal("stuck_enrollment"),
    enrollment_id: z.number().int().positive(),
    student_number: z.string().min(1),
    status: z.string().min(1),
    status_label: z.string().min(1),
    days_in_status: z.number().int().nonnegative(),
    is_flagged: z.boolean(),
  })
  .strict()

const stuckEnrollmentMetaSchema = z
  .object({
    threshold_configured: z.boolean(),
    threshold_days: z.number().int().nonnegative().nullable(),
    academic_term_id: z.number().int().positive(),
  })
  .strict()

export const stuckEnrollmentsEnvelopeSchema = z
  .object({
    data: z.array(stuckEnrollmentSchema),
    meta: stuckEnrollmentMetaSchema,
  })
  .strict()

export type EnrollmentSummary = z.infer<typeof enrollmentSummarySchema>
export type InstitutionSummary = z.infer<typeof institutionSummarySchema>
export type PolicyValueState = z.infer<typeof policyValueStateSchema>
export type PolicySettingsSummary = z.infer<typeof policySettingsSummarySchema>
export type StuckEnrollment = z.infer<typeof stuckEnrollmentSchema>
export type StuckEnrollmentsResponse = z.infer<
  typeof stuckEnrollmentsEnvelopeSchema
>
