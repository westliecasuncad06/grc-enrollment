import { z } from "zod"

/** Matches `App\Domain\Enrollment\PreferredTimeBlock` on the backend. */
const preferredTimeBlockValues = [
  "morning",
  "afternoon",
  "evening",
  "any",
] as const

/**
 * Matches `App\Domain\Scheduling\SectionModality` on the backend — `online`
 * was retired and must never appear here again.
 */
const sectionModalityValues = ["hyflex_a", "hyflex_b", "f2f"] as const

export const studentSchedulePreferenceSchema = z
  .object({
    type: z.literal("student-schedule-preference"),
    // Null when the student has never saved a preference yet — `show`
    // returns an unsaved default row in that case (id is never assigned).
    id: z.number().int().positive().nullable(),
    student_id: z.number().int().positive(),
    preferred_days: z.array(z.number().int().min(1).max(6)).nullable(),
    preferred_time_block: z.enum(preferredTimeBlockValues),
    preferred_time_block_label: z.string().min(1),
    preferred_modality: z.enum(sectionModalityValues).nullable(),
    max_days_on_campus: z.number().int().min(1).max(6).nullable(),
    avoid_early_first_class: z.boolean(),
    notes: z.string().nullable(),
  })
  .strict()

export const studentSchedulePreferenceEnvelopeSchema = z
  .object({ data: studentSchedulePreferenceSchema })
  .strict()

/**
 * The PUT endpoint is a full-replace upsert (Task 1 review), so every field
 * here is always sent — there is no partial-update shape.
 */
export const studentSchedulePreferenceInputSchema = z
  .object({
    preferred_days: z.array(z.number().int().min(1).max(6)),
    preferred_time_block: z.enum(preferredTimeBlockValues),
    preferred_modality: z.enum(sectionModalityValues).nullable(),
    max_days_on_campus: z.number().int().min(1).max(6).nullable(),
    avoid_early_first_class: z.boolean(),
    notes: z.string().max(255).nullable(),
  })
  .strict()

export type StudentSchedulePreference = z.infer<
  typeof studentSchedulePreferenceSchema
>
export type StudentSchedulePreferenceInput = z.infer<
  typeof studentSchedulePreferenceInputSchema
>
