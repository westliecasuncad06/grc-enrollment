"use client"

import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import { useEligibleSubjectsQuery } from "@/features/hooks/use-enrollment"
import { useTermSelection } from "@/features/hooks/use-term-selection"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"
import { formatAcademicTerm } from "@/features/services/reference-data-service"

function SubjectEligibilityCard({ subject }: { subject: EligibleSubject }) {
  return (
    <Card role="article" aria-label={`${subject.code} ${subject.title}`}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span>
            {subject.code} — {subject.title}
          </span>
          <Badge variant={subject.is_eligible ? "default" : "destructive"}>
            {subject.is_eligible ? "Eligible" : "Not eligible"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        <p className="text-sm text-muted-foreground">
          {subject.units} units · Year {subject.year_level} · {subject.semester}{" "}
          semester · {subject.is_required ? "Required" : "Elective"}
        </p>
        <ul className="grid gap-1 text-sm">
          {subject.reasons.map((reason, index) => (
            <li key={`${reason.code}-${index}`}>{reason.message}</li>
          ))}
        </ul>
        {subject.available_sections.length > 0 && (
          <div className="mt-2">
            <p className="text-sm font-medium">Available sections</p>
            <ul className="grid gap-1 text-sm">
              {subject.available_sections.map((section) => (
                <li key={section.id}>
                  Section {section.section_code}
                  {section.schedule_days &&
                  section.starts_at_time &&
                  section.ends_at_time
                    ? ` · ${section.schedule_days} ${section.starts_at_time}–${section.ends_at_time}`
                    : ""}
                  {section.room ? ` · ${section.room}` : ""} ·{" "}
                  {section.remaining_seats} seat
                  {section.remaining_seats === 1 ? "" : "s"} open
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function EligibleSubjectsWorkspace() {
  const termsQuery = useAcademicTermsQuery()
  const { selectedTermId, setSelectedTermId } = useTermSelection(
    termsQuery.data,
  )
  const eligibleSubjectsQuery = useEligibleSubjectsQuery(selectedTermId)

  return (
    <WorkspacePage
      title="Eligible subjects"
      description="Review which curriculum subjects you can currently select, and why."
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="eligible-subjects-term">
            Academic term
          </FieldLabel>
          <select
            id="eligible-subjects-term"
            value={selectedTermId ?? 0}
            onChange={(event) =>
              setSelectedTermId(Number(event.target.value) || null)
            }
          >
            <option value={0}>Select an academic term</option>
            {(termsQuery.data ?? []).map((term) => (
              <option key={term.id} value={term.id}>
                {formatAcademicTerm(term)}
              </option>
            ))}
          </select>
        </Field>
      </FieldGroup>
      {selectedTermId === null ? (
        <p>Select an academic term to view your eligible subjects.</p>
      ) : (
        <AsyncBoundary
          query={{
            isPending: termsQuery.isPending || eligibleSubjectsQuery.isFetching,
            isError: termsQuery.isError || eligibleSubjectsQuery.isError,
            error: termsQuery.error ?? eligibleSubjectsQuery.error,
            data: eligibleSubjectsQuery.data,
            refetch: () => {
              void termsQuery.refetch()
              void eligibleSubjectsQuery.refetch()
            },
          }}
          isEmpty={(subjects) => subjects.length === 0}
          emptyMessage="No subjects are placed in your curriculum for this term."
          loadingLabel="Loading your eligible subjects…"
        >
          {(subjects) => (
            <div className="grid gap-3">
              {subjects.map((subject) => (
                <SubjectEligibilityCard
                  key={subject.subject_id}
                  subject={subject}
                />
              ))}
            </div>
          )}
        </AsyncBoundary>
      )}
    </WorkspacePage>
  )
}
