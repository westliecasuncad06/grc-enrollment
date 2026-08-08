import { z } from "zod"

export const scheduleGenerationRunSchema = z
  .object({
    type: z.literal("schedule_generation_run"),
    id: z.number().int().positive(),
    academic_term_id: z.number().int().positive(),
    prediction_run_id: z.number().int().positive().nullable(),
    college: z.string().min(1),
    status: z.enum(["queued", "running", "succeeded", "partial", "failed"]),
    warnings: z.array(z.string()),
    error_summary: z.string().nullable(),
    started_at: z.string().nullable(),
    completed_at: z.string().nullable(),
    created_at: z.string().nullable(),
  })
  .strict()

export const scheduleGenerationRunEnvelopeSchema = z
  .object({ data: scheduleGenerationRunSchema })
  .strict()

export type ScheduleGenerationRun = z.infer<typeof scheduleGenerationRunSchema>
