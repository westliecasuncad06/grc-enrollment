import { z } from "zod"

const optionalUtcDateTimeSchema = z.iso.datetime().nullable()

export const enrollmentAvailabilityReasonSchema = z.enum([
  "term_not_open",
  "term_closed",
  "before_window",
  "after_window",
  "open",
])

/**
 * Mirrors `App\Domain\Enrollment\EnrollmentAudience`: one window per year
 * level plus a fifth "irregular" audience. Irregular deliberately has no
 * year level of its own — it replaces the year-level window entirely for a
 * student whose `enrollment_category` is irregular — which is why the API
 * is keyed on `audience` rather than on a nullable `year_level`.
 */
export const enrollmentAudienceSchema = z.enum([
  "year_1",
  "year_2",
  "year_3",
  "year_4",
  "irregular",
])

/**
 * `label` is server-supplied ("1st Year" … "Irregular Students") so the
 * client never re-derives an ordinal from a year number and never renders
 * "Year 1".
 */
const audienceAvailabilitySchema = z
  .object({
    audience: enrollmentAudienceSchema,
    label: z.string().min(1),
    opens_at: optionalUtcDateTimeSchema,
    closes_at: optionalUtcDateTimeSchema,
    is_open: z.boolean(),
    reason: enrollmentAvailabilityReasonSchema,
  })
  .strict()

export const enrollmentScheduleSchema = z
  .object({
    type: z.literal("enrollment_schedule"),
    academic_term_id: z.number().int().positive(),
    status: z.enum([
      "draft",
      "for_dean_approval",
      "semester_ongoing",
      "semester_closed",
      "archived",
    ]),
    enrollment_opens_at: optionalUtcDateTimeSchema,
    enrollment_closes_at: optionalUtcDateTimeSchema,
    audiences: z.array(audienceAvailabilitySchema),
    viewer: audienceAvailabilitySchema.nullable(),
  })
  .strict()

export const enrollmentScheduleEnvelopeSchema = z
  .object({ data: enrollmentScheduleSchema })
  .strict()

// The Registrar picks dates only — the actual open/close instants are
// composed with fixed times (08:00 / 23:59) by
// `enrollment-window-time.ts`'s `openingInstant`/`closingInstant` before
// this reaches the API, which still receives full ISO 8601 datetimes.
const localDateSchema = z.string().trim().min(1, "Enter a date.")

/**
 * `windows` must carry every audience — `UpdateEnrollmentScheduleRequest`
 * validates `size:count(EnrollmentAudience::cases())`, so a short array is
 * a 422 rather than a partial update.
 */
export const saveEnrollmentScheduleInputSchema = z
  .object({
    enrollment_opens_at: localDateSchema,
    enrollment_closes_at: localDateSchema,
    windows: z
      .array(
        z
          .object({
            audience: enrollmentAudienceSchema,
            opens_at: z.string().trim(),
            closes_at: z.string().trim(),
          })
          .strict(),
      )
      .length(enrollmentAudienceSchema.options.length),
  })
  .strict()

export type EnrollmentAvailabilityReason = z.infer<
  typeof enrollmentAvailabilityReasonSchema
>
export type EnrollmentAudience = z.infer<typeof enrollmentAudienceSchema>
export type AudienceAvailability = z.infer<typeof audienceAvailabilitySchema>
export type EnrollmentSchedule = z.infer<typeof enrollmentScheduleSchema>
export type SaveEnrollmentScheduleInput = z.infer<
  typeof saveEnrollmentScheduleInputSchema
>
