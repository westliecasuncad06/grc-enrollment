import {
  createTransfereeCreditInputSchema,
  decideTransfereeCreditInputSchema,
  paginatedTransfereeCreditsSchema,
  transfereeCreditEnvelopeSchema,
  transfereeCreditFiltersSchema,
  type CreateTransfereeCreditInput,
  type DecideTransfereeCreditInput,
  type Paginated,
  type TransfereeCredit,
  type TransfereeCreditFilters,
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

export async function decideTransfereeCredit(
  id: number,
  input: DecideTransfereeCreditInput,
): Promise<TransfereeCredit> {
  const payload = await patchAuthenticatedJson(
    `${TRANSFEREE_CREDITS_PATH}/${id}`,
    parse(
      decideTransfereeCreditInputSchema,
      input,
      "transferee credit decision",
    ),
  )
  return parse(
    transfereeCreditEnvelopeSchema,
    payload,
    "updated transferee credit",
  ).data
}
