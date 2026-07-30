"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import type {
  AcademicGradeFilters,
  UpdateAcademicGradeInput,
} from "@/features/schemas/academic-grade-schema"
import {
  createAcademicGrade,
  listAcademicGrades,
  updateAcademicGrade,
} from "@/features/services/academic-grade-service"

export const academicGradesQueryKey = (
  userId: string | null,
  filters: AcademicGradeFilters,
) => ["academic-grades", userId, filters] as const

export function useAcademicGradesQuery(
  filters: AcademicGradeFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { session } = useAuth()

  return useQuery({
    queryKey: academicGradesQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => listAcademicGrades(filters, signal),
    enabled: enabled && session !== null,
  })
}

function useInvalidateAcademicGradeQueries() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return () =>
    queryClient.invalidateQueries({
      queryKey: ["academic-grades", session?.userId ?? null],
    })
}

export function useCreateAcademicGradeMutation() {
  const invalidate = useInvalidateAcademicGradeQueries()

  return useMutation({
    mutationFn: createAcademicGrade,
    onSuccess: () => invalidate(),
  })
}

export function useUpdateAcademicGradeMutation() {
  const invalidate = useInvalidateAcademicGradeQueries()

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number
      input: UpdateAcademicGradeInput
    }) => updateAcademicGrade(id, input),
    onSuccess: () => invalidate(),
  })
}
