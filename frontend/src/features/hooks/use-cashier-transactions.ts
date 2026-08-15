"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import type { CashierTransactionFilters } from "@/features/schemas/cashier-transaction-schema"
import {
  findCashierPaymentCandidate,
  listCashierTransactions,
} from "@/features/services/cashier-transaction-service"

export const cashierTransactionsQueryKey = (
  userId: string | null,
  filters: CashierTransactionFilters,
) => ["cashier-transactions", userId, filters] as const

export const cashierPaymentCandidateQueryKey = (
  userId: string | null,
  studentNumber: string | null,
) => ["cashier-payment-candidate", userId, studentNumber] as const

export function useCashierTransactionsQuery(
  filters: CashierTransactionFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: cashierTransactionsQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listCashierTransactions(filters, signal),
    enabled: enabled && session !== null,
  })
}

export function useCashierPaymentCandidateQuery(
  studentNumber: string | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()
  const hasStudentNumber = studentNumber !== null && studentNumber.trim() !== ""

  return useQuery({
    queryKey: cashierPaymentCandidateQueryKey(
      session?.userId ?? null,
      studentNumber,
    ),
    queryFn: ({ signal }) =>
      findCashierPaymentCandidate(studentNumber ?? "", signal),
    enabled: enabled && session !== null && hasStudentNumber,
  })
}
