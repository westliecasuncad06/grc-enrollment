"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/features/auth/use-auth"
import { getFacultyMembers } from "@/features/services/faculty-directory-service"

export const facultyDirectoryQueryKey = (
  userId: string | null,
  includeInactive = false,
) => ["faculty-directory", userId, includeInactive] as const
export function useFacultyDirectoryQuery(includeInactive = false) {
  const { session } = useAuth()
  return useQuery({
    queryKey: facultyDirectoryQueryKey(
      session?.userId ?? null,
      includeInactive,
    ),
    queryFn: ({ signal }) => getFacultyMembers(signal, includeInactive),
    enabled: session !== null,
  })
}
