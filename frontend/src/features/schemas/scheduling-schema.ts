import { z } from "zod"

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
  message: "Use a 24-hour time in HH:mm:ss format.",
})
const nullableText = z.string().trim().max(255).nullable()
const nullableTime = timeSchema.nullable()

const sectionShape = {
  academic_term_id: z.number().int().positive("Select an academic term."),
  subject_id: z.number().int().positive("Select a subject."),
  section_code: z.string().trim().min(1, "Enter a section code.").max(255),
  professor_id: z.number().int().positive().nullable(),
  schedule_days: nullableText,
  starts_at_time: nullableTime,
  ends_at_time: nullableTime,
  room: nullableText,
  modality: z.enum(["hyflex_a", "hyflex_b", "f2f"]).nullable(),
  capacity: z.number().int().min(1, "Capacity must be at least 1."),
  viability_threshold: z.number().int().min(1).nullable(),
  status: z.enum(["planned", "published", "closed", "cancelled"]),
  override_reason: z.string().trim().max(1000).nullable().optional(),
}

function validateSchedule(
  value: {
    schedule_days: string | null
    starts_at_time: string | null
    ends_at_time: string | null
  },
  context: z.RefinementCtx,
) {
  const hasDays = value.schedule_days !== null
  const hasStart = value.starts_at_time !== null
  const hasEnd = value.ends_at_time !== null
  if (
    hasDays &&
    !/^(?:(?:M|T|W|Th|F|Sat|Sun))+$/u.test(value.schedule_days ?? "")
  )
    context.addIssue({
      code: "custom",
      path: ["schedule_days"],
      message: "Use schedule days such as MWF, TTh, Sat, or Sun.",
    })
  if (hasStart !== hasEnd)
    context.addIssue({
      code: "custom",
      path: [hasStart ? "ends_at_time" : "starts_at_time"],
      message: "Enter both start and end times.",
    })
  if ((hasStart || hasEnd) && !hasDays)
    context.addIssue({
      code: "custom",
      path: ["schedule_days"],
      message: "Enter schedule days when a time is set.",
    })
  if (hasStart && hasEnd && value.ends_at_time! <= value.starts_at_time!)
    context.addIssue({
      code: "custom",
      path: ["ends_at_time"],
      message: "End time must be after start time.",
    })
}

export const sectionInputSchema = z
  .object(sectionShape)
  .strict()
  .superRefine(validateSchedule)
export const sectionEditorSchema = z
  .object({
    ...sectionShape,
    schedule_days: z.string().trim().max(255),
    starts_at_time: z.string(),
    ends_at_time: z.string(),
    room: z.string().trim().max(255),
    modality: z.enum(["hyflex_a", "hyflex_b", "f2f"]).nullable(),
    professor_id: z.number().int().positive().nullable(),
    viability_threshold: z.number().int().min(1).nullable(),
  })
  .strict()
  .transform((value) => ({
    ...value,
    schedule_days: value.schedule_days || null,
    starts_at_time: value.starts_at_time || null,
    ends_at_time: value.ends_at_time || null,
    room: value.room || null,
    modality: value.modality ?? null,
    ...(value.override_reason === undefined
      ? {}
      : { override_reason: value.override_reason?.trim() || null }),
  }))
  .pipe(sectionInputSchema)

export const scheduleProposalSchema = z
  .object({
    type: z.literal("schedule_proposal"),
    id: z.number().int().positive(),
    academic_term_id: z.number().int().positive(),
    submitted_by: z.number().int().positive(),
    submitted_by_name: z.string().min(1).optional(),
    college: z.enum(["ccs", "coe", "coa", "cbae"]).nullable().optional(),
    college_label: z.string().min(1).nullable().optional(),
    academic_term_label: z.string().min(1).optional(),
    section_plan_id: z.number().int().positive().nullable().optional(),
    is_submitted: z.boolean().optional(),
    is_returned: z.boolean().optional(),
    returned_by_role: z
      .enum(["dean", "executive_director"])
      .nullable()
      .optional(),
    status: z.enum([
      "draft",
      "dean_approved",
      "executive_approved",
      "published",
      "closed",
    ]),
    status_label: z.string().min(1),
    decided_by: z.number().int().positive().nullable(),
    decided_by_name: z.string().min(1).nullable().optional(),
    decided_at: z.iso.datetime().nullable(),
    decision_reason: z.string().nullable(),
    decision_history: z
      .array(
        z
          .object({
            action: z.enum([
              "dean_approve",
              "dean_return",
              "executive_approve",
              "executive_return",
            ]),
            action_label: z.string().min(1),
            actor_name: z.string().min(1),
            actor_role: z.enum(["dean", "executive_director"]),
            decided_at: z.iso.datetime(),
            notes: z.string().nullable(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict()
export const scheduleProposalsEnvelopeSchema = z
  .object({ data: z.array(scheduleProposalSchema) })
  .strict()
export const scheduleProposalEnvelopeSchema = z
  .object({ data: scheduleProposalSchema })
  .strict()
export const scheduleReviewSectionSchema = z
  .object({
    type: z.literal("schedule_review_section"),
    id: z.number().int().positive(),
    section_code: z.string().min(1),
    subject_code: z.string().min(1),
    subject_title: z.string().min(1),
    units: z.number().positive(),
    professor_id: z.number().int().positive().nullable(),
    professor_name: z.string().min(1).nullable(),
    schedule_days: z.string().min(1).nullable(),
    starts_at_time: nullableTime,
    ends_at_time: nullableTime,
    room: nullableText,
    modality: z.enum(["hyflex_a", "hyflex_b", "f2f"]).nullable(),
  })
  .strict()
export const scheduleReviewSectionsEnvelopeSchema = z
  .object({ data: z.array(scheduleReviewSectionSchema) })
  .strict()
export const scheduleProposalInputSchema = z
  .object({
    academic_term_id: z.number().int().positive("Select an academic term."),
  })
  .strict()

// "executive_approve" is deliberately absent — the Executive Director's
// forward path is a direct "publish" from `dean_approved`, not a separate
// approval step. `decision_history.action` below keeps accepting it for any
// pre-existing historical row; this schema governs the *request* side only.
export const scheduleActionSchema = z.enum([
  "dean_approve",
  "dean_return",
  "executive_return",
  "publish",
  "close",
])
export const scheduleProposalTransitionSchema = z
  .object({
    action: scheduleActionSchema,
    decision_reason: z.string().trim().min(1).max(255).optional(),
  })
  .strict()

export const facultyMemberSchema = z
  .object({
    type: z.literal("faculty_member"),
    id: z.number().int().positive(),
    name: z.string().min(1),
    status: z.literal("active"),
    status_label: z.string().min(1),
  })
  .strict()
export const facultyMembersEnvelopeSchema = z
  .object({ data: z.array(facultyMemberSchema) })
  .strict()

export type SectionInput = z.infer<typeof sectionInputSchema>
export type SectionEditorValues = z.input<typeof sectionEditorSchema>
export type ScheduleProposal = z.infer<typeof scheduleProposalSchema>
export type ScheduleReviewSection = z.infer<typeof scheduleReviewSectionSchema>
export type ScheduleProposalInput = z.infer<typeof scheduleProposalInputSchema>
export type ScheduleAction = z.infer<typeof scheduleActionSchema>
export type ScheduleProposalTransition = z.infer<
  typeof scheduleProposalTransitionSchema
>
export type FacultyMember = z.infer<typeof facultyMemberSchema>
