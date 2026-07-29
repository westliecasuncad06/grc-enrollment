"use client"

import { useQuery } from "@tanstack/react-query"

import {
  getAcademicTerms,
  getPrograms,
  getSubjects,
} from "@/features/services/reference-data-service"

export const academicTermsQueryKey = ["academic-terms"] as const
export const programsQueryKey = ["programs"] as const
export const subjectsQueryKey = ["subjects"] as const

interface ReferenceDataQueryOptions {
  enabled?: boolean
}

export function useAcademicTermsQuery({
  enabled = true,
}: ReferenceDataQueryOptions = {}) {
  return useQuery({
    queryKey: academicTermsQueryKey,
    queryFn: ({ signal }) => getAcademicTerms(signal),
    enabled,
  })
}

export function useProgramsQuery({
  enabled = true,
}: ReferenceDataQueryOptions = {}) {
  return useQuery({
    queryKey: programsQueryKey,
    queryFn: ({ signal }) => getPrograms(signal),
    enabled,
  })
}

export function useSubjectsQuery({
  enabled = true,
}: ReferenceDataQueryOptions = {}) {
  return useQuery({
    queryKey: subjectsQueryKey,
    queryFn: ({ signal }) => getSubjects(signal),
    enabled,
  })
}
