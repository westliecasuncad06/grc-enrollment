import { z } from "zod"

const collegeSchema = z.enum(["ccs", "coe", "coa", "cbae"])
const accountStatusSchema = z.enum(["active", "disabled"])
const automationStepSchema = z.enum([
  "chair_generate_sections",
  "dean_approve_all",
  "executive_publish_all",
  "students_auto_enroll",
  "registrar_approve_all",
  "cashier_confirm_all",
])
const automationRunStatusSchema = z.enum([
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
])

const paginationLinksSchema = z
  .object({
    first: z.string().url(),
    last: z.string().url(),
    prev: z.string().url().nullable(),
    next: z.string().url().nullable(),
  })
  .strict()

const paginationLinkSchema = z
  .object({
    url: z.string().url().nullable(),
    label: z.string().min(1),
    active: z.boolean(),
  })
  .strict()

const paginationMetaSchema = z
  .object({
    current_page: z.number().int().positive(),
    from: z.number().int().positive().nullable(),
    last_page: z.number().int().positive(),
    links: z.array(paginationLinkSchema),
    path: z.string().url(),
    per_page: z.number().int().min(1).max(100),
    to: z.number().int().positive().nullable(),
    total: z.number().int().nonnegative(),
  })
  .strict()

export const itControlStudentAccountSchema = z
  .object({
    type: z.literal("it-control-student-account"),
    id: z.number().int().positive(),
    user_id: z.number().int().positive(),
    student_number: z.string().min(1),
    name: z.string().min(1),
    email: z.email(),
    program_code: z.string().min(1),
    college: collegeSchema.nullable(),
    year_level: z.number().int().positive(),
    enrollment_category: z.enum(["regular", "irregular"]).nullable(),
    academic_standing: z.enum(["good", "probation", "warning"]),
    status: accountStatusSchema,
    current_term_enrollment_status: z
      .enum([
        "draft",
        "pending_registrar_approval",
        "pending_payment",
        "enrolled",
        "rejected",
        "cancelled",
        "withdrawn",
      ])
      .nullable(),
    password_hint: z.literal("password"),
  })
  .strict()

export const itControlFacultyAccountSchema = z
  .object({
    type: z.literal("it-control-faculty-account"),
    id: z.number().int().positive(),
    name: z.string().min(1),
    email: z.email(),
    college: collegeSchema.nullable(),
    employment_type: z.enum(["full_time", "part_time"]).nullable(),
    status: accountStatusSchema,
    availability_window_count: z.number().int().nonnegative(),
    subject_preference_count: z.number().int().nonnegative(),
    specialization_count: z.number().int().nonnegative(),
    password_hint: z.literal("password"),
  })
  .strict()

export const itControlAutomationRunSchema = z
  .object({
    type: z.literal("it-control-automation-run"),
    id: z.number().int().positive(),
    step: automationStepSchema,
    academic_term_id: z.number().int().positive(),
    status: automationRunStatusSchema,
    processed_count: z.number().int().nonnegative(),
    failed_count: z.number().int().nonnegative(),
    warnings: z.array(z.string().min(1)),
    error_summary: z.string().min(1).nullable(),
    started_at: z.string().datetime({ offset: true }).nullable(),
    completed_at: z.string().datetime({ offset: true }).nullable(),
    created_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strict()

export const itControlAutomationRunResponseSchema = z
  .object({ data: itControlAutomationRunSchema })
  .strict()

function paginatedSchema<Item extends z.ZodType>(itemSchema: Item) {
  return z
    .object({
      data: z.array(itemSchema),
      links: paginationLinksSchema,
      meta: paginationMetaSchema,
    })
    .strict()
}

export const paginatedItControlStudentAccountsSchema = paginatedSchema(
  itControlStudentAccountSchema,
)
export const paginatedItControlFacultyAccountsSchema = paginatedSchema(
  itControlFacultyAccountSchema,
)
export const paginatedItControlAutomationRunsSchema = paginatedSchema(
  itControlAutomationRunSchema,
)

export const startItControlAutomationRunSchema = z
  .object({ step: automationStepSchema })
  .strict()

export const studentAccountFiltersSchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    college: collegeSchema.optional(),
    program_id: z.number().int().positive().optional(),
    year_level: z.number().int().positive().optional(),
    enrollment_category: z.enum(["regular", "irregular"]).optional(),
    status: accountStatusSchema.optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()

export const facultyAccountFiltersSchema = z
  .object({
    q: z.string().trim().min(1).max(255).optional(),
    college: collegeSchema.optional(),
    employment_type: z.enum(["full_time", "part_time"]).optional(),
    status: accountStatusSchema.optional(),
    page: z.number().int().positive().default(1),
    per_page: z.number().int().min(1).max(100).default(20),
  })
  .strict()

export const studentAccountFilterFormSchema = z
  .object({
    q: z.string().max(255),
    college: collegeSchema.optional(),
    year_level: z.number().int().positive().optional(),
    enrollment_category: z.enum(["regular", "irregular"]).optional(),
    status: accountStatusSchema.optional(),
  })
  .strict()

export const facultyAccountFilterFormSchema = z
  .object({
    q: z.string().max(255),
    college: collegeSchema.optional(),
    employment_type: z.enum(["full_time", "part_time"]).optional(),
    status: accountStatusSchema.optional(),
  })
  .strict()

export type ItControlStudentAccount = z.infer<
  typeof itControlStudentAccountSchema
>
export type ItControlFacultyAccount = z.infer<
  typeof itControlFacultyAccountSchema
>
export type ItControlAutomationRun = z.infer<
  typeof itControlAutomationRunSchema
>
export type ItControlAutomationStep = z.infer<typeof automationStepSchema>
export type ItControlAutomationRunStatus = z.infer<
  typeof automationRunStatusSchema
>
export type PaginatedItControlStudentAccounts = z.infer<
  typeof paginatedItControlStudentAccountsSchema
>
export type PaginatedItControlFacultyAccounts = z.infer<
  typeof paginatedItControlFacultyAccountsSchema
>
export type StudentAccountFilters = z.input<typeof studentAccountFiltersSchema>
export type FacultyAccountFilters = z.input<typeof facultyAccountFiltersSchema>
export type StudentAccountFilterForm = z.infer<
  typeof studentAccountFilterFormSchema
>
export type FacultyAccountFilterForm = z.infer<
  typeof facultyAccountFilterFormSchema
>
