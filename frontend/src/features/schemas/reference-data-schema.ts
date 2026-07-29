import { z } from "zod"

const optionalUtcDateTimeSchema = z.iso.datetime().nullable()

export const programSchema = z
  .object({
    type: z.literal("program"),
    id: z.number().int().positive(),
    code: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(["active", "inactive"]),
    status_label: z.string().min(1),
  })
  .strict()

export const programsEnvelopeSchema = z
  .object({ data: z.array(programSchema) })
  .strict()

export const academicTermSchema = z
  .object({
    type: z.literal("academic-term"),
    id: z.number().int().positive(),
    school_year: z.string().min(1),
    semester: z.string().min(1),
    starts_at: optionalUtcDateTimeSchema,
    ends_at: optionalUtcDateTimeSchema,
    enrollment_opens_at: optionalUtcDateTimeSchema,
    enrollment_closes_at: optionalUtcDateTimeSchema,
    status: z.enum(["planning", "active", "closed"]),
    status_label: z.string().min(1),
  })
  .strict()

export const academicTermsEnvelopeSchema = z
  .object({ data: z.array(academicTermSchema) })
  .strict()

export const subjectSchema = z
  .object({
    type: z.literal("subject"),
    id: z.number().int().positive(),
    code: z.string().min(1),
    title: z.string().min(1),
    units: z.number().int().positive(),
    status: z.enum(["active", "inactive"]),
    status_label: z.string().min(1),
  })
  .strict()

export const subjectsEnvelopeSchema = z
  .object({ data: z.array(subjectSchema) })
  .strict()

const curriculumSubjectSchema = z
  .object({
    subject_id: z.number().int().positive(),
    code: z.string().min(1),
    title: z.string().min(1),
    year_level: z.number().int().positive(),
    semester: z.string().min(1),
    is_required: z.boolean(),
    prerequisites: z.array(
      z
        .object({
          prerequisite_subject_id: z.number().int().positive(),
          code: z.string().min(1),
          minimum_grade: z.string().min(1),
        })
        .strict(),
    ),
  })
  .strict()

export const curriculumSchema = z
  .object({
    type: z.literal("curriculum"),
    id: z.number().int().positive(),
    program_id: z.number().int().positive(),
    name: z.string().min(1),
    effective_school_year: z.string().min(1),
    status: z.enum(["draft", "active", "retired"]),
    status_label: z.string().min(1),
    subjects: z.array(curriculumSubjectSchema),
  })
  .strict()

export const curriculaEnvelopeSchema = z
  .object({ data: z.array(curriculumSchema) })
  .strict()

export type AcademicTerm = z.infer<typeof academicTermSchema>
export type Program = z.infer<typeof programSchema>
export type Subject = z.infer<typeof subjectSchema>
export type Curriculum = z.infer<typeof curriculumSchema>
