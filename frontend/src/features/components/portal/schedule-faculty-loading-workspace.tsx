"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { History, PencilLine, SlidersHorizontal } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/features/components/ui/tabs"
import { useFacultyDirectoryQuery } from "@/features/hooks/use-faculty-directory"
import {
  useAcademicTermsQuery,
  useSectionsQuery,
  useSubjectsQuery,
  sectionsQueryKey,
} from "@/features/hooks/use-reference-data"
import { useSectionPlansQuery } from "@/features/hooks/use-section-plans"
import {
  formatAcademicTerm,
  getActiveAcademicTerm,
} from "@/features/services/reference-data-service"
import {
  getFacultyLoadReport,
  saveFacultyLoadThreshold,
} from "@/features/services/schedule-generation-service"
import {
  replaceSection,
  toSectionReplacement,
} from "@/features/services/scheduling-service"
import { updateFacultyWorkforceProfile } from "@/features/services/faculty-directory-service"
import type { Section } from "@/features/schemas/reference-data-schema"
import type { FacultyMember } from "@/features/schemas/scheduling-schema"

const years = [1, 2, 3, 4] as const
const termStatusLabels: Record<string, string> = {
  draft: "Draft",
  for_dean_approval: "For Dean Approval",
  semester_ongoing: "Current",
  semester_closed: "Closed",
  archived: "Archived",
}

