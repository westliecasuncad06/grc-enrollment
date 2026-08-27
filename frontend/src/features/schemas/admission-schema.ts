import { z } from "zod"

export const enrollmentCategorySchema = z.enum(["regular", "irregular"])
export const financialStatusSchema = z.enum(["scholar", "payee"])
export const admissionStatusSchema = z.enum([
  "pending",
  "admitted",
  "enrolled",
  "graduated",
  "withdrawn",
])
export const academicStandingSchema = z.enum(["good", "probation", "warning"])

export const personNameFieldsSchema = {
  first_name: z.string().trim().min(1, "Enter the student's first name."),
  middle_initial: z
    .string()
    .trim()
    .max(10, "Middle initial is too long.")
    .nullable()
    .optional(),
  last_name: z.string().trim().min(1, "Enter the student's last name."),
  suffix: z
    .string()
    .trim()
    .max(20, "Suffix is too long.")
    .nullable()
    .optional(),
}

export const provisionStudentSchema = z
  .object({
    ...personNameFieldsSchema,
    email: z.email("Enter a valid email address."),
    address: z.string().trim().min(1, "Enter the student's complete address."),
    student_number: z
      .string()
      .trim()
      .regex(
        /^\d{4}-(0[1-9]|1[0-2])-\d{5}$/,
        "Student number must be in YYYY-MM-NNNNN format (e.g. 2026-08-07107).",
      ),
    program_id: z.number().int().positive("Select a program."),
    entry_year: z.number().int().min(2000).max(2100),
    year_level: z.number().int().min(1).max(4),
    enrollment_category: enrollmentCategorySchema,
    financial_status: financialStatusSchema.nullable().optional(),
    requirements_verified: z.literal(true, {
      error: "Confirm that Admission received the student's requirements.",
    }),
  })
  .strict()

export const studentProfileSchema = z
  .object({
    type: z.literal("student_profile"),
    id: z.number().int().positive(),
    user_id: z.number().int().positive(),
    student_number: z.string().min(1),
    name: z.string().min(1),
    first_name: z.string().min(1),
    middle_initial: z.string().nullable(),
    last_name: z.string().min(1),
    suffix: z.string().nullable(),
    email: z.email(),
    address: z.string().nullable(),
    program_id: z.number().int().positive(),
    program_code: z.string().min(1),
    program_name: z.string().min(1),
    curriculum_id: z.number().int().positive(),
    entry_year: z.number().int().nullable(),
    curriculum_name: z.string().min(1),
    curriculum_effective_school_year: z.string().min(1),
    year_level: z.number().int().positive(),
    enrollment_category: enrollmentCategorySchema.nullable(),
    admission_status: admissionStatusSchema,
    admission_status_label: z.string().min(1),
    academic_standing: academicStandingSchema,
    academic_standing_label: z.string().min(1),
    financial_status: financialStatusSchema.nullable(),
    financial_status_label: z.string().min(1).nullable(),
    requirements_verified_at: z.iso.datetime().nullable(),
    academic_setup_editable: z.boolean(),
    account_setup_status: z.enum(["pending", "active"]),
    invitation_delivery_status: z.enum(["not_sent", "sent", "failed"]),
  })
  .strict()

export const studentProfileEnvelopeSchema = z
  .object({ data: studentProfileSchema })
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

export const studentProfileFiltersSchema = z
  .object({
    search: z.string().trim().max(255).optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()
export const paginatedStudentProfilesSchema = z
  .object({
    data: z.array(studentProfileSchema),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  })
  .strict()

export const updateStudentProfileSchema = z
  .object({
    first_name: z.string().trim().min(1).optional(),
    middle_initial: z.string().trim().max(10).nullable().optional(),
    last_name: z.string().trim().min(1).optional(),
    suffix: z.string().trim().max(20).nullable().optional(),
    email: z.email().optional(),
    address: z.string().trim().min(1).optional(),
    student_number: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])-\d{5}$/)
      .optional(),
    program_id: z.number().int().positive().optional(),
    entry_year: z.number().int().min(2000).max(2100).optional(),
    year_level: z.number().int().min(1).max(4).optional(),
    enrollment_category: enrollmentCategorySchema.optional(),
    financial_status: financialStatusSchema.nullable().optional(),
    admission_status: admissionStatusSchema.optional(),
    reason: z.string().trim().min(1),
    identity_verified_in_person: z.literal(true),
  })
  .strict()

