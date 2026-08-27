"use client"

import { History } from "lucide-react"

import type { AcademicTerm } from "@/features/schemas/reference-data-schema"
import { formatAcademicTerm } from "@/features/services/reference-data-service"

const termStatusLabels: Record<string, string> = {
  draft: "Draft",
  for_dean_approval: "For Dean Approval",
  semester_ongoing: "Current",
  semester_closed: "Closed",
  archived: "Archived",
}

interface AcademicTermSelectorProps {
  sortedTerms: readonly AcademicTerm[]
  term: AcademicTerm | null
  isCurrentTerm: boolean
  onSelectTerm: (id: number) => void
}

export function AcademicTermSelector({
  sortedTerms,
  term,
  isCurrentTerm,
  onSelectTerm,
}: AcademicTermSelectorProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <History className="size-4 text-primary" aria-hidden="true" />
        <div>
          <p className="font-medium">School year and semester</p>
          <p className="text-sm text-muted-foreground">
            {isCurrentTerm
              ? "Viewing the current term. Assignments are editable."
              : "Viewing an archived schedule — read-only. Switch back to the current term to make changes."}
          </p>
        </div>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        <span className="sr-only">Academic term</span>
        <select
          value={term?.id ?? ""}
          onChange={(event) => onSelectTerm(Number(event.target.value))}
          className="h-9 rounded-md border bg-background px-2"
        >
          {sortedTerms.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {formatAcademicTerm(candidate)}
              {candidate.status !== "semester_ongoing"
                ? ` (${termStatusLabels[candidate.status] ?? candidate.status})`
                : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
