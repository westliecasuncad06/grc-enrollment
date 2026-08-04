"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import type { EnrollmentFilters } from "@/features/schemas/enrollment-schema"
import {
  confirmPayment,
  getEligibleSubjects,
  getEnrollmentBlocks,
  getEnrollments,
  listEnrollments,
  updateEnrollment,
} from "@/features/services/enrollment-service"

export const eligibleSubjectsQueryKey = (
  userId: string | null,
  academicTermId: number | null,
) => ["eligible-subjects", userId, academicTermId] as const

export function useEligibleSubjectsQuery(academicTermId: number | null) {
  const { session } = useAuth()

  return useQuery({
    queryKey: eligibleSubjectsQueryKey(session?.userId ?? null, academicTermId),
    queryFn: ({ signal }) => getEligibleSubjects(academicTermId!, signal),
    enabled: session !== null && academicTermId !== null,
  })
}

export const enrollmentBlocksQueryKey = (
  userId: string | null,
  academicTermId: number | null,
) => ["enrollment-blocks", userId, academicTermId] as const

export function useEnrollmentBlocksQuery(academicTermId: number | null) {
  const { session } = useAuth()

  return useQuery({
    queryKey: enrollmentBlocksQueryKey(session?.userId ?? null, academicTermId),
    queryFn: ({ signal }) => getEnrollmentBlocks(academicTermId!, signal),
    enabled: session !== null && academicTermId !== null,
  })
}

export const enrollmentsQueryKey = (userId: string | null) =>
  ["enrollments", userId] as const

export function useEnrollmentsQuery({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: enrollmentsQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getEnrollments(signal),
    enabled: enabled && session !== null,
  })
}

/**
 * The Registrar Head approval queue and the Accounting payment queue: a
 * role-scoped, filterable, paginated view distinct from
 * `useEnrollmentsQuery`'s own-record student list.
 */
export const enrollmentsListQueryKey = (
  userId: string | null,
  filters: EnrollmentFilters,
) => ["enrollments-list", userId, filters] as const

export function useEnrollmentsListQuery(
  filters: EnrollmentFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: enrollmentsListQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listEnrollments(filters, signal),
    enabled: enabled && session !== null,
  })
}

/**
 * Both Registrar decisions (`registrar_approve`/`registrar_reject`/`void`)
 * and payment confirmation invalidate the same two query families: the
 * role-scoped list this decision was made from, and the student's own view
 * (only ever populated for a Student session, but harmless to invalidate
 * unconditionally since the query is gated on session presence anyway).
 */
function useInvalidateEnrollmentQueries() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["enrollments-list", session?.userId ?? null],
      }),
      queryClient.invalidateQueries({
        queryKey: enrollmentsQueryKey(session?.userId ?? null),
        exact: true,
      }),
    ])
}

export function useUpdateEnrollmentMutation() {
  const invalidate = useInvalidateEnrollmentQueries()

  return useMutation({
    mutationFn: ({
      id,
      action,
      reason,
      overload_acknowledged,
    }: {
      id: number
      action: "registrar_approve" | "registrar_reject" | "void"
      reason?: string
      overload_acknowledged?: boolean
    }) => updateEnrollment(id, { action, reason, overload_acknowledged }),
    onSuccess: () => invalidate(),
  })
}

export function useConfirmPaymentMutation() {
  const invalidate = useInvalidateEnrollmentQueries()

  return useMutation({
    mutationFn: ({
      id,
      externalReference,
      amount,
    }: {
      id: number
      externalReference?: string
      amount?: number
    }) =>
      confirmPayment(id, {
        external_reference: externalReference,
        amount,
      }),
    onSuccess: () => invalidate(),
  })
}
