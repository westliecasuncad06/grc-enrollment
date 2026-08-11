"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  type FacultyAccountFilters,
  type StudentAccountFilters,
} from "@/features/schemas/it-control-schema"
import {
  getItControlFacultyAccounts,
  getItControlStudentAccounts,
} from "@/features/services/it-control-service"

export const itControlStudentAccountsQueryKey = (
  userId: string | null,
  filters: StudentAccountFilters,
) => ["it-control", "students", userId, filters] as const

export const itControlFacultyAccountsQueryKey = (
  userId: string | null,
  filters: FacultyAccountFilters,
) => ["it-control", "faculty", userId, filters] as const

export function useItControlStudentAccountsQuery(
  filters: StudentAccountFilters,
  enabled = true,
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: itControlStudentAccountsQueryKey(
      session?.userId ?? null,
      filters,
    ),
    queryFn: ({ signal }) => getItControlStudentAccounts(filters, signal),
    enabled: enabled && session !== null,
  })
}

export function useItControlFacultyAccountsQuery(
  filters: FacultyAccountFilters,
  enabled = true,
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: itControlFacultyAccountsQueryKey(
      session?.userId ?? null,
      filters,
    ),
    queryFn: ({ signal }) => getItControlFacultyAccounts(filters, signal),
    enabled: enabled && session !== null,
  })
}
