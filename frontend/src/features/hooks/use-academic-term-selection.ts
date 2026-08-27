"use client"

import { useMemo, useState } from "react"

import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import { getActiveAcademicTerm } from "@/features/services/reference-data-service"
import type { AcademicTerm } from "@/features/schemas/reference-data-schema"

export function useAcademicTermSelection() {
  const termsQuery = useAcademicTermsQuery()
  const currentTerm = getActiveAcademicTerm(termsQuery.data)
  const sortedTerms = useMemo(
    () =>
      [...(termsQuery.data ?? [])].sort((left, right) => right.id - left.id),
    [termsQuery.data],
  )
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null)
  const term =
    sortedTerms.find((candidate) => candidate.id === selectedTermId) ??
    currentTerm ??
    sortedTerms[0] ??
    null
  const termId = term?.id ?? 0
  const isCurrentTerm =
    term !== null && currentTerm !== null && term.id === currentTerm.id

  return {
    termsQuery,
    sortedTerms,
    term,
    termId,
    isCurrentTerm,
    selectedTermId,
    setSelectedTermId,
  }
}

export type AcademicTermSelection = ReturnType<typeof useAcademicTermSelection>
