"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import {
  CalendarClockIcon,
  CalendarDays,
  DoorOpen,
  LayoutGridIcon,
  ListIcon,
  PencilLine,
} from "lucide-react"
import { useMemo, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AcademicTermSelector } from "@/features/components/portal/academic-term-selector"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import {
  SectionScheduleCalendarDialog,
} from "@/features/components/portal/section-schedule-calendar-dialog"
import type { SectionScheduleItem } from "@/features/components/portal/section-schedule-calendar"
import {
  RoomScheduleAssignmentDialog,
  type RoomScheduleAssignmentResult,
} from "@/features/components/portal/room-schedule-assignment-dialog"
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
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/features/components/ui/toggle-group"
import { useFacultyDirectoryQuery } from "@/features/hooks/use-faculty-directory"
import { useFacultySubjectPreferencesQuery } from "@/features/hooks/use-faculty-input"
import { useAcademicTermSelection } from "@/features/hooks/use-academic-term-selection"
import {
  useCurriculaQuery,
  useSectionsQuery,
  useSubjectsQuery,
  sectionsQueryKey,
} from "@/features/hooks/use-reference-data"
import { useSectionPlansQuery } from "@/features/hooks/use-section-plans"
import {
  replaceSection,
  toSectionReplacement,
} from "@/features/services/scheduling-service"
import { isApiClientError } from "@/features/services/api-client"
import type { Curriculum, Section } from "@/features/schemas/reference-data-schema"

const years = [1, 2, 3, 4] as const

