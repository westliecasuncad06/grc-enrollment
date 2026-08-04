import { z } from "zod"

import { gradeMarkValues } from "@/features/schemas/academic-grade-schema"

const gradeStatusValues = ["draft", "submitted", "locked"] as const
const semesterSlotValues = ["1st", "2nd"] as const

export const prospectusEntrySchema = z
  .object({
    subject_id: z.number().int().positive(),
    code: z.string().min(1),
    title: z.string().min(1),
    units: z.number().nonnegative(),
    is_required: z.boolean(),
    offered_either_semester: z.boolean(),
    is_completion_only: z.boolean(),
    mark: z.enum(gradeMarkValues).nullable(),
    mark_label: z.string().nullable(),
    final_grade: z.string().nullable(),
    status: z.enum(gradeStatusValues).nullable(),
    status_label: z.string().nullable(),
    academic_term_id: z.number().int().positive().nullable(),
    term_label: z.string().nullable(),
    attempt_count: z.number().int().nonnegative(),
  })
  .strict()

export const prospectusSemesterSchema = z
  .object({
    year_level: z.number().int().min(1).max(4),
    semester: z.enum(semesterSlotValues),
    semester_label: z.string().min(1),
    entries: z.array(prospectusEntrySchema),
  })
  .strict()

export const prospectusUnplacedEntrySchema = z
  .object({
    subject_id: z.number().int().positive(),
    code: z.string().min(1),
    title: z.string().min(1),
    units: z.number().nonnegative(),
    mark: z.enum(gradeMarkValues).nullable(),
    mark_label: z.string().nullable(),
    final_grade: z.string().nullable(),
    status: z.enum(gradeStatusValues),
    status_label: z.string().min(1),
    academic_term_id: z.number().int().positive(),
    term_label: z.string().min(1),
  })
  .strict()

export const prospectusSchema = z
  .object({
    type: z.literal("prospectus"),
    student_id: z.number().int().positive(),
    student_number: z.string().min(1),
    program_code: z.string().min(1),
    program_name: z.string().min(1),
    curriculum_id: z.number().int().positive(),
    curriculum_name: z.string().min(1),
    effective_school_year: z.string().min(1),
    year_level: z.number().int().min(1).max(4),
    enrollment_category: z.string().nullable(),
    enrollment_category_label: z.string().nullable(),
    enrollment_category_derived_at: z.iso.datetime().nullable(),
    semesters: z.array(prospectusSemesterSchema),
    unplaced_entries: z.array(prospectusUnplacedEntrySchema),
  })
  .strict()

export const prospectusEnvelopeSchema = z
  .object({ data: prospectusSchema })
  .strict()

export const gradeSlipRowSchema = z
  .object({
    academic_grade_id: z.number().int().positive(),
    code: z.string().min(1),
    title: z.string().min(1),
    units: z.number().nonnegative(),
    mark: z.enum(gradeMarkValues).nullable(),
    mark_label: z.string().nullable(),
    final_grade: z.string().nullable(),
    section_code: z.string().nullable(),
    professor_name: z.string().nullable(),
    status: z.enum(gradeStatusValues),
    status_label: z.string().min(1),
    counts_toward_gpa: z.boolean(),
  })
  .strict()

export const gradeSlipSchema = z
  .object({
    type: z.literal("grade_slip"),
    student_id: z.number().int().positive(),
    student_number: z.string().min(1),
    program_code: z.string().min(1),
    program_name: z.string().min(1),
    year_level: z.number().int().min(1).max(4),
    enrollment_category: z.string().nullable(),
    enrollment_category_label: z.string().nullable(),
    academic_term_id: z.number().int().positive(),
    school_year: z.string().min(1),
    semester: z.string().min(1),
    term_label: z.string().min(1),
    rows: z.array(gradeSlipRowSchema),
    total_academic_units: z.number().nonnegative(),
    gpa_units: z.number().nonnegative(),
    // A string (or null), never a number -- mirrors final_grade's
    // precedent of never coercing a grade value to a float on the wire.
    gpa: z.string().nullable(),
    excluded_from_gpa_count: z.number().int().nonnegative(),
    generated_at: z.iso.datetime(),
  })
  .strict()

export const gradeSlipEnvelopeSchema = z
  .object({ data: gradeSlipSchema })
  .strict()

export type ProspectusEntry = z.infer<typeof prospectusEntrySchema>
export type ProspectusSemester = z.infer<typeof prospectusSemesterSchema>
export type ProspectusUnplacedEntry = z.infer<
  typeof prospectusUnplacedEntrySchema
>
export type Prospectus = z.infer<typeof prospectusSchema>
export type GradeSlipRow = z.infer<typeof gradeSlipRowSchema>
export type GradeSlip = z.infer<typeof gradeSlipSchema>
