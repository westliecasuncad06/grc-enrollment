"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  archiveAndCreateNextAcademicTerm,
  createAcademicTerm,
  getAcademicTerms,
  updateAcademicTerm,
  getCurricula,
  getPrograms,
  getSections,
  getSubjects,
} from "@/features/services/reference-data-service"
import type { ArchiveAndCreateNextInput } from "@/features/schemas/academic-term-schema"

export const academicTermsQueryKey = (userId: string | null) =>
  ["academic-terms", userId] as const
export const programsQueryKey = (userId: string | null) =>
  ["programs", userId] as const
export const subjectsQueryKey = (userId: string | null) =>
  ["subjects", userId] as const
export const curriculaQueryKey = (userId: string | null) =>
  ["curricula", userId] as const
export const sectionsQueryKey = (userId: string | null) =>
  ["sections", userId] as const

interface ReferenceDataQueryOptions {
  enabled?: boolean
}

export function useAcademicTermsQuery({
  enabled = true,
}: ReferenceDataQueryOptions = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: academicTermsQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getAcademicTerms(signal),
    enabled: enabled && session !== null,
  })
}

export function useCreateAcademicTermMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createAcademicTerm,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: academicTermsQueryKey(session?.userId ?? null),
        exact: true,
      }),
  })
}

export function useUpdateAcademicTermMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      academicTermId,
      action,
    }: {
      academicTermId: number
      action: "open_enrollment" | "archive"
    }) => updateAcademicTerm(academicTermId, action),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: academicTermsQueryKey(session?.userId ?? null),
        exact: true,
      }),
  })
}

export function useArchiveAndCreateNextTermMutation() {
  const { session } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      academicTermId,
      next,
    }: {
      academicTermId: number
      next: ArchiveAndCreateNextInput
    }) => archiveAndCreateNextAcademicTerm(academicTermId, next),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: academicTermsQueryKey(session?.userId ?? null),
        exact: true,
      }),
  })
}

export function useProgramsQuery({
  enabled = true,
}: ReferenceDataQueryOptions = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: programsQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getPrograms(signal),
    enabled: enabled && session !== null,
  })
}

export function useSubjectsQuery({
  enabled = true,
}: ReferenceDataQueryOptions = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: subjectsQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getSubjects(signal),
    enabled: enabled && session !== null,
  })
}

export function useCurriculaQuery({
  enabled = true,
}: ReferenceDataQueryOptions = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: curriculaQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getCurricula(signal),
    enabled: enabled && session !== null,
  })
}

export function useSectionsQuery({
  enabled = true,
}: ReferenceDataQueryOptions = {}) {
  const { session } = useAuth()

  return useQuery({
    queryKey: sectionsQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getSections(signal),
    enabled: enabled && session !== null,
  })
}
