import {
  createTransfereeCreditInputSchema,
  creditSubjectSuggestionsEnvelopeSchema,
  decideTransfereeCreditInputSchema,
  paginatedTransfereeCreditsSchema,
  transfereeCreditActionInputSchema,
  transfereeCreditEnvelopeSchema,
  transfereeCreditFiltersSchema,
  updateTransfereeCreditInputSchema,
  type CreateTransfereeCreditInput,
  type CreditSubjectSuggestion,
  type DecideTransfereeCreditInput,
  type Paginated,
  type TransfereeCredit,
  type TransfereeCreditActionInput,
  type TransfereeCreditFilters,
  type UpdateTransfereeCreditInput,
} from "@/features/schemas/transferee-credit-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
  patchAuthenticatedJson,
  postAuthenticatedJson,
} from "@/features/services/api-client"

export const TRANSFEREE_CREDITS_PATH = "/api/v1/transferee-credits"

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

export async function listTransfereeCredits(
  filters: TransfereeCreditFilters,
  signal?: AbortSignal,
): Promise<Paginated<TransfereeCredit>> {
  const parsed = parse(
    transfereeCreditFiltersSchema,
    filters,
    "transferee credit filter",
  )
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined) query.set(key, String(value))
  }
  return parse(
    paginatedTransfereeCreditsSchema,
    await getAuthenticatedJson(
      `${TRANSFEREE_CREDITS_PATH}?${query.toString()}`,
      signal,
    ),
    "transferee credit list",
  )
}

export async function createTransfereeCredit(
  input: CreateTransfereeCreditInput,
): Promise<TransfereeCredit> {
  const payload = await postAuthenticatedJson(
    TRANSFEREE_CREDITS_PATH,
    parse(createTransfereeCreditInputSchema, input, "transferee credit"),
  )
  return parse(
    transfereeCreditEnvelopeSchema,
    payload,
    "created transferee credit",
  ).data
}

/** The Program Chair's corrections and mapping of a pending credit. */
export async function updateTransfereeCredit(
  id: number,
  input: UpdateTransfereeCreditInput,
): Promise<TransfereeCredit> {
  const payload = await patchAuthenticatedJson(
    `${TRANSFEREE_CREDITS_PATH}/${id}`,
    parse(updateTransfereeCreditInputSchema, input, "transferee credit edit"),
  )
  return parse(
    transfereeCreditEnvelopeSchema,
    payload,
    "updated transferee credit",
  ).data
}

/** Endorse / decline (Program Chair) or approve / reject (Registrar Staff). */
export async function actOnTransfereeCredit(
  id: number,
  input: TransfereeCreditActionInput,
): Promise<TransfereeCredit> {
  const payload = await patchAuthenticatedJson(
    `${TRANSFEREE_CREDITS_PATH}/${id}`,
    parse(transfereeCreditActionInputSchema, input, "transferee credit action"),
  )
  return parse(
    transfereeCreditEnvelopeSchema,
    payload,
    "updated transferee credit",
  ).data
}

/** The Registrar's decision on an endorsed credit. */
export async function decideTransfereeCredit(
  id: number,
  input: DecideTransfereeCreditInput,
): Promise<TransfereeCredit> {
  return actOnTransfereeCredit(
    id,
    parse(
      decideTransfereeCreditInputSchema,
      input,
      "transferee credit decision",
    ),
  )
}

/**
 * Subjects of the student's own curriculum this credit could be mapped to,
 * best first. Advice for the Program Chair, computed on demand.
 */
export async function getTransfereeCreditSuggestions(
  id: number,
  signal?: AbortSignal,
): Promise<CreditSubjectSuggestion[]> {
  return parse(
    creditSubjectSuggestionsEnvelopeSchema,
    await getAuthenticatedJson(
      `${TRANSFEREE_CREDITS_PATH}/${id}/suggestions`,
      signal,
    ),
    "credit subject suggestions",
  ).data
}
