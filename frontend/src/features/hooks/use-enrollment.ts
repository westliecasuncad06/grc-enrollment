"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  getEligibleSubjects,
  getEnrollments,
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
