"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import type { EnrollmentDocumentFilters } from "@/features/schemas/enrollment-document-schema"
import { listEnrollmentDocuments } from "@/features/services/enrollment-document-service"

export const enrollmentDocumentsQueryKey = (
  userId: string | null,
  filters: EnrollmentDocumentFilters,
) => ["enrollment-documents", userId, filters] as const

export function useEnrollmentDocumentsQuery(
  filters: EnrollmentDocumentFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: enrollmentDocumentsQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listEnrollmentDocuments(filters, signal),
    enabled: enabled && session !== null,
  })
}
