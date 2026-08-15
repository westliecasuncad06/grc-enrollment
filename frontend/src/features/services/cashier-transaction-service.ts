import {
  cashierPaymentCandidateEnvelopeSchema,
  cashierPaymentCandidateLookupSchema,
  cashierTransactionFiltersSchema,
  paginatedCashierTransactionsSchema,
  type CashierPaymentCandidate,
  type CashierTransactionFilters,
  type PaginatedCashierTransactions,
} from "@/features/schemas/cashier-transaction-schema"
import {
  ApiClientError,
  getAuthenticatedJson,
} from "@/features/services/api-client"

export const CASHIER_TRANSACTIONS_PATH = "/api/v1/cashier-transactions"
export const CASHIER_PAYMENT_CANDIDATES_PATH =
  "/api/v1/cashier-payment-candidates"

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

export async function listCashierTransactions(
  filters: CashierTransactionFilters,
  signal?: AbortSignal,
): Promise<PaginatedCashierTransactions> {
  const parsed = parse(
    cashierTransactionFiltersSchema,
    filters,
    "Cashier transaction filter",
  )
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(parsed)) {
    if (value !== undefined) query.set(key, String(value))
  }

  return parse(
    paginatedCashierTransactionsSchema,
    await getAuthenticatedJson(
      `${CASHIER_TRANSACTIONS_PATH}?${query.toString()}`,
      signal,
    ),
    "Cashier transaction list",
  )
}

export async function findCashierPaymentCandidate(
  studentNumber: string,
  signal?: AbortSignal,
): Promise<CashierPaymentCandidate> {
  const parsedStudentNumber = parse(
    cashierPaymentCandidateLookupSchema,
    studentNumber,
    "Cashier student-number lookup",
  )
  const query = new URLSearchParams({ student_number: parsedStudentNumber })
  const envelope = parse(
    cashierPaymentCandidateEnvelopeSchema,
    await getAuthenticatedJson(
      `${CASHIER_PAYMENT_CANDIDATES_PATH}?${query.toString()}`,
      signal,
    ),
    "Cashier payment candidate",
  )

  return envelope.data
}
