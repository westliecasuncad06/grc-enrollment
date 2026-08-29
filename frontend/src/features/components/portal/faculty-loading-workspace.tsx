"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { SlidersHorizontal } from "lucide-react"
import { useMemo, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AcademicTermSelector } from "@/features/components/portal/academic-term-selector"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
import { useFacultyDirectoryQuery } from "@/features/hooks/use-faculty-directory"
import { useAcademicTermSelection } from "@/features/hooks/use-academic-term-selection"
import {
  getFacultyLoadReport,
  saveFacultyLoadThreshold,
} from "@/features/services/schedule-generation-service"

export function FacultyLoadingWorkspace() {
  const { session } = useAuth()
  const termSelection = useAcademicTermSelection()
  const { term, termId, sortedTerms, isCurrentTerm, setSelectedTermId } =
    termSelection
  const facultyQuery = useFacultyDirectoryQuery()
  const reportQuery = useQuery({
    queryKey: ["faculty-load-report", session?.userId ?? null, termId],
    queryFn: () => getFacultyLoadReport(termId),
    enabled: termId > 0,
  })
  const [threshold, setThreshold] = useState("")
  const [filter, setFilter] = useState({ subjectId: "", professorId: "" })
  const subjectOptions = useMemo(() => {
    const subjectsById = new Map<number, { code: string; title: string }>()
    for (const member of reportQuery.data?.faculty ?? []) {
      for (const assignment of member.assignments) {
        if (!subjectsById.has(assignment.subject_id)) {
          subjectsById.set(assignment.subject_id, {
            code: assignment.subject_code,
            title: assignment.subject_title,
          })
        }
      }
    }
    return [
      { value: "", label: "All subjects" },
      ...Array.from(subjectsById, ([id, subject]) => ({
        value: String(id),
        label: `${subject.code} — ${subject.title}`,
      })).sort((a, b) => a.label.localeCompare(b.label)),
    ]
  }, [reportQuery.data?.faculty])
  const professorOptions = useMemo(
    () => [
      { value: "", label: "All professors" },
      ...(facultyQuery.data ?? []).map((member) => ({
        value: String(member.id),
        label: member.name,
      })),
    ],
    [facultyQuery.data],
  )
  const visibleFaculty = useMemo(
    () =>
      (reportQuery.data?.faculty ?? []).filter(
        (member) =>
          (filter.professorId === "" ||
            String(member.professor_id) === filter.professorId) &&
          (filter.subjectId === "" ||
            member.assignments.some(
              (assignment) =>
                String(assignment.subject_id) === filter.subjectId,
            )),
      ),
    [reportQuery.data?.faculty, filter],
  )
  const saveThreshold = useMutation({
    mutationFn: () => saveFacultyLoadThreshold(termId, Number(threshold)),
    onSuccess: () => {
      setThreshold("")
      void reportQuery.refetch()
    },
  })
  const query = {
    isPending:
      termSelection.termsQuery.isPending ||
      facultyQuery.isPending ||
      reportQuery.isPending,
    isError:
      termSelection.termsQuery.isError ||
      facultyQuery.isError ||
      reportQuery.isError,
    error:
      termSelection.termsQuery.error ??
      facultyQuery.error ??
      reportQuery.error,
    data: true as const,
    refetch: () => {
      void termSelection.termsQuery.refetch()
      void facultyQuery.refetch()
      void reportQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Faculty Loading"
      description="Set the faculty load threshold, review the load report, and manage the faculty workforce."
      lastUpdated={reportQuery.dataUpdatedAt}
    >
      <AsyncBoundary query={query} loadingLabel="Loading faculty load data…">
        {() => (
          <div className="grid gap-5">
            <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
              <CardHeader className="border-b bg-background/60">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2 text-primary">
                      <SlidersHorizontal className="size-4" />
                      <span className="text-xs font-semibold tracking-[0.15em] uppercase">
                        Planning control room
                      </span>
                    </div>
                    <CardTitle level={2}>Faculty load threshold</CardTitle>
                    <p className="text-sm text-muted-foreground">
                       Set one maximum teaching-unit threshold for this college
                      and term. Assignment recommendations remain editable.
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {term
                      ? `${term.school_year} · ${term.semester}`
                      : "No term"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3 pt-5">
                <label
                  className="grid gap-2 text-sm font-medium"
                  htmlFor="faculty-load-threshold"
                >
                  Maximum units
                  <Input
                    id="faculty-load-threshold"
                    type="number"
                    min="1"
                    value={
                      threshold === ""
                        ? (reportQuery.data?.threshold_units ?? "")
                        : threshold
                    }
                    onChange={(event) => setThreshold(event.target.value)}
                    placeholder="e.g. 18"
                  />
                </label>
                <Button
                  type="button"
                  onClick={() => void saveThreshold.mutateAsync()}
                  disabled={
                    !threshold || saveThreshold.isPending || !isCurrentTerm
                  }
                >
                  {saveThreshold.isPending
                    ? "Saving threshold…"
                    : "Save threshold"}
                </Button>
                {reportQuery.data?.threshold_units === null && (
                  <p className="text-sm text-muted-foreground">
                    Overload flags remain off until a threshold is configured.
                  </p>
                )}
                {saveThreshold.error instanceof Error && (
                  <p className="text-sm text-destructive">
                    {saveThreshold.error.message}
                  </p>
                )}
              </CardContent>
            </Card>

            <AcademicTermSelector
              sortedTerms={sortedTerms}
              term={term}
              isCurrentTerm={isCurrentTerm}
              onSelectTerm={setSelectedTermId}
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Teaching assignments"
                value={reportQuery.data?.required_assignments ?? 0}
                detail="Generated section-subject rows"
              />
              <Metric
                label="Required units"
                value={reportQuery.data?.required_teaching_units ?? 0}
                detail="Across current draft"
              />
              <Metric
                label="Equivalent faculty loads"
                value={reportQuery.data?.equivalent_faculty_loads ?? "—"}
                detail="Uses configured threshold"
              />
              <Metric
                label="Flags to review"
                value={
                  (reportQuery.data?.unassigned_count ?? 0) +
                  (reportQuery.data?.overloaded_count ?? 0)
                }
                detail="Unassigned or overload"
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle level={2}>Filters</CardTitle>
                <CardDescription>
                  Narrows the Faculty Load Report below to a subject, a
                  professor, or both.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup className="grid gap-3 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="faculty-loading-subject-filter">
                      Subject
                    </FieldLabel>
                    <SearchableCombobox
                      id="faculty-loading-subject-filter"
                      label="Subject"
                      options={subjectOptions}
                      value={filter.subjectId}
                      onValueChange={(value) =>
                        setFilter({ ...filter, subjectId: value })
                      }
                      placeholder="Search code or title"
                      emptyMessage="No matching subject."
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="faculty-loading-professor-filter">
                      Professor
                    </FieldLabel>
                    <SearchableCombobox
                      id="faculty-loading-professor-filter"
                      label="Professor"
                      options={professorOptions}
                      value={filter.professorId}
                      onValueChange={(value) =>
                        setFilter({ ...filter, professorId: value })
                      }
                      placeholder="Search name"
                      emptyMessage="No matching professor."
                    />
                  </Field>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle level={2}>Faculty Load Report</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Assignment rationale is retained even when the Program
                      Chair makes an override.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {visibleFaculty.length} professors
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {visibleFaculty.length ? (
                  visibleFaculty.map((member) => (
                    <div
                      key={member.professor_id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {member.professor_name ??
                              `Faculty #${member.professor_id}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Assigned subjects:{" "}
                            {member.assignments
                              .map((assignment) => assignment.subject_code)
                              .join(", ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              member.overloaded ? "destructive" : "secondary"
                            }
                          >
                            {member.total_units} units
                          </Badge>
                          <Badge variant="outline">
                            {member.assignments.length} assignments
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {member.assignments
                          .flatMap((assignment) => assignment.rationale)
                          .filter(
                            (value, index, values) =>
                              values.indexOf(value) === index,
                          )
                          .map((reason) => (
                            <Badge key={reason} variant="outline">
                              {reason.replaceAll("_", " ")}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  ))
                ) : reportQuery.data?.faculty.length ? (
                  <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                    No professor matches the current filters.
                  </p>
                ) : (
                  <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                    Generate a schedule to see the load report.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <Card>
      <CardContent className="grid gap-1 p-4">
        <span className="text-xs font-semibold tracking-wide text-primary uppercase">
          {label}
        </span>
        <strong className="font-heading text-2xl">{value}</strong>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </CardContent>
    </Card>
  )
}