function yearLabel(year: number) {
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`
}

const asTime = (value: string) => (value ? `${value}:00`.slice(0, 8) : "")

function curriculumAgeLabel(
  curriculum: Curriculum | undefined,
  newestIdByProgram: Map<number, number>,
) {
  if (!curriculum) return ""
  return newestIdByProgram.get(curriculum.program_id) === curriculum.id
    ? "New curriculum"
    : "Old curriculum"
}

const dayOptionsList = [
  { value: "M", label: "Monday (M)" },
  { value: "T", label: "Tuesday (T)" },
  { value: "W", label: "Wednesday (W)" },
  { value: "Th", label: "Thursday (Th)" },
  { value: "F", label: "Friday (F)" },
  { value: "Sat", label: "Saturday (Sat)" },
  { value: "MW", label: "Mon / Wed (MW)" },
  { value: "TTh", label: "Tue / Thu (TTh)" },
  { value: "MWF", label: "Mon / Wed / Fri (MWF)" },
  { value: "FSat", label: "Fri / Sat (FSat)" },
] as const

function sectionSaveErrorMessages(error: unknown): readonly string[] {
  if (isApiClientError(error)) {
    const fieldErrors = Object.values(error.fieldErrors ?? {}).flat()
    if (fieldErrors.length > 0) return fieldErrors
    return [error.message]
  }

  if (error instanceof Error) return [error.message]

  return ["The section assignment could not be saved. Try again."]
}

export function ScheduleWorkspace() {
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const termSelection = useAcademicTermSelection()
  const { term, termId, sortedTerms, isCurrentTerm, setSelectedTermId } =
    termSelection
  const sectionsQuery = useSectionsQuery()
  const subjectsQuery = useSubjectsQuery()
  const facultyQuery = useFacultyDirectoryQuery()
  const preferencesQuery = useFacultySubjectPreferencesQuery()
  const curriculaQuery = useCurriculaQuery()
  const plansQuery = useSectionPlansQuery(termId, term !== null)
  const [activeYear, setActiveYear] = useState("1")
  const [view, setView] = useState<"table" | "tiles">("table")
  const [editing, setEditing] = useState<Section | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [calendarSection, setCalendarSection] = useState<{
    blockCode: string
    year: number
    sections: Section[]
  } | null>(null)

  const [draft, setDraft] = useState({
    professor_id: "",
    schedule_days: "",
    starts_at_time: "",
    ends_at_time: "",
    room: "",
    modality: "f2f" as "f2f" | "hyflex_a" | "hyflex_b",
    capacity: 40,
    override_reason: "",
  })

  const currentSections = (sectionsQuery.data ?? []).filter(
    (section) =>
      section.academic_term_id === termId &&
      !/^[1-4][A-Z]$/u.test(section.section_code),
  )

  const newestCurriculumIdByProgram = useMemo(() => {
    const map = new Map<number, number>()
    const sorted = [...(curriculaQuery.data ?? [])].sort(
      (left, right) =>
        right.effective_school_year.localeCompare(left.effective_school_year) ||
        right.id - left.id,
    )
    for (const curriculum of sorted) {
      if (!map.has(curriculum.program_id)) {
        map.set(curriculum.program_id, curriculum.id)
      }
    }
    return map
  }, [curriculaQuery.data])

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

  const planCurriculumById = useMemo(
    () =>
      new Map(
        (plansQuery.data ?? []).map((plan) => [
          plan.id,
          plan.curriculum_id,
        ]),
      ),
    [plansQuery.data],
  )

  const selectedCurriculumForYear = (year: number) => {
    const plan = (plansQuery.data ?? []).find(
      (item) => item.year_level === year && item.section_count > 0,
    )
    if (plan?.curriculum_id) {
      return (curriculaQuery.data ?? []).find((c) => c.id === plan.curriculum_id)
    }
    // Fallback: look at first section in this year
    const sampleSection = currentSections.find(
      (s) => (planYearById.get(s.section_plan_id ?? -1) ?? "") === String(year),
    )
    if (sampleSection?.section_plan_id) {
      const curId = planCurriculumById.get(sampleSection.section_plan_id)
      if (curId) {
        return (curriculaQuery.data ?? []).find((c) => c.id === curId)
      }
    }
    return (curriculaQuery.data ?? [])[0]
  }

  const subjects = useMemo(
    () => (curriculaQuery.data ?? []).flatMap((c) => c.subjects),
    [curriculaQuery.data],
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

  const subjectFor = (subjectId: number) =>
    subjects.find((subject) => subject.subject_id === subjectId) ??
    subjectMap.get(subjectId)

  const unitsFor = (subjectId: number) =>
    subjectFor(subjectId)?.units ??
    subjectMap.get(subjectId)?.units ??
    "—"

  const facultyNameFor = (professorId: number | null) =>
    facultyQuery.data?.find((member) => member.id === professorId)?.name

  const groupedByYear = useMemo(() => {
    const groups = new Map<string, Section[]>()
    currentSections
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
  }, [currentSections, activeYear, planYearById])

  const calendarItems: SectionScheduleItem[] = useMemo(() => {
    if (!calendarSection) return []
    const allSecs = sectionsQuery.data ?? []
    return calendarSection.sections.map((sec) => {
      const section = allSecs.find((candidate) => candidate.id === sec.id) ?? sec
      const subject = subjectFor(section.subject_id)
      const u = unitsFor(section.subject_id)
      return {
        id: section.id,
        subject_code: subject?.code ?? `Subject #${section.subject_id}`,
        subject_title: subject?.title ?? "Subject",
        units: typeof u === "number" ? u : Number(u) || null,
        section_code: section.section_code,
        room: section.room,
        professor_name: facultyNameFor(section.professor_id) ?? null,
        schedule_days: section.schedule_days,
        starts_at_time: section.starts_at_time,
        ends_at_time: section.ends_at_time,
        modality: section.modality ?? null,
        capacity: section.capacity,
        enrolled_count: section.enrolled_count,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarSection, sectionsQuery.data, subjects, facultyQuery.data, subjectMap])

  const currentSectionScheduledItems: SectionScheduleItem[] = useMemo(() => {
    if (!editing) return []
    const allSections = sectionsQuery.data ?? []
    return allSections
      .filter(
        (s) =>
          s.section_code === editing.section_code &&
          s.academic_term_id === editing.academic_term_id &&
          s.id !== editing.id &&
          s.schedule_days &&
          s.starts_at_time &&
          s.ends_at_time,
      )
      .map((s) => {
        const subj = subjectFor(s.subject_id)
        const u = unitsFor(s.subject_id)
        return {
          id: s.id,
          subject_code: subj?.code ?? `Subject #${s.subject_id}`,
          subject_title: subj?.title ?? "Subject",
          units: typeof u === "number" ? u : Number(u) || null,
          section_code: s.section_code,
          room: s.room,
          professor_name: facultyNameFor(s.professor_id) ?? null,
          schedule_days: s.schedule_days,
          starts_at_time: s.starts_at_time,
          ends_at_time: s.ends_at_time,
          modality: s.modality ?? null,
          capacity: s.capacity,
          enrolled_count: s.enrolled_count,
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, sectionsQuery.data, subjects, facultyQuery.data, subjectMap])

  const capableIds = useMemo(() => {
    if (!editing) return []
    return (preferencesQuery.data ?? [])
      .filter(
        (pref) =>
          pref.subject_id === editing.subject_id &&
          (pref.rank === 1 || pref.rank === 2),
      )
      .map((pref) => pref.professor_id)
  }, [editing, preferencesQuery.data])

  const availableFaculty = useMemo(() => {
    const list = facultyQuery.data ?? []
    return [...list].sort((left, right) => {
      const leftPref = capableIds.includes(left.id)
      const rightPref = capableIds.includes(right.id)
      if (leftPref !== rightPref) return leftPref ? -1 : 1
      return left.name.localeCompare(right.name)
    })
  }, [facultyQuery.data, capableIds])

  const saveSection = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Choose a section to edit.")
      return replaceSection(
        editing.id,
        toSectionReplacement(editing, {
          professor_id: draft.professor_id ? Number(draft.professor_id) : null,
          schedule_days: draft.schedule_days,
          starts_at_time: draft.starts_at_time ? asTime(draft.starts_at_time) : "",
          ends_at_time: draft.ends_at_time ? asTime(draft.ends_at_time) : "",
          room: draft.room,
          modality: draft.modality,
          capacity: Number(draft.capacity),
          override_reason: draft.override_reason || undefined,
        }),
      )
    },
    onSuccess: async () => {
      setEditing(null)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: sectionsQueryKey(session?.userId ?? null),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: ["room-occupancy"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["section-plans"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["rooms"],
        }),
      ])
      await sectionsQuery.refetch()
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
      modality: (section.modality as "f2f" | "hyflex_a" | "hyflex_b") ?? "f2f",
      capacity: section.capacity,
      override_reason: "",
    })
  }

  const applyPickedSchedule = (result: RoomScheduleAssignmentResult) => {
    setDraft((current) => ({
      ...current,
      schedule_days: result.scheduleDays,
      starts_at_time: result.startsAtTime,
      ends_at_time: result.endsAtTime,
      room: result.room,
      modality: result.modality,
    }))
  }

  const query = {
    isPending:
      termSelection.termsQuery.isPending ||
      sectionsQuery.isPending ||
      subjectsQuery.isPending ||
      facultyQuery.isPending ||
      curriculaQuery.isPending ||
      plansQuery.isPending,
    isError:
      termSelection.termsQuery.isError ||
      sectionsQuery.isError ||
      subjectsQuery.isError ||
      facultyQuery.isError ||
      curriculaQuery.isError ||
      plansQuery.isError,
    error:
      termSelection.termsQuery.error ??
      sectionsQuery.error ??
      subjectsQuery.error ??
      facultyQuery.error ??
      curriculaQuery.error ??
      plansQuery.error,
    data: true as const,
    refetch: () => {
      void termSelection.termsQuery.refetch()
      void sectionsQuery.refetch()
      void subjectsQuery.refetch()
      void facultyQuery.refetch()
      void curriculaQuery.refetch()
      void plansQuery.refetch()
    },
  }

  const activeCurriculum = selectedCurriculumForYear(Number(activeYear))

  return (
    <WorkspacePage
      title="Schedule"
      description="Review and edit the generated section schedule and assignments for the selected term."
      lastUpdated={sectionsQuery.dataUpdatedAt}
    >
      <AsyncBoundary query={query} loadingLabel="Loading the generated schedule…">
        {() => (
          <div className="grid gap-5">
            <AcademicTermSelector
              sortedTerms={sortedTerms}
              term={term}
              isCurrentTerm={isCurrentTerm}
              onSelectTerm={setSelectedTermId}
            />

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
                  <Badge variant="outline">{currentSections.length} rows</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Tabs value={activeYear} onValueChange={setActiveYear}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <TabsList aria-label="Generated section year filter" className="h-auto w-full p-1 sm:w-fit">
                      {years.map((year) => {
                        const cur = selectedCurriculumForYear(year)
                        return (
                          <TabsTrigger
                            key={year}
                            value={String(year)}
                            aria-label={yearLabel(year)}
                            className="flex flex-col items-center justify-center gap-0.5 px-3.5 py-1.5 h-auto text-xs sm:text-sm"
                          >
                            <span className="font-semibold leading-tight">{yearLabel(year)}</span>
                            {cur && (
                              <span className="text-[10px] font-medium opacity-80 leading-tight">
                                {cur.effective_school_year}
                              </span>
                            )}
                          </TabsTrigger>
                        )
                      })}
                    </TabsList>

                    <ToggleGroup
                      type="single"
                      value={view}
                      onValueChange={(val) => {
                        if (val === "table" || val === "tiles") setView(val)
                      }}
                      variant="outline"
                      size="sm"
                      aria-label="Generated section layout"
                    >
                      <ToggleGroupItem value="table" aria-label="Table view">
                        <ListIcon data-icon="inline-start" />
                        Table
                      </ToggleGroupItem>
                      <ToggleGroupItem value="tiles" aria-label="Tile view">
                        <LayoutGridIcon data-icon="inline-start" />
                        Tiles
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {activeCurriculum && (
                    <div className="my-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium text-foreground">
                          Curriculum for {yearLabel(Number(activeYear))}:
                        </span>
                        <span className="font-semibold text-primary">
                          {activeCurriculum.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {curriculumAgeLabel(activeCurriculum, newestCurriculumIdByProgram)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          SY {activeCurriculum.effective_school_year}
                        </Badge>
                      </div>
                    </div>
                  )}

                  {years.map((year) => (
                    <TabsContent key={year} value={String(year)} className="mt-3">
                      {groupedByYear.length === 0 ? (
                        <Alert>
                          <AlertDescription>
                            No generated schedule rows for {yearLabel(year)}.
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <div className="grid gap-4">
                          {groupedByYear.map(({ blockCode, sections }) => (
                            <Card key={blockCode}>
                              <CardHeader className="border-b bg-muted/30">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <CardTitle className="flex flex-wrap items-center gap-2">
                                      {blockCode}
                                      {sections.every(
                                        (section) =>
                                          section.capacity === sections[0].capacity,
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
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    onClick={() =>
                                      setCalendarSection({
                                        blockCode,
                                        year,
                                        sections,
                                      })
                                    }
                                  >
                                    <CalendarDays className="size-4" aria-hidden="true" />
                                    View in calendar
                                  </Button>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0">
                                {view === "table" ? (
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
                                          const subject = subjectFor(
                                            section.subject_id,
                                          )
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
                                                {unitsFor(section.subject_id)}
                                              </TableCell>
                                              <TableCell>{section.id}</TableCell>
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
                                                  onClick={() => open(section)}
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
                                ) : (
                                  <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                                    {sections.map((section) => (
                                      <Card key={section.id} size="sm">
                                        <CardHeader>
                                          <CardTitle>
                                            {subjectFor(section.subject_id)
                                              ?.code ??
                                              `Subject #${section.subject_id}`}
                                          </CardTitle>
                                          <CardDescription>
                                            {subjectFor(section.subject_id)
                                              ?.title ?? "Subject"}{" "}
                                            · {unitsFor(section.subject_id)} units
                                          </CardDescription>
                                        </CardHeader>
                                        <CardContent className="grid gap-3">
                                          <p className="text-sm text-muted-foreground">
                                            Sched ID {section.id} ·{" "}
                                            {section.schedule_days
                                              ? `${section.schedule_days} ${section.starts_at_time?.slice(0, 5)}–${section.ends_at_time?.slice(0, 5)}`
                                              : "No schedule"}{" "}
                                            · Room {section.room ?? "—"}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            Prof: {facultyNameFor(section.professor_id) ?? "Unassigned"}
                                          </p>
                                          <Badge variant="secondary">
                                            {section.modality
                                              ? section.modality.replace("_", " ").toUpperCase()
                                              : "Modality not set"}
                                          </Badge>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={section.status === "published" || !isCurrentTerm}
                                            onClick={() => open(section)}
                                          >
                                            <CalendarClockIcon data-icon="inline-start" />
                                            Assign schedule
                                          </Button>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                )}
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
          </div>
        )}
      </AsyncBoundary>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent className="max-h-[100dvh] overflow-y-auto rounded-none sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>
              Schedule assignment · {editing?.section_code ?? "Block"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? `${subjectFor(editing.subject_id)?.code ?? "Subject"} · Sched ID ${editing.id}`
                : "Choose faculty and meeting details for this subject."}
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <FieldGroup className="grid gap-3 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="schedule-professor">Professor</FieldLabel>
                <SearchableCombobox
                  id="schedule-professor"
                  label="Professor"
                  options={availableFaculty.map((member) => ({
                    value: String(member.id),
                    label: member.name,
                  }))}
                  value={draft.professor_id}
                  onValueChange={(value) =>
                    setDraft({ ...draft, professor_id: value })
                  }
                  placeholder="Search professor"
                  emptyMessage="No matching professor."
                />
              </Field>

              {draft.room ? (
                <>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => setPickerOpen(true)}
                    >
                      <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>
                        Room <strong className="text-foreground">{draft.room}</strong> ·{" "}
                        <span className="text-primary font-semibold">{draft.schedule_days}</span>{" "}
                        {draft.starts_at_time}–{draft.ends_at_time} ({draft.modality.toUpperCase()})
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground underline">Change on calendar</span>
                    </Button>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="schedule-day">Day(s)</FieldLabel>
                    <Select
                      value={draft.schedule_days}
                      onValueChange={(value) =>
                        setDraft({ ...draft, schedule_days: value })
                      }
                    >
                      <SelectTrigger id="schedule-day" aria-label="Schedule day">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {dayOptionsList.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="schedule-room">Room</FieldLabel>
                    <Input
                      id="schedule-room"
                      value={draft.room}
                      onChange={(event) =>
                        setDraft({ ...draft, room: event.target.value })
                      }
                      placeholder="e.g. 3A, LAB 1"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="schedule-starts">Start time</FieldLabel>
                    <Input
                      id="schedule-starts"
                      type="time"
                      value={draft.starts_at_time}
                      onChange={(event) =>
                        setDraft({ ...draft, starts_at_time: event.target.value })
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="schedule-ends">End time</FieldLabel>
                    <Input
                      id="schedule-ends"
                      type="time"
                      value={draft.ends_at_time}
                      onChange={(event) =>
                        setDraft({ ...draft, ends_at_time: event.target.value })
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="schedule-modality">Modality</FieldLabel>
                    <Select
                      value={draft.modality}
                      onValueChange={(value) =>
                        setDraft({
                          ...draft,
                          modality: value as "f2f" | "hyflex_a" | "hyflex_b",
                        })
                      }
                    >
                      <SelectTrigger id="schedule-modality" aria-label="Schedule modality">
                        <SelectValue placeholder="Select modality" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="f2f">Face to Face (F2F)</SelectItem>
                          <SelectItem value="hyflex_a">HyFlex A</SelectItem>
                          <SelectItem value="hyflex_b">HyFlex B</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="schedule-capacity">Seats</FieldLabel>
                    <Input
                      id="schedule-capacity"
                      type="number"
                      min={1}
                      max={80}
                      value={draft.capacity}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          capacity: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <div
                    onClick={() => setPickerOpen(true)}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center transition-colors hover:border-primary hover:bg-primary/10"
                  >
                    <DoorOpen className="size-8 text-primary" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-foreground">Select a room</p>
                      <p className="text-xs text-muted-foreground">
                        Browse room availability on the calendar and pick a conflict-free time slot.
                      </p>
                    </div>
                    <Button type="button" size="sm" className="mt-1">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      Open Room Calendar
                    </Button>
                  </div>
                </div>
              )}

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="schedule-override">Override Reason (Optional)</FieldLabel>
                <Input
                  id="schedule-override"
                  value={draft.override_reason}
                  onChange={(event) =>
                    setDraft({ ...draft, override_reason: event.target.value })
                  }
                  placeholder="Required when changing an established schedule"
                />
              </Field>
            </FieldGroup>
          )}

          {saveSection.error !== null && (
            <Alert variant="destructive">
              <AlertDescription>
                {sectionSaveErrorMessages(saveSection.error).map(
                  (message, index) => (
                    <p key={`${message}-${index}`}>{message}</p>
                  ),
                )}
              </AlertDescription>
            </Alert>
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
              onClick={() => saveSection.mutate()}
              disabled={saveSection.isPending}
            >
              {saveSection.isPending ? "Saving…" : "Save schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SectionScheduleCalendarDialog
        open={calendarSection !== null}
        onOpenChange={(open) => !open && setCalendarSection(null)}
        title={`${calendarSection?.blockCode ?? "Section"} Schedule`}
        subtitle={`${yearLabel(calendarSection?.year ?? 1)} Block Section · ${calendarItems.length} subjects`}
        items={calendarItems}
        onSelectSubject={(item) => {
          const targetSection =
            (sectionsQuery.data ?? []).find((s) => s.id === item.id) ??
            calendarSection?.sections.find((s) => s.id === item.id)
          if (targetSection) {
            open(targetSection)
          }
        }}
      />

      <RoomScheduleAssignmentDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        termId={termId}
        initialRoom={draft.room || null}
        excludeSectionId={editing?.id}
        sectionCode={editing?.section_code}
        sectionScheduleItems={currentSectionScheduledItems}
        onConfirm={applyPickedSchedule}
      />
    </WorkspacePage>
  )
}

