"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  getEnrollmentSummary,
  getInstitutionSummary,
  getPolicySettings,
  getStuckEnrollments,
} from "@/features/services/dashboard-service"

export const enrollmentSummaryQueryKey = (
  userId: string | null,
  academicTermId?: number,
) => ["enrollment-summary", userId, academicTermId ?? null] as const

export function useEnrollmentSummaryQuery(
  academicTermId?: number,
  enabled = true,
) {
  const { session } = useAuth()
  return useQuery({
    queryKey: enrollmentSummaryQueryKey(
      session?.userId ?? null,
      academicTermId,
    ),
    queryFn: ({ signal }) => getEnrollmentSummary(academicTermId, signal),
    enabled: enabled && session !== null,
  })
}

export const institutionSummaryQueryKey = (userId: string | null) =>
  ["institution-summary", userId] as const

export function useInstitutionSummaryQuery(enabled = true) {
  const { session } = useAuth()
  return useQuery({
    queryKey: institutionSummaryQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getInstitutionSummary(signal),
    enabled: enabled && session !== null,
  })
}

export const policySettingsQueryKey = (userId: string | null) =>
  ["policy-settings", userId] as const

export function usePolicySettingsQuery(enabled = true) {
  const { session } = useAuth()
  return useQuery({
    queryKey: policySettingsQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getPolicySettings(signal),
    enabled: enabled && session !== null,
  })
}

export const stuckEnrollmentsQueryKey = (
  userId: string | null,
  academicTermId?: number,
) => ["stuck-enrollments", userId, academicTermId ?? null] as const

export function useStuckEnrollmentsQuery(
  academicTermId?: number,
  enabled = true,
) {
  const { session } = useAuth()
  return useQuery({
    queryKey: stuckEnrollmentsQueryKey(session?.userId ?? null, academicTermId),
    queryFn: ({ signal }) => getStuckEnrollments(academicTermId, signal),
    enabled: enabled && session !== null,
  })
}
