"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import { keepPreviousForSameUser } from "@/features/lib/query-client"
import type {
  EnrollmentFilters,
  ScholarshipPercentage,
} from "@/features/schemas/enrollment-schema"
import {
  applyScholarshipDiscount,
  confirmPayment,
  adjustEnrollmentAssessment,
  getCorPreview,
  getEligibleSubjects,
  getEnrollmentBlocks,
  getEnrollments,
  listEnrollments,
  removeScholarshipDiscount,
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

/**
 * Polls every 10s so a Registrar Staff decision, a Cashier payment
 * confirmation, or a queue-position change shows up on the student's own
 * Enrollment page without them having to refresh — there is no
 * WebSocket/SSE push in this stack, so short polling is the deliberate
 * stand-in. TanStack Query only polls while a component actually observes
 * this query and pauses in a backgrounded tab (`refetchIntervalInBackground`
 * defaults to `false`), so this costs nothing when nobody is looking at
 * the page.
 */
export function useEnrollmentsQuery({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: enrollmentsQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getEnrollments(signal),
    enabled: enabled && session !== null,
    refetchInterval: 10_000,
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

/**
 * Polls every 5s so a newly submitted enrollment shows up in whichever
 * role-scoped queue is watching it — Registrar Staff's Enrollment
 * Approvals and Registrar Head's Overrides & Voids both render their
 * table directly off this query, so both refresh live. The Accounting
 * payment screen also consumes this hook, but only to enrich its ticket
 * rows with financial-status/units/amount-due data joined by enrollment
 * id — its actual waiting-line list comes from `useQueueTicketsQuery`
 * (frontend/src/features/hooks/use-queue-tickets.ts), which does not poll,
 * so a newly approved student still needs a mutation or reload to appear
 * there. Matches the interval already used for the schedule-proposals
 * queue and the notification bell (see
 * docs/superpowers/specs/2026-08-03-realtime-schedule-refresh-design.md
 * and docs/superpowers/specs/2026-08-05-realtime-enrollment-queue-refresh-design.md);
 * `useEnrollmentsQuery` above stays at 10s since that one is a student's
 * own record view, not a staff review queue. Refetches immediately on
 * window focus. TanStack Query pauses polling in hidden tabs by default
 * (`refetchIntervalInBackground` is not set), so this costs nothing when
 * nobody is looking at the page.
 */
export function useEnrollmentsListQuery(
  filters: EnrollmentFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: enrollmentsListQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listEnrollments(filters, signal),
    placeholderData: keepPreviousForSameUser(session?.userId ?? null),
    enabled: enabled && session !== null,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
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
      queryClient.invalidateQueries({
        queryKey: ["student-account"],
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
      requested_by_student,
    }: {
      id: number
      action:
        | "program_head_approve"
        | "program_head_reject"
        | "registrar_approve"
        | "registrar_reject"
        | "void"
        | "student_cancel"
      reason?: string
      overload_acknowledged?: boolean
      requested_by_student?: boolean
    }) =>
      updateEnrollment(id, {
        action,
        reason,
        overload_acknowledged,
        requested_by_student,
      }),
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
      promissoryNoteOnFile,
    }: {
      id: number
      externalReference?: string
      amount?: number
      promissoryNoteOnFile?: boolean
    }) =>
      confirmPayment(id, {
        external_reference: externalReference,
        amount,
        promissory_note_on_file: promissoryNoteOnFile,
      }),
    onSuccess: () => invalidate(),
  })
}

export function useAdjustEnrollmentAssessmentMutation() {
  const invalidate = useInvalidateEnrollmentQueries()

  return useMutation({
    mutationFn: ({
      id,
      reason,
      items,
    }: {
      id: number
      reason: string
      items: Array<{ id: number; amount?: string; unit_amount?: string }>
    }) => adjustEnrollmentAssessment(id, { reason, items }),
    onSuccess: () => invalidate(),
  })
}

/**
 * The Cashier's Payee/Scholar step (ADR 0025). `mutateAsync` resolves only
 * after the enrollment lists and account have been refetched, so the payment
 * modal that opens next already reads the discounted assessment.
 */
export function useApplyScholarshipDiscountMutation() {
  const invalidate = useInvalidateEnrollmentQueries()

  return useMutation({
    mutationFn: ({
      id,
      percentage,
    }: {
      id: number
      percentage: ScholarshipPercentage
    }) => applyScholarshipDiscount(id, percentage),
    onSuccess: () => invalidate(),
  })
}

export function useRemoveScholarshipDiscountMutation() {
  const invalidate = useInvalidateEnrollmentQueries()

  return useMutation({
    mutationFn: ({ id }: { id: number }) => removeScholarshipDiscount(id),
    onSuccess: () => invalidate(),
  })
}

export function useCorPreviewQuery(enrollmentId: number | null) {
  const { session } = useAuth()

  return useQuery({
    queryKey: ["cor-preview", session?.userId ?? null, enrollmentId],
    queryFn: ({ signal }) => getCorPreview(enrollmentId!, signal),
    enabled: session !== null && enrollmentId !== null,
  })
}
