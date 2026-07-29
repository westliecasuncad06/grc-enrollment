"use client"

import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/features/auth/use-auth"
import { getFacultyMembers } from "@/features/services/faculty-directory-service"

export const facultyDirectoryQueryKey = (userId: string | null) =>
  ["faculty-directory", userId] as const
export function useFacultyDirectoryQuery() {
  const { session } = useAuth()
  return useQuery({
    queryKey: facultyDirectoryQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getFacultyMembers(signal),
    enabled: session !== null,
  })
}
