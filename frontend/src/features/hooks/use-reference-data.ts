"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  getAcademicTerms,
  getCurricula,
  getPrograms,
  getSubjects,
} from "@/features/services/reference-data-service"

export const academicTermsQueryKey = (userId: string | null) =>
  ["academic-terms", userId] as const
export const programsQueryKey = (userId: string | null) =>
  ["programs", userId] as const
export const subjectsQueryKey = (userId: string | null) =>
  ["subjects", userId] as const
export const curriculaQueryKey = (userId: string | null) =>
  ["curricula", userId] as const

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
