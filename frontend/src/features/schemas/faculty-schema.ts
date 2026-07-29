import { z } from "zod"

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
  message: "Use a 24-hour time in HH:mm:ss format.",
})

export const facultyAvailabilitySchema = z
  .object({
    type: z.literal("faculty_availability"),
    id: z.number().int().positive(),
    professor_id: z.number().int().positive(),
    academic_term_id: z.number().int().positive(),
    day_of_week: z.number().int().min(1).max(7),
    starts_at_time: timeSchema,
    ends_at_time: timeSchema,
  })
  .strict()

export const facultyAvailabilitiesEnvelopeSchema = z
  .object({ data: z.array(facultyAvailabilitySchema) })
  .strict()

export const facultyAvailabilityEnvelopeSchema = z
  .object({ data: facultyAvailabilitySchema })
  .strict()

const availabilityInputShape = {
  academic_term_id: z.number().int().positive("Select an academic term."),
  day_of_week: z.number().int().min(1).max(7),
  starts_at_time: timeSchema,
  ends_at_time: timeSchema,
}

export const facultyAvailabilityInputSchema = z
  .object(availabilityInputShape)
  .strict()
  .superRefine((value, context) => {
    if (value.ends_at_time <= value.starts_at_time) {
      context.addIssue({
        code: "custom",
        path: ["ends_at_time"],
        message: "End time must be after start time.",
      })
    }
  })

export const facultySubjectPreferenceSchema = z
  .object({
    type: z.literal("faculty_subject_preference"),
    id: z.number().int().positive(),
    professor_id: z.number().int().positive(),
    academic_term_id: z.number().int().positive(),
    subject_id: z.number().int().positive(),
    rank: z.number().int().positive(),
  })
  .strict()

export const facultySubjectPreferencesEnvelopeSchema = z
  .object({ data: z.array(facultySubjectPreferenceSchema) })
  .strict()

export const facultySubjectPreferenceEnvelopeSchema = z
  .object({ data: facultySubjectPreferenceSchema })
  .strict()

export const facultySubjectPreferenceInputSchema = z
  .object({
    academic_term_id: z.number().int().positive("Select an academic term."),
    subject_id: z.number().int().positive("Select a subject."),
    rank: z.number().int().positive("Rank must be at least 1."),
  })
  .strict()

export type FacultyAvailability = z.infer<typeof facultyAvailabilitySchema>
export type FacultyAvailabilityInput = z.infer<
  typeof facultyAvailabilityInputSchema
>
export type FacultySubjectPreference = z.infer<
  typeof facultySubjectPreferenceSchema
>
export type FacultySubjectPreferenceInput = z.infer<
  typeof facultySubjectPreferenceInputSchema
>
