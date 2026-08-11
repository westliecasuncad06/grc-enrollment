import {
  facultyAccountFiltersSchema,
  itControlAutomationRunResponseSchema,
  paginatedItControlFacultyAccountsSchema,
  paginatedItControlAutomationRunsSchema,
  paginatedItControlStudentAccountsSchema,
  studentAccountFiltersSchema,
  startItControlAutomationRunSchema,
  type ItControlAutomationRun,
  type ItControlAutomationStep,
  type FacultyAccountFilters,
  type PaginatedItControlFacultyAccounts,
  type PaginatedItControlStudentAccounts,
  type StudentAccountFilters,
} from "@/features/schemas/it-control-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  postAuthenticatedJson,
} from "@/features/services/api-client"

export const IT_CONTROL_STUDENTS_PATH = "/api/v1/it-control/students"
export const IT_CONTROL_FACULTY_PATH = "/api/v1/it-control/faculty"
export const IT_CONTROL_AUTOMATION_RUNS_PATH =
  "/api/v1/it-control/automation-runs"

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

function queryString(filters: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) query.set(key, String(value))
  }

  return query.toString()
}

export async function getItControlStudentAccounts(
  filters: StudentAccountFilters,
  signal?: AbortSignal,
): Promise<PaginatedItControlStudentAccounts> {
  const parsed = parse(studentAccountFiltersSchema, filters, "student filters")
  const query = queryString(parsed)

  return parse(
    paginatedItControlStudentAccountsSchema,
    await getAuthenticatedJson(`${IT_CONTROL_STUDENTS_PATH}?${query}`, signal),
    "student account list",
  )
}

export async function getItControlFacultyAccounts(
  filters: FacultyAccountFilters,
  signal?: AbortSignal,
): Promise<PaginatedItControlFacultyAccounts> {
  const parsed = parse(facultyAccountFiltersSchema, filters, "faculty filters")
  const query = queryString(parsed)

  return parse(
    paginatedItControlFacultyAccountsSchema,
    await getAuthenticatedJson(`${IT_CONTROL_FACULTY_PATH}?${query}`, signal),
    "faculty account list",
  )
}

export async function getItControlAutomationRuns(
  signal?: AbortSignal,
): Promise<ItControlAutomationRun[]> {
  return parse(
    paginatedItControlAutomationRunsSchema,
    await getAuthenticatedJson(IT_CONTROL_AUTOMATION_RUNS_PATH, signal),
    "automation run list",
  ).data
}

export async function getItControlAutomationRun(
  id: number,
  signal?: AbortSignal,
): Promise<ItControlAutomationRun> {
  return parse(
    itControlAutomationRunResponseSchema,
    await getAuthenticatedJson(
      `${IT_CONTROL_AUTOMATION_RUNS_PATH}/${id}`,
      signal,
    ),
    "automation run",
  ).data
}

export async function createItControlAutomationRun(
  step: ItControlAutomationStep,
  signal?: AbortSignal,
): Promise<ItControlAutomationRun> {
  const request = parse(
    startItControlAutomationRunSchema,
    { step },
    "automation run request",
  )

  return parse(
    itControlAutomationRunResponseSchema,
    await postAuthenticatedJson(
      IT_CONTROL_AUTOMATION_RUNS_PATH,
      request,
      signal,
    ),
    "automation run",
  ).data
}
