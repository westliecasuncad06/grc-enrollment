import { z } from "zod"

export const graduateSchema = z
  .object({
    id: z.number().int().positive(),
    student_number: z.string().min(1),
    full_name: z.string().min(1),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    email: z.string().email(),
    program_id: z.number().int().positive(),
    program_code: z.string().min(1),
    program_name: z.string().min(1),
    college: z.string().nullable().optional(),
    curriculum_id: z.number().int().positive().nullable().optional(),
    curriculum_name: z.string().nullable().optional(),
    curriculum_version: z.string().nullable().optional(),
    entry_year: z.number().int().nullable().optional(),
    graduation_school_year: z.string().nullable().optional(),
    final_gpa: z.number().nullable().optional(),
  })
  .strict()

export type Graduate = z.infer<typeof graduateSchema>

export const graduateListResponseSchema = z
  .object({
    data: z.array(graduateSchema),
    summary: z
      .object({
        total_graduates: z.number().int().nonnegative(),
      })
      .strict(),
    meta: z
      .object({
        current_page: z.number().int().positive(),
        last_page: z.number().int().positive(),
        per_page: z.number().int().positive(),
        total: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

export type GraduateListResponse = z.infer<typeof graduateListResponseSchema>