function yearLabel(year: number) {
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`
}

const asTime = (value: string) => (value ? `${value}:00`.slice(0, 8) : "")

function matchesProfessorSearch(
  name: string | null | undefined,
  normalizedSearch: string,
) {
  return (
    !normalizedSearch ||
    (name ?? "").toLocaleLowerCase().includes(normalizedSearch)
  )
}

export function ScheduleFacultyLoadingWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termsQuery = useAcademicTermsQuery()
  const sectionsQuery = useSectionsQuery()
  const subjectsQuery = useSubjectsQuery()
  const facultyQuery = useFacultyDirectoryQuery()
  const workforceQuery = useFacultyDirectoryQuery(true)
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
  const plansQuery = useSectionPlansQuery(termId, term !== null)
  const reportQuery = useQuery({
    queryKey: ["faculty-load-report", session?.userId ?? null, termId],
    queryFn: () => getFacultyLoadReport(termId),
    enabled: termId > 0,
  })
  const [activeYear, setActiveYear] = useState("1")
  const [filter, setFilter] = useState({
    subject: "",
    professor: "all",
    state: "all",
  })
  const [professorSearch, setProfessorSearch] = useState("")
  const [editing, setEditing] = useState<Section | null>(null)
  const [workforceEditing, setWorkforceEditing] =
    useState<FacultyMember | null>(null)
  const [topView, setTopView] = useState<
    "schedule" | "load-report" | "workforce"
  >("schedule")
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
  const [workforceDraft, setWorkforceDraft] = useState({
    status: "active" as "active" | "disabled",
    employment_type: "part_time" as "full_time" | "part_time",
    reason: "",
  })
  const currentSections = (sectionsQuery.data ?? []).filter(
    (section) => section.academic_term_id === termId,
  )
  const planYearById = useMemo(
    () =>
      new Map(
        (plansQuery.data ?? []).map((plan) => [
          plan.id,
          String(plan.year_level),
        ]),
      ),
    [plansQuery.data],
  )
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
  const normalizedProfessorSearch = professorSearch.trim().toLocaleLowerCase()
  const matchingFacultyDirectory = useMemo(
    () =>
      (facultyQuery.data ?? []).filter((faculty) =>
        matchesProfessorSearch(faculty.name, normalizedProfessorSearch),
      ),
    [facultyQuery.data, normalizedProfessorSearch],
  )
  const visible = useMemo(
    () =>
      currentSections.filter((section) => {
        const professorName = section.professor_id
          ? facultyMap.get(section.professor_id)?.name
          : null
        const incomplete =
          section.professor_id === null ||
          !section.schedule_days ||
          !section.room ||
          !section.modality
        return (
          (!filter.subject ||
            subjectMap
              .get(section.subject_id)
              ?.code.toLocaleLowerCase()
              .includes(filter.subject.toLocaleLowerCase())) &&
          (filter.professor === "all" ||
            String(section.professor_id ?? "none") === filter.professor) &&
          matchesProfessorSearch(professorName, normalizedProfessorSearch) &&
          (filter.state === "all" ||
            (filter.state === "incomplete" ? incomplete : !incomplete))
        )
      }),
    [
      currentSections,
      facultyMap,
      filter,
      normalizedProfessorSearch,
      subjectMap,
    ],
  )
  const groupedByYear = useMemo(() => {
    const groups = new Map<string, Section[]>()
    visible
      .filter(
        (section) =>
          (planYearById.get(section.section_plan_id ?? -1) ?? "") ===
          activeYear,
      )
      .sort(
        (left, right) =>
          left.section_code.localeCompare(right.section_code) ||
          left.id - right.id,
      )
      .forEach((section) =>
        groups.set(section.section_code, [
          ...(groups.get(section.section_code) ?? []),
          section,
        ]),
      )
    return [...groups.entries()].map(([blockCode, sections]) => ({
      blockCode,
      sections,
    }))
  }, [visible, activeYear, planYearById])
  const visibleFaculty = useMemo(
    () =>
      (reportQuery.data?.faculty ?? []).filter((faculty) =>
        matchesProfessorSearch(
          faculty.professor_name,
          normalizedProfessorSearch,
        ),
      ),
    [reportQuery.data?.faculty, normalizedProfessorSearch],
  )
  const visibleWorkforce = useMemo(
    () =>
      (workforceQuery.data ?? []).filter((faculty) =>
        matchesProfessorSearch(faculty.name, normalizedProfessorSearch),
      ),
    [workforceQuery.data, normalizedProfessorSearch],
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
  const saveWorkforceProfile = useMutation({
    mutationFn: async () => {
      if (!workforceEditing) throw new Error("Choose a faculty member to edit.")
      return updateFacultyWorkforceProfile(workforceEditing.id, {
        status: workforceDraft.status,
        employment_type: workforceDraft.employment_type,
        reason: workforceDraft.reason || undefined,
      })
    },
    onSuccess: () => {
      setWorkforceEditing(null)
      void queryClient.invalidateQueries({
        queryKey: ["faculty-directory", session?.userId ?? null],
      })
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
  const openWorkforceProfile = (faculty: FacultyMember) => {
    setWorkforceEditing(faculty)
    setWorkforceDraft({
      status: faculty.status,
      employment_type: faculty.employment_type ?? "part_time",
      reason: "",
    })
  }
  const query = {
    isPending:
      termsQuery.isPending ||
      sectionsQuery.isPending ||
      subjectsQuery.isPending ||
      facultyQuery.isPending ||
      workforceQuery.isPending ||
      plansQuery.isPending ||
      reportQuery.isPending,
    isError:
      termsQuery.isError ||
      sectionsQuery.isError ||
      subjectsQuery.isError ||
      facultyQuery.isError ||
      workforceQuery.isError ||
      plansQuery.isError ||
      reportQuery.isError,
    error:
      termsQuery.error ??
      sectionsQuery.error ??
      subjectsQuery.error ??
      facultyQuery.error ??
      workforceQuery.error ??
      plansQuery.error ??
      reportQuery.error,
    data: true as const,
    refetch: () => {
      void termsQuery.refetch()
      void sectionsQuery.refetch()
      void subjectsQuery.refetch()
      void facultyQuery.refetch()
      void workforceQuery.refetch()
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
                  onChange={(event) =>
                    setSelectedTermId(Number(event.target.value))
                  }
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

            <Card>
              <CardHeader>
                <CardTitle level={2}>Filters</CardTitle>
                <CardDescription>
                  Applies across the schedule, load report, and workforce views
                  below — switching views keeps these filters.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label
                  className="grid gap-1 text-sm font-medium"
                  htmlFor="schedule-subject-filter"
                >
                  Subject
                  <Input
                    id="schedule-subject-filter"
                    value={filter.subject}
                    onChange={(event) =>
                      setFilter({
                        ...filter,
                        subject: event.target.value,
                      })
                    }
                    placeholder="Search code"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Professor
                  <select
                    value={filter.professor}
                    onChange={(event) =>
                      setFilter({
                        ...filter,
                        professor: event.target.value,
                      })
                    }
                    className="h-9 rounded-md border bg-background px-2"
                  >
                    <option value="all">All professors</option>
                    <option value="none">Unassigned</option>
                    {matchingFacultyDirectory.map((faculty) => (
                      <option key={faculty.id} value={String(faculty.id)}>
                        {faculty.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className="grid gap-1 text-sm font-medium"
                  htmlFor="schedule-professor-search"
                >
                  Find professor
                  <Input
                    id="schedule-professor-search"
                    value={professorSearch}
                    onChange={(event) => setProfessorSearch(event.target.value)}
                    placeholder="Search name"
                  />
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
              </CardContent>
            </Card>

            <Tabs
              value={topView}
              onValueChange={(value) => setTopView(value as typeof topView)}
            >
              <TabsList aria-label="Schedule and faculty loading views">
                <TabsTrigger value="schedule">
                  Generated Schedule and Assignments
                </TabsTrigger>
                <TabsTrigger value="load-report">
                  Faculty Load Report
                </TabsTrigger>
                <TabsTrigger value="workforce">Faculty Workforce</TabsTrigger>
              </TabsList>

              <TabsContent value="schedule" className="mt-4 grid gap-5">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle level={2}>
                          Generated schedule and assignments
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Faculty matching prioritizes declared subject
                          preference, availability, no conflict, then lower
                          assigned units.
                        </p>
                      </div>
                      <Badge variant="outline">{visible.length} rows</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <Tabs value={activeYear} onValueChange={setActiveYear}>
                      <TabsList aria-label="Generated section year filter">
                        {years.map((year) => (
                          <TabsTrigger key={year} value={String(year)}>
                            {yearLabel(year)}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {years.map((year) => (
                        <TabsContent
                          key={year}
                          value={String(year)}
                          className="mt-3"
                        >
                          {groupedByYear.length === 0 ? (
                            <Alert>
                              <AlertDescription>
                                No generated schedule rows match the current
                                filters for {yearLabel(year)}.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <div className="grid gap-4">
                              {groupedByYear.map(({ blockCode, sections }) => (
                                <Card key={blockCode}>
                                  <CardHeader className="border-b bg-muted/30">
                                    <CardTitle className="flex flex-wrap items-center gap-2">
                                      {blockCode}
                                      {sections.every(
                                        (section) =>
                                          section.capacity ===
                                          sections[0].capacity,
                                      ) ? (
                                        <Badge variant="secondary">
                                          {sections[0].capacity} seats
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline">
                                          Mixed seat counts
                                        </Badge>
                                      )}
                                    </CardTitle>
                                    <CardDescription>
                                      {yearLabel(year)} block section ·{" "}
                                      {sections.length} subject
                                      {sections.length === 1 ? "" : "s"}
                                    </CardDescription>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="overflow-x-auto rounded-lg border">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>Subject code</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Units</TableHead>
                                            <TableHead>Sched ID</TableHead>
                                            <TableHead>Day</TableHead>
                                            <TableHead>Time</TableHead>
                                            <TableHead>Room</TableHead>
                                            <TableHead>Professor</TableHead>
                                            <TableHead>Modality</TableHead>
                                            <TableHead className="text-right">
                                              Action
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {sections.map((section) => {
                                            const subject = subjectMap.get(
                                              section.subject_id,
                                            )
                                            // A submitted-but-not-yet-published
                                            // section is still editable — the
                                            // Program Chair can keep fixing
                                            // room/professor assignments while
                                            // waiting for Dean/Executive
                                            // Director review. Only a
                                            // published (live) section locks.
                                            const locked =
                                              section.status === "published"
                                            return (
                                              <TableRow key={section.id}>
                                                <TableCell className="font-medium">
                                                  {subject?.code ??
                                                    `#${section.subject_id}`}
                                                </TableCell>
                                                <TableCell>
                                                  {subject?.title ?? "Subject"}
                                                </TableCell>
                                                <TableCell>
                                                  {subject?.units ?? "—"}
                                                </TableCell>
                                                <TableCell>
                                                  {section.id}
                                                </TableCell>
                                                <TableCell>
                                                  {section.schedule_days ?? "—"}
                                                </TableCell>
                                                <TableCell>
                                                  {section.starts_at_time &&
                                                  section.ends_at_time
                                                    ? `${section.starts_at_time.slice(0, 5)}–${section.ends_at_time.slice(0, 5)}`
                                                    : "—"}
                                                </TableCell>
                                                <TableCell>
                                                  {section.room ?? "—"}
                                                </TableCell>
                                                <TableCell>
                                                  {section.professor_id ? (
                                                    (facultyMap.get(
                                                      section.professor_id,
                                                    )?.name ??
                                                    `Faculty #${section.professor_id}`)
                                                  ) : (
                                                    <Badge variant="destructive">
                                                      Unassigned
                                                    </Badge>
                                                  )}
                                                </TableCell>
                                                <TableCell>
                                                  {section.modality
                                                    ?.replace("_", " ")
                                                    .toUpperCase() ?? "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                      open(section)
                                                    }
                                                    disabled={
                                                      locked || !isCurrentTerm
                                                    }
                                                  >
                                                    <PencilLine data-icon="inline-start" />
                                                    {locked
                                                      ? "Published"
                                                      : !isCurrentTerm
                                                        ? "Archived"
                                                        : "Edit"}
                                                  </Button>
                                                </TableCell>
                                              </TableRow>
                                            )
                                          })}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                      ))}
                    </Tabs>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="load-report" className="mt-4">
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
                      <Badge variant="outline">
                        {visibleFaculty.length} professors
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {visibleFaculty.length ? (
                      visibleFaculty.map((faculty) => (
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
                                Assigned subjects:{" "}
                                {faculty.assignments
                                  .map((assignment) => assignment.subject_code)
                                  .join(", ")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  faculty.overloaded
                                    ? "destructive"
                                    : "secondary"
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
                    ) : reportQuery.data?.faculty.length ? (
                      <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                        No professor matches “{professorSearch}”.
                      </p>
                    ) : (
                      <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                        Generate a schedule to see the load report.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="workforce" className="mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle level={2}>Faculty workforce</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Manage the local planning status and employment type
                          for faculty in your college. Inactive faculty cannot
                          be recommended or assigned.
                        </p>
                      </div>
                      <Badge variant="outline">
                        {visibleWorkforce.length} faculty
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Faculty member</TableHead>
                            <TableHead>Account status</TableHead>
                            <TableHead>Employment type</TableHead>
                            <TableHead>Planning reference</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleWorkforce.map((faculty) => (
                            <TableRow key={faculty.id}>
                              <TableCell className="font-medium">
                                {faculty.name}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    faculty.is_assignable
                                      ? "secondary"
                                      : "destructive"
                                  }
                                >
                                  {faculty.status_label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {faculty.employment_type_label ?? "Unspecified"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {faculty.planning_unit_reference
                                  ? `${faculty.planning_unit_reference}-unit reference`
                                  : "No fixed reference"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  aria-label={`Edit workforce profile for ${faculty.name}`}
                                  onClick={() => openWorkforceProfile(faculty)}
                                >
                                  <PencilLine data-icon="inline-start" />
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {visibleWorkforce.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                className="py-9 text-center text-muted-foreground"
                              >
                                No faculty match the current professor search.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
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
      <Dialog
        open={workforceEditing !== null}
        onOpenChange={(open) => !open && setWorkforceEditing(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update faculty workforce profile</DialogTitle>
            <DialogDescription>
              {workforceEditing?.name ?? "Faculty member"} will be available for
              future schedule recommendations only while their account is
              active. Marking an active account inactive requires an audit
              reason.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Account status">
              <select
                value={workforceDraft.status}
                onChange={(event) =>
                  setWorkforceDraft({
                    ...workforceDraft,
                    status: event.target.value as "active" | "disabled",
                  })
                }
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="active">Active</option>
                <option value="disabled">Inactive</option>
              </select>
            </Field>
            <Field label="Employment type">
              <select
                value={workforceDraft.employment_type}
                onChange={(event) =>
                  setWorkforceDraft({
                    ...workforceDraft,
                    employment_type: event.target.value as
                      "full_time" | "part_time",
                  })
                }
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="full_time">Full-time (33-unit reference)</option>
                <option value="part_time">Part-time</option>
              </select>
            </Field>
            <Field
              label={
                workforceEditing?.status === "active" &&
                workforceDraft.status === "disabled"
                  ? "Reason for making this account inactive"
                  : "Change note (optional)"
              }
            >
              <Input
                value={workforceDraft.reason}
                onChange={(event) =>
                  setWorkforceDraft({
                    ...workforceDraft,
                    reason: event.target.value,
                  })
                }
                placeholder="Record the reason for this change"
              />
            </Field>
          </div>
          {saveWorkforceProfile.error instanceof Error && (
            <p className="text-sm text-destructive">
              {saveWorkforceProfile.error.message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setWorkforceEditing(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveWorkforceProfile.mutateAsync()}
              disabled={
                saveWorkforceProfile.isPending ||
                (workforceEditing?.status === "active" &&
                  workforceDraft.status === "disabled" &&
                  !workforceDraft.reason.trim())
              }
            >
              {saveWorkforceProfile.isPending
                ? "Saving…"
                : "Save workforce profile"}
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
