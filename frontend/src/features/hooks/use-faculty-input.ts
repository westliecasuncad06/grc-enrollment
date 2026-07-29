"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import {
  getFacultyAvailabilities,
  getFacultySubjectPreferences,
} from "@/features/services/faculty-service"

export const facultyAvailabilitiesQueryKey = (userId: string | null) =>
  ["faculty-availabilities", userId] as const
export const facultySubjectPreferencesQueryKey = (userId: string | null) =>
  ["faculty-subject-preferences", userId] as const

export function useFacultyAvailabilitiesQuery() {
  const { session } = useAuth()

  return useQuery({
    queryKey: facultyAvailabilitiesQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getFacultyAvailabilities(signal),
    enabled: session !== null,
  })
}

export function useFacultySubjectPreferencesQuery() {
  const { session } = useAuth()

  return useQuery({
    queryKey: facultySubjectPreferencesQueryKey(session?.userId ?? null),
    queryFn: ({ signal }) => getFacultySubjectPreferences(signal),
    enabled: session !== null,
  })
}
