import {
  scheduleGenerationRunEnvelopeSchema,
  type ScheduleGenerationRun,
} from "@/features/schemas/schedule-generation-schema"
import { postAuthenticatedJson } from "@/features/services/api-client"

/** Starts a college-scoped, idempotent predictive schedule recommendation run. */
export async function startScheduleGeneration(
  termId: number,
): Promise<ScheduleGenerationRun> {
  const payload = await postAuthenticatedJson(
    `/api/v1/academic-terms/${termId}/schedule-generation-runs`,
    {},
  )

  return scheduleGenerationRunEnvelopeSchema.parse(payload).data
}
