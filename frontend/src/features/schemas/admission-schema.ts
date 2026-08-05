import { z } from "zod"

/**
 * A regular student enrols with their year level's block; an irregular one
 * picks subjects individually during the irregular enrollment window.
 */
export const enrollmentCategorySchema = z.enum(["regular", "irregular"])

/**
 * Informational only — never read by fee computation. See
 * `App\Domain\Identity\FinancialStatus`'s docblock.
 */
export const financialStatusSchema = z.enum(["scholar", "payee"])

export const provisionStudentSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the student's name."),
    email: z.email("Enter a valid email address."),
    password: z.string().min(8),
    student_number: z
      .string()
      .trim()
      .regex(
        /^\d{4}-(0[1-9]|1[0-2])-\d{5}$/,
        "Student number must be in YYYY-MM-NNNNN format (e.g. 2026-08-07107).",
      ),
    program_id: z.number().int().positive("Select a program."),
    curriculum_id: z.number().int().positive("Select a curriculum."),
    // 1–4: every year level must map to an enrollment audience window.
    year_level: z
      .number()
      .int()
      .min(1, "Select a year level.")
      .max(4, "Select a year level."),
    enrollment_category: enrollmentCategorySchema,
    financial_status: financialStatusSchema.nullable().optional(),
  })
  .strict()

export const studentProfileSchema = z
  .object({
    type: z.literal("student_profile"),
    id: z.number().int().positive(),
    user_id: z.number().int().positive(),
    student_number: z.string().min(1),
    program_id: z.number().int().positive(),
    curriculum_id: z.number().int().positive(),
    year_level: z.number().int().positive(),
    enrollment_category: enrollmentCategorySchema.nullable(),
    admission_status: z.literal("admitted"),
    admission_status_label: z.string().min(1),
    academic_standing: z.literal("good"),
    academic_standing_label: z.string().min(1),
    financial_status: financialStatusSchema.nullable(),
    financial_status_label: z.string().min(1).nullable(),
  })
  .strict()

export const studentProfileEnvelopeSchema = z
  .object({ data: studentProfileSchema })
  .strict()

export type ProvisionStudentInput = z.infer<typeof provisionStudentSchema>
export type StudentProfile = z.infer<typeof studentProfileSchema>
