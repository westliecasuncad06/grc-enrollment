"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { PencilLine, SlidersHorizontal, UsersRound } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Input } from "@/features/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useFacultyDirectoryQuery } from "@/features/hooks/use-faculty-directory"
import {
  useAcademicTermsQuery,
  useSectionsQuery,
  useSubjectsQuery,
  sectionsQueryKey,
} from "@/features/hooks/use-reference-data"
import { useSectionPlansQuery } from "@/features/hooks/use-section-plans"
import { getActiveAcademicTerm } from "@/features/services/reference-data-service"
import {
  getFacultyLoadReport,
  saveFacultyLoadThreshold,
} from "@/features/services/schedule-generation-service"
import {
  replaceSection,
  toSectionReplacement,
} from "@/features/services/scheduling-service"
import type { Section } from "@/features/schemas/reference-data-schema"

const asTime = (value: string) => (value ? `${value}:00`.slice(0, 8) : "")

export function ScheduleFacultyLoadingWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termsQuery = useAcademicTermsQuery()
  const sectionsQuery = useSectionsQuery()
  const subjectsQuery = useSubjectsQuery()
  const facultyQuery = useFacultyDirectoryQuery()
  const term = getActiveAcademicTerm(termsQuery.data)
  const termId = term?.id ?? 0
  const plansQuery = useSectionPlansQuery(termId, term !== null)
  const reportQuery = useQuery({
    queryKey: ["faculty-load-report", session?.userId ?? null, termId],
    queryFn: () => getFacultyLoadReport(termId),
    enabled: termId > 0,
  })
  const [filter, setFilter] = useState({
    year: "all",
    subject: "",
    professor: "all",
    state: "all",
  })
  const [editing, setEditing] = useState<Section | null>(null)
  const [draft, setDraft] = useState({
    professor_id: "",
    schedule_days: "",
    starts_at_time: "",
    ends_at_time: "",
    room: "",
    modality: "f2f",
    capacity: 40,
    override_reason: "",
  })
  const [threshold, setThreshold] = useState("")
  const currentSections = (sectionsQuery.data ?? []).filter(
    (section) => section.academic_term_id === termId,
  )
  const plans = plansQuery.data ?? []
  const subjectMap = useMemo(
    () =>
      new Map(
        (subjectsQuery.data ?? []).map((subject) => [subject.id, subject]),
      ),
    [subjectsQuery.data],
  )
  const facultyMap = useMemo(
    () =>
      new Map(
        (facultyQuery.data ?? []).map((faculty) => [faculty.id, faculty]),
      ),
    [facultyQuery.data],
  )
  const visible = useMemo(
    () =>
      currentSections.filter((section) => {
        const year = /^([1-4])/u.exec(section.section_code)?.[1] ?? ""
        const incomplete =
          section.professor_id === null ||
          !section.schedule_days ||
          !section.room ||
          !section.modality
        return (
          (filter.year === "all" || year === filter.year) &&
          (!filter.subject ||
            subjectMap
              .get(section.subject_id)
              ?.code.toLocaleLowerCase()
              .includes(filter.subject.toLocaleLowerCase())) &&
          (filter.professor === "all" ||
            String(section.professor_id ?? "none") === filter.professor) &&
          (filter.state === "all" ||
            (filter.state === "incomplete" ? incomplete : !incomplete))
        )
      }),
    [currentSections, filter, subjectMap],
  )
  const saveSection = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Choose a section to edit.")
      return replaceSection(
        editing.id,
        toSectionReplacement(editing, {
          professor_id: draft.professor_id ? Number(draft.professor_id) : null,
          schedule_days: draft.schedule_days,
          starts_at_time: asTime(draft.starts_at_time),
          ends_at_time: asTime(draft.ends_at_time),
          room: draft.room,
          modality: draft.modality as "hyflex_a" | "hyflex_b" | "f2f",
          capacity: Number(draft.capacity),
          override_reason: draft.override_reason || null,
        }),
      )
    },
    onSuccess: () => {
      setEditing(null)
      void queryClient.invalidateQueries({
        queryKey: sectionsQueryKey(session?.userId ?? null),
        exact: true,
      })
      void reportQuery.refetch()
    },
  })
  const saveThreshold = useMutation({
    mutationFn: () => saveFacultyLoadThreshold(termId, Number(threshold)),
    onSuccess: () => {
      setThreshold("")
      void reportQuery.refetch()
    },
  })
  const open = (section: Section) => {
    setEditing(section)
    setDraft({
      professor_id: section.professor_id ? String(section.professor_id) : "",
      schedule_days: section.schedule_days ?? "",
      starts_at_time: section.starts_at_time?.slice(0, 5) ?? "",
      ends_at_time: section.ends_at_time?.slice(0, 5) ?? "",
      room: section.room ?? "",
      modality: section.modality ?? "f2f",
      capacity: section.capacity,
      override_reason: "",
    })
  }
  const query = {
    isPending:
      termsQuery.isPending ||
      sectionsQuery.isPending ||
      subjectsQuery.isPending ||
      facultyQuery.isPending ||
      plansQuery.isPending ||
      reportQuery.isPending,
    isError:
      termsQuery.isError ||
      sectionsQuery.isError ||
      subjectsQuery.isError ||
      facultyQuery.isError ||
      plansQuery.isError ||
      reportQuery.isError,
    error:
      termsQuery.error ??
      sectionsQuery.error ??
      subjectsQuery.error ??
      facultyQuery.error ??
      plansQuery.error ??
      reportQuery.error,
    data: true as const,
    refetch: () => {
      void termsQuery.refetch()
      void sectionsQuery.refetch()
      void subjectsQuery.refetch()
      void facultyQuery.refetch()
      void plansQuery.refetch()
      void reportQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Schedule & Faculty Loading"
      description="Review the editable generated schedule, faculty workloads, availability-aware recommendations, and conflicts before submitting for approval."
      lastUpdated={Math.max(
        sectionsQuery.dataUpdatedAt,
        reportQuery.dataUpdatedAt,
      )}
    >
      <AsyncBoundary
        query={query}
        loadingLabel="Loading schedule and faculty recommendations…"
      >
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
                    value={threshold || reportQuery.data?.threshold_units || ""}
                    onChange={(event) => setThreshold(event.target.value)}
                    placeholder="e.g. 18"
                  />
                </label>
                <Button
                  type="button"
                  onClick={() => void saveThreshold.mutateAsync()}
                  disabled={!threshold || saveThreshold.isPending}
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
              </CardContent>
            </Card>

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
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle level={2}>
                      Generated schedule and assignments
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Faculty matching prioritizes declared subject preference,
                      availability, no conflict, then lower assigned units.
                    </p>
                  </div>
                  <Badge variant="outline">{visible.length} rows</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-4">
                  <label className="grid gap-1 text-sm font-medium">
                    Year
                    <select
                      value={filter.year}
                      onChange={(event) =>
                        setFilter({ ...filter, year: event.target.value })
                      }
                      className="h-9 rounded-md border bg-background px-2"
                    >
                      <option value="all">All years</option>
                      {[1, 2, 3, 4].map((year) => (
                        <option key={year} value={String(year)}>
                          Year {year}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Subject
                    <Input
                      value={filter.subject}
                      onChange={(event) =>
                        setFilter({ ...filter, subject: event.target.value })
                      }
                      placeholder="Search code"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Professor
                    <select
                      value={filter.professor}
                      onChange={(event) =>
                        setFilter({ ...filter, professor: event.target.value })
                      }
                      className="h-9 rounded-md border bg-background px-2"
                    >
                      <option value="all">All professors</option>
                      <option value="none">Unassigned</option>
                      {(facultyQuery.data ?? []).map((faculty) => (
                        <option key={faculty.id} value={String(faculty.id)}>
                          {faculty.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Assignment state
                    <select
                      value={filter.state}
                      onChange={(event) =>
                        setFilter({ ...filter, state: event.target.value })
                      }
                      className="h-9 rounded-md border bg-background px-2"
                    >
                      <option value="all">All rows</option>
                      <option value="complete">Complete</option>
                      <option value="incomplete">Needs review</option>
                    </select>
                  </label>
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Section / Subject</TableHead>
                        <TableHead>Professor</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Room / Mode</TableHead>
                        <TableHead>Recommendation</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((section) => {
                        const subject = subjectMap.get(section.subject_id)
                        const plan = plans.find(
                          (item) => item.id === section.section_plan_id,
                        )
                        const locked = plan?.status === "submitted"
                        const incomplete =
                          section.professor_id === null ||
                          !section.schedule_days ||
                          !section.room ||
                          !section.modality
                        return (
                          <TableRow key={section.id}>
                            <TableCell>
                              <p className="font-medium">
                                {section.section_code} ·{" "}
                                {subject?.code ?? `#${section.subject_id}`}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {subject?.title}
                              </p>
                            </TableCell>
                            <TableCell>
                              {section.professor_id ? (
                                (facultyMap.get(section.professor_id)?.name ??
                                `Faculty #${section.professor_id}`)
                              ) : (
                                <Badge variant="destructive">Unassigned</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {section.schedule_days
                                ? `${section.schedule_days} · ${section.starts_at_time?.slice(0, 5)}–${section.ends_at_time?.slice(0, 5)}`
                                : "Not scheduled"}
                            </TableCell>
                            <TableCell>
                              {section.room ?? "No room"}
                              <p className="text-xs text-muted-foreground">
                                {section.modality
                                  ?.replace("_", " ")
                                  .toUpperCase() ?? "No mode"}
                              </p>
                            </TableCell>
                            <TableCell>
                              {section.recommendation_prediction_run_id ? (
                                <Badge variant="secondary">AI draft</Badge>
                              ) : (
                                <Badge variant="outline">Manual</Badge>
                              )}
                              {incomplete && (
                                <p className="mt-1 text-xs text-destructive">
                                  Needs review
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => open(section)}
                                disabled={locked}
                              >
                                <PencilLine data-icon="inline-start" />
                                {locked ? "Submitted" : "Edit"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      {visible.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-9 text-center text-muted-foreground"
                          >
                            No generated schedule rows match the current
                            filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle level={2}>Faculty Load Report</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Assignment rationale is retained even when the Program
                      Chair makes an override.
                    </p>
                  </div>
                  <UsersRound className="size-5 text-primary" />
                </div>
              </CardHeader>
              <CardContent className="grid gap-3">
                {reportQuery.data?.faculty.length ? (
                  reportQuery.data.faculty.map((faculty) => (
                    <div
                      key={faculty.professor_id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {faculty.professor_name ??
                              `Faculty #${faculty.professor_id}`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {faculty.assignments
                              .map((assignment) => assignment.subject_code)
                              .join(", ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              faculty.overloaded ? "destructive" : "secondary"
                            }
                          >
                            {faculty.total_units} units
                          </Badge>
                          <Badge variant="outline">
                            {faculty.assignments.length} assignments
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {faculty.assignments
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
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit section assignment</DialogTitle>
            <DialogDescription>
              Changes to an AI-generated faculty, time, room, or modality need
              an override reason for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Professor">
              <select
                value={draft.professor_id}
                onChange={(event) =>
                  setDraft({ ...draft, professor_id: event.target.value })
                }
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="">Unassigned</option>
                {(facultyQuery.data ?? []).map((faculty) => (
                  <option key={faculty.id} value={String(faculty.id)}>
                    {faculty.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Schedule days">
              <Input
                value={draft.schedule_days}
                onChange={(event) =>
                  setDraft({ ...draft, schedule_days: event.target.value })
                }
                placeholder="MWF"
              />
            </Field>
            <Field label="Start time">
              <Input
                type="time"
                value={draft.starts_at_time}
                onChange={(event) =>
                  setDraft({ ...draft, starts_at_time: event.target.value })
                }
              />
            </Field>
            <Field label="End time">
              <Input
                type="time"
                value={draft.ends_at_time}
                onChange={(event) =>
                  setDraft({ ...draft, ends_at_time: event.target.value })
                }
              />
            </Field>
            <Field label="Room">
              <Input
                value={draft.room}
                onChange={(event) =>
                  setDraft({ ...draft, room: event.target.value })
                }
              />
            </Field>
            <Field label="Modality">
              <select
                value={draft.modality}
                onChange={(event) =>
                  setDraft({ ...draft, modality: event.target.value })
                }
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="f2f">F2F</option>
                <option value="hyflex_a">HyFlex A</option>
                <option value="hyflex_b">HyFlex B</option>
              </select>
            </Field>
            <Field label="Capacity">
              <Input
                type="number"
                min="1"
                value={draft.capacity}
                onChange={(event) =>
                  setDraft({ ...draft, capacity: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Override reason">
              <Input
                value={draft.override_reason}
                onChange={(event) =>
                  setDraft({ ...draft, override_reason: event.target.value })
                }
                placeholder="Required when changing AI output"
              />
            </Field>
          </div>
          {saveSection.error instanceof Error && (
            <p className="text-sm text-destructive">
              {saveSection.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveSection.mutateAsync()}
              disabled={saveSection.isPending}
            >
              {saveSection.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}