export const profileChangeRequestStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "cancelled",
])
export const profileChangeRequestSchema = z
  .object({
    type: z.literal("student_profile_change_request"),
    id: z.number().int().positive(),
    student_id: z.number().int().positive(),
    student_number: z.string().min(1),
    student_name: z.string().min(1),
    status: profileChangeRequestStatusSchema,
    status_label: z.string().min(1),
    official: z.object({
      name: z.string().min(1),
      first_name: z.string().min(1),
      middle_initial: z.string().nullable(),
      last_name: z.string().min(1),
      suffix: z.string().nullable(),
      email: z.email(),
      address: z.string().nullable(),
    }),
    requested: z.object({
      name: z.string().min(1),
      first_name: z.string().min(1),
      middle_initial: z.string().nullable(),
      last_name: z.string().min(1),
      suffix: z.string().nullable(),
      email: z.email(),
      address: z.string().min(1),
    }),
    reason: z.string().min(1),
    decision_notes: z.string().nullable(),
    identity_verified_at: z.iso.datetime().nullable(),
    requested_at: z.iso.datetime().nullable(),
    decided_at: z.iso.datetime().nullable(),
  })
  .strict()
export const profileChangeRequestEnvelopeSchema = z
  .object({ data: profileChangeRequestSchema })
  .strict()
export const profileChangeRequestFiltersSchema = z
  .object({
    status: profileChangeRequestStatusSchema.optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()
export const paginatedProfileChangeRequestsSchema = z
  .object({
    data: z.array(profileChangeRequestSchema),
    links: paginationLinksSchema,
    meta: paginationMetaSchema,
  })
  .strict()

export const storeProfileChangeRequestSchema = z
  .object({
    ...personNameFieldsSchema,
    email: z.email(),
    address: z.string().trim().min(1),
    reason: z.string().trim().min(1),
  })
  .strict()
export const decideProfileChangeRequestSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    identity_verified_in_person: z.literal(true),
    notes: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((input) => input.action !== "reject" || input.notes !== undefined, {
    path: ["notes"],
    message: "Enter decision notes when rejecting a request.",
  })

export const accountSetupSchema = z
  .object({
    email: z.email(),
    code: z.string().trim().min(1),
    password: z.string().min(8),
    password_confirmation: z.string().min(8),
  })
  .strict()
  .refine((input) => input.password === input.password_confirmation, {
    path: ["password_confirmation"],
    message: "Passwords must match.",
  })
export const accountSetupEnvelopeSchema = z
  .object({
    data: z.object({
      type: z.literal("account-setup"),
      status: z.literal("active"),
    }),
  })
  .strict()

export type ProvisionStudentInput = z.infer<typeof provisionStudentSchema>
export type StudentProfile = z.infer<typeof studentProfileSchema>
export type StudentProfileFilters = z.input<typeof studentProfileFiltersSchema>
export type UpdateStudentProfileInput = z.infer<
  typeof updateStudentProfileSchema
>
export type ProfileChangeRequest = z.infer<typeof profileChangeRequestSchema>
export type ProfileChangeRequestFilters = z.input<
  typeof profileChangeRequestFiltersSchema
>
export type StoreProfileChangeRequestInput = z.infer<
  typeof storeProfileChangeRequestSchema
>
export type DecideProfileChangeRequestInput = z.infer<
  typeof decideProfileChangeRequestSchema
>
export type AccountSetupInput = z.infer<typeof accountSetupSchema>
export interface Paginated<T> {
  data: readonly T[]
  links: z.infer<typeof paginationLinksSchema>
  meta: z.infer<typeof paginationMetaSchema>
}
