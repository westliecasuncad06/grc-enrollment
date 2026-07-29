import { z } from "zod"
import {
  sectionSchema,
  type Section,
} from "@/features/schemas/reference-data-schema"
import {
  scheduleProposalEnvelopeSchema,
  scheduleProposalInputSchema,
  scheduleProposalsEnvelopeSchema,
  sectionInputSchema,
  type ScheduleProposal,
  type ScheduleProposalInput,
  type SectionEditorValues,
  type SectionInput,
} from "@/features/schemas/scheduling-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  patchAuthenticatedJson,
  postAuthenticatedJson,
} from "@/features/services/api-client"

export const SCHEDULE_PROPOSALS_PATH = "/api/v1/schedule-proposals"
export const SECTIONS_PATH = "/api/v1/sections"

function parse<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false; error: unknown }
  },
  value: unknown,
  label: string,
): T {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  throw new ApiClientError({
    kind: "contract",
    message: `The API responded, but its ${label} did not match the published v1 contract.`,
    cause: result.error,
  })
}

export function toSectionReplacement(
  section: Section,
  changes: Partial<SectionEditorValues>,
): SectionInput {
  return parse(
    sectionInputSchema,
    {
      academic_term_id: section.academic_term_id,
      subject_id: section.subject_id,
      section_code: section.section_code,
      professor_id: section.professor_id,
      schedule_days: section.schedule_days,
      starts_at_time: section.starts_at_time,
      ends_at_time: section.ends_at_time,
      room: section.room,
      capacity: section.capacity,
      viability_threshold: section.viability_threshold,
      status: section.status,
      ...changes,
    },
    "section replacement",
  )
}

export async function createSection(input: SectionInput): Promise<Section> {
  const payload = await postAuthenticatedJson(
    SECTIONS_PATH,
    parse(sectionInputSchema, input, "section request"),
  )
  const envelope = parse(zSectionEnvelope, payload, "created section")
  return envelope.data
}

export async function replaceSection(
  id: number,
  input: SectionInput,
): Promise<Section> {
  const payload = await patchAuthenticatedJson(
    `${SECTIONS_PATH}/${id}`,
    parse(sectionInputSchema, input, "section replacement request"),
  )
  return parse(zSectionEnvelope, payload, "updated section").data
}

export async function getScheduleProposals(
  signal?: AbortSignal,
): Promise<readonly ScheduleProposal[]> {
  return parse(
    scheduleProposalsEnvelopeSchema,
    await getAuthenticatedJson(SCHEDULE_PROPOSALS_PATH, signal),
    "schedule proposal list",
  ).data
}

export async function createScheduleProposal(
  input: ScheduleProposalInput,
): Promise<ScheduleProposal> {
  return parse(
    scheduleProposalEnvelopeSchema,
    await postAuthenticatedJson(
      SCHEDULE_PROPOSALS_PATH,
      parse(scheduleProposalInputSchema, input, "schedule proposal request"),
    ),
    "created schedule proposal",
  ).data
}

// Section resources predate this feature and remain in the shared reference schema.
const zSectionEnvelope = z.object({ data: sectionSchema }).strict()
