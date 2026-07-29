import { z } from "zod"

export const provisionStudentSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the student's name."),
    email: z.email("Enter a valid email address."),
    password: z.string().min(8),
    student_number: z.string().trim().min(1, "Enter the student number."),
    program_id: z.number().int().positive("Select a program."),
    curriculum_id: z.number().int().positive("Select a curriculum."),
    year_level: z.number().int().positive("Select a year level."),
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
    admission_status: z.literal("admitted"),
    admission_status_label: z.string().min(1),
    academic_standing: z.literal("good"),
    academic_standing_label: z.string().min(1),
  })
  .strict()

export const studentProfileEnvelopeSchema = z
  .object({ data: studentProfileSchema })
  .strict()

export type ProvisionStudentInput = z.infer<typeof provisionStudentSchema>
export type StudentProfile = z.infer<typeof studentProfileSchema>
