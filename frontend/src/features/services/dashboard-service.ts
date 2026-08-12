import {
  enrollmentSummaryEnvelopeSchema,
  institutionSummaryEnvelopeSchema,
  policySettingsEnvelopeSchema,
  programChairAnalyticsSummaryEnvelopeSchema,
  stuckEnrollmentsEnvelopeSchema,
  type EnrollmentSummary,
  type InstitutionSummary,
  type PolicySettingsSummary,
  type ProgramChairAnalyticsSummary,
  type StuckEnrollmentsResponse,
} from "@/features/schemas/dashboard-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
} from "@/features/services/api-client"

export const ENROLLMENT_SUMMARY_PATH = "/api/v1/dashboards/enrollment-summary"
export const INSTITUTION_SUMMARY_PATH = "/api/v1/dashboards/institution-summary"
export const POLICY_SETTINGS_PATH = "/api/v1/dashboards/policy-settings"
export const STUCK_ENROLLMENTS_PATH = "/api/v1/stuck-enrollments"
export const PROGRAM_CHAIR_ANALYTICS_SUMMARY_PATH =
  "/api/v1/dashboards/program-chair-analytics-summary"

function parse<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) => { success: true; data: T } | { success: false; error: unknown }
  },
  payload: unknown,
  label: string,
): T {
  const result = schema.safeParse(payload)
  if (result.success) return result.data
  throw new ApiClientError({
    kind: "contract",
    message: `The API responded, but its ${label} did not match the published v1 contract.`,
    cause: result.error,
  })
}

function withTerm(path: string, academicTermId?: number): string {
  return academicTermId ? `${path}?academic_term_id=${academicTermId}` : path
}

export async function getEnrollmentSummary(
  academicTermId?: number,
  signal?: AbortSignal,
): Promise<EnrollmentSummary> {
  const envelope = parse(
    enrollmentSummaryEnvelopeSchema,
    await getAuthenticatedJson(
      withTerm(ENROLLMENT_SUMMARY_PATH, academicTermId),
      signal,
    ),
    "enrollment summary",
  )
  return envelope.data
}

export async function getInstitutionSummary(
  signal?: AbortSignal,
): Promise<InstitutionSummary> {
  const envelope = parse(
    institutionSummaryEnvelopeSchema,
    await getAuthenticatedJson(INSTITUTION_SUMMARY_PATH, signal),
    "institution summary",
  )
  return envelope.data
}

export async function getPolicySettings(
  signal?: AbortSignal,
): Promise<PolicySettingsSummary> {
  const envelope = parse(
    policySettingsEnvelopeSchema,
    await getAuthenticatedJson(POLICY_SETTINGS_PATH, signal),
    "policy settings",
  )
  return envelope.data
}

export async function getStuckEnrollments(
  academicTermId?: number,
  signal?: AbortSignal,
): Promise<StuckEnrollmentsResponse> {
  return parse(
    stuckEnrollmentsEnvelopeSchema,
    await getAuthenticatedJson(
      withTerm(STUCK_ENROLLMENTS_PATH, academicTermId),
      signal,
    ),
    "stuck enrollments list",
  )
}

export async function getProgramChairAnalyticsSummary(
  academicTermId?: number,
  signal?: AbortSignal,
): Promise<ProgramChairAnalyticsSummary> {
  const envelope = parse(
    programChairAnalyticsSummaryEnvelopeSchema,
    await getAuthenticatedJson(
      withTerm(PROGRAM_CHAIR_ANALYTICS_SUMMARY_PATH, academicTermId),
      signal,
    ),
    "program chair analytics summary",
  )
  return envelope.data
}
