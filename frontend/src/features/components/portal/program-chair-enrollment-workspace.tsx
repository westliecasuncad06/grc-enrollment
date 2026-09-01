"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
  CalendarClockIcon,
  CalendarDays,
  LayoutGridIcon,
  ListIcon,
  MinusIcon,
  PlusIcon,
  UndoDot,
} from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "motion/react"
import Link from "next/link"

import { useAuth } from "@/features/auth/use-auth"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { DemandForecastDialog } from "@/features/components/portal/demand-forecast-dialog"
import {
  SectionScheduleCalendarDialog,
} from "@/features/components/portal/section-schedule-calendar-dialog"
import {
  RoomScheduleAssignmentDialog,
  type RoomScheduleAssignmentResult,
} from "@/features/components/portal/room-schedule-assignment-dialog"
import type { SectionScheduleItem } from "@/features/components/portal/section-schedule-calendar"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { Textarea } from "@/features/components/ui/textarea"
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
import {
  latestScheduleGenerationRunQueryKey,
  useLatestScheduleGenerationRunQuery,
} from "@/features/hooks/use-schedule-generation"
import {
  useAcademicTermsQuery,
  useCurriculaQuery,
  useSectionsQuery,
  useSubjectsQuery,
  sectionsQueryKey,
} from "@/features/hooks/use-reference-data"
import {
  useSectionPlanMutations,
  useSectionPlansQuery,
} from "@/features/hooks/use-section-plans"
import {
  scheduleProposalsQueryKey,
  useScheduleProposalsQuery,
} from "@/features/hooks/use-scheduling"
import { useRoomOptionsQuery } from "@/features/hooks/use-room-catalog"
import { scheduleProposalPresentation } from "@/features/lib/schedule-status"
import { getLocalRoomOptions } from "@/features/services/room-catalog-service"
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
import type {
  Curriculum,
  Section,
} from "@/features/schemas/reference-data-schema"
import type { SectionInput } from "@/features/schemas/scheduling-schema"
import type { ScheduleProposal } from "@/features/schemas/scheduling-schema"
import {
  formatAcademicTerm,
  getActiveAcademicTerm,
} from "@/features/services/reference-data-service"
import { replaceSection } from "@/features/services/scheduling-service"
import { isApiClientError } from "@/features/services/api-client"
import {
  getScheduleGenerationRun,
  startScheduleGeneration,
} from "@/features/services/schedule-generation-service"

const years = [1, 2, 3, 4] as const
const dayOptionsList = [
  { value: "M", label: "Monday (M)" },
  { value: "T", label: "Tuesday (T)" },
  { value: "W", label: "Wednesday (W)" },
  { value: "Th", label: "Thursday (Th)" },
  { value: "F", label: "Friday (F)" },
  { value: "Sat", label: "Saturday (Sat)" },
  { value: "MW", label: "Monday / Wednesday (MW)" },
  { value: "TTh", label: "Tuesday / Thursday (TTh)" },
  { value: "MWF", label: "Mon / Wed / Fri (MWF)" },
  { value: "FSat", label: "Friday / Saturday (FSat)" },
] as const
const modalityLabels = {
  hyflex_a: "Hyflex A",
  hyflex_b: "Hyflex B",
  f2f: "F2F",
} as const

function yearLabel(year: number) {
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`
}

function sectionYearLevel(sectionCode: string) {
  const generated = /(\d)\d{2}$/u.exec(sectionCode)
  if (generated) return Number(generated[1])
  const legacy = Number(sectionCode.charAt(0))
  return years.includes(legacy as (typeof years)[number]) ? legacy : 1
}

function timeWithSeconds(value: string) {
  return value ? (value.length === 5 ? `${value}:00` : value) : null
}

function scheduleErrorMessage(error: unknown) {
  if (isApiClientError(error)) {
    const fieldMessage = Object.values(error.fieldErrors ?? {}).flat()[0]
    return fieldMessage ?? error.message
  }

  return "Schedule could not be saved. Check the professor availability and time range."
}

function scheduleSummary(section: Section, facultyName: string | undefined) {
  const time =
    section.starts_at_time && section.ends_at_time
      ? `${section.starts_at_time.slice(0, 5)}–${section.ends_at_time.slice(0, 5)}`
      : "Not set"

  return [
    section.schedule_days ?? "Day not set",
    time,
    section.room ?? "Room not set",
    facultyName ?? "Professor not set",
  ].join(" · ")
}

// A program's curriculum is "new" only relative to its own other versions —
// never to the current term's year. GRC replaces a curriculum roughly every
// six years but keeps the prior version selectable as long as students who
// entered under it (e.g. a 2023 entrant, still in 4th year) haven't finished,
// so this compares within the program rather than against `currentTerm`.
function curriculumAgeLabel(
  curriculum: Pick<Curriculum, "id" | "program_id"> | null | undefined,
  newestIdByProgram: Map<number, number>,
) {
  if (!curriculum) return ""
  return newestIdByProgram.get(curriculum.program_id) === curriculum.id
    ? "New curriculum"
    : "Old curriculum"
}

function toNumber(value: number | "" | undefined, fallback = 0) {
  return value === "" || value === undefined ? fallback : value
}

function approvalPresentation(
  proposal: ScheduleProposal | undefined,
  submitted: boolean,
) {
  if (proposal) return scheduleProposalPresentation(proposal)
  if (!submitted) return null
  // No proposal object yet in this render (the mutation just succeeded and
  // `proposalsQuery` has not refetched) — this transient state is exactly
  // equivalent to "draft, submitted, not yet decided", so reuse the same
  // presentation instead of duplicating its copy here.
  return scheduleProposalPresentation({
    status: "draft",
    is_submitted: true,
    is_returned: false,
    returned_by_role: null,
    decided_by_name: null,
  })
}

function ApprovalStatusCard({
  proposal,
  submitted,
}: {
  proposal: ScheduleProposal | undefined
  submitted: boolean
}) {
  const presentation = approvalPresentation(proposal, submitted)
  const history = proposal?.decision_history ?? []
  if (!presentation && history.length === 0) return null
  const PresentationIcon = presentation?.icon

  return (
    <Card>
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {PresentationIcon && (
                <PresentationIcon className="size-4" aria-hidden="true" />
              )}
              {presentation?.title ?? "Approval history"}
            </CardTitle>
            {presentation && (
              <CardDescription>{presentation.description}</CardDescription>
            )}
          </div>
          {presentation && (
            <Badge variant={presentation.badgeVariant}>
              {presentation.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      {history.length > 0 && (
        <CardContent>
          <p className="mb-3 text-sm font-medium">Review activity</p>
          <ol className="grid gap-3" aria-label="Schedule approval history">
            {history.map((decision, index) => {
              const isReturn =
                decision.action === "dean_return" ||
                decision.action === "executive_return"
              return (
                <li
                  key={`${decision.action}-${decision.decided_at}-${index}`}
                  className={`grid gap-1 border-l-2 pl-3 ${isReturn ? "border-destructive" : "border-success"}`}
                >
                  <p className="font-medium">{decision.action_label}</p>
                  <p className="text-sm text-muted-foreground">
                    {decision.actor_name} ·{" "}
                    {new Date(decision.decided_at).toLocaleString()}
                  </p>
                  {decision.notes && (
                    <p
                      className={`rounded-md p-2 text-sm ${isReturn ? "bg-destructive/10" : "bg-muted"}`}
                    >
                      <span className="font-medium">Note:</span>{" "}
                      {decision.notes}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        </CardContent>
      )}
    </Card>
  )
}

function MobileScheduleCard({
  section,
  code,
  title,
  units,
  facultyName,
  approvalLocked,
  onAssign,
}: {
  section: Section
  code: string
  title: string
  units: string | number
  facultyName: string | undefined
  approvalLocked: boolean
  onAssign: (section: Section) => void
}) {
  return (
    <Card
      role="article"
      aria-label={`${code} schedule`}
      size="sm"
      className="program-chair-schedule-card"
    >
      <CardHeader>
        <CardTitle level={3}>{code}</CardTitle>
        <CardDescription>
          {title} · {units} units
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <dl className="grid gap-2 text-sm">
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Schedule</dt>
            <dd>
              Sched ID {section.id} · {scheduleSummary(section, facultyName)}
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Modality</dt>
            <dd>
              <Badge variant="secondary">
                {section.modality
                  ? modalityLabels[section.modality]
                  : "Modality not set"}
              </Badge>
            </dd>
          </div>
        </dl>
        <Button
          type="button"
          variant="outline"
          disabled={approvalLocked}
          onClick={() => onAssign(section)}
          className="w-full"
        >
          <CalendarClockIcon data-icon="inline-start" />
          Set schedule
        </Button>
      </CardContent>
    </Card>
  )
}

export function ProgramChairEnrollmentWorkspace({
  workspaceTitle = "Enrollment",
  workspaceDescription = "Build block sections, then assign each subject schedule from its section table.",
  initialView = "table",
}: {
  workspaceTitle?: string
  workspaceDescription?: string
  initialView?: "table" | "tiles"
} = {}) {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termsQuery = useAcademicTermsQuery()
  const curriculaQuery = useCurriculaQuery()
  const sectionsQuery = useSectionsQuery()
  const directoryQuery = useFacultyDirectoryQuery()
  const subjectsQuery = useSubjectsQuery()
  const preferencesQuery = useFacultySubjectPreferencesQuery()
  const roomsQuery = useRoomOptionsQuery()
  const currentTerm = getActiveAcademicTerm(termsQuery.data)
  const proposalsQuery = useScheduleProposalsQuery({
    enabled: currentTerm !== null,
  })
  // Only the two most recent versions per program are ever relevant to a
  // currently-enrolled student (PRD-adjacent rule, per product owner:
  // a 2023 entrant finishes on the 2018-2023 curriculum while 2024+
  // entrants are on 2024-2029), so drafts and anything older are excluded.
  const curriculaByProgramRecency = useMemo(() => {
    const eligible = (curriculaQuery.data ?? []).filter(
      (item) => item.status !== "draft",
    )
    const byProgram = new Map<number, Curriculum[]>()
    for (const curriculum of eligible) {
      const list = byProgram.get(curriculum.program_id) ?? []
      list.push(curriculum)
      byProgram.set(curriculum.program_id, list)
    }
    for (const list of byProgram.values()) {
      list.sort((left, right) =>
        right.effective_school_year.localeCompare(left.effective_school_year),
      )
    }
    return byProgram
  }, [curriculaQuery.data])
  const selectableCurricula = useMemo(
    () =>
      Array.from(curriculaByProgramRecency.values()).flatMap((versions) =>
        versions.slice(0, 3),
      ),
    [curriculaByProgramRecency],
  )
  const newestCurriculumIdByProgram = useMemo(
    () =>
      new Map(
        Array.from(curriculaByProgramRecency.entries())
          .filter(
            (entry): entry is [number, [Curriculum, ...Curriculum[]]] =>
              entry[1].length > 0,
          )
          .map(([programId, versions]) => [programId, versions[0].id]),
      ),
    [curriculaByProgramRecency],
  )
  const [step, setStep] = useState<"year" | "review" | "subjects">("year")
  const [yearLevel, setYearLevel] = useState(1)
  const [activeYear, setActiveYear] = useState("1")
  const [view, setView] = useState<"table" | "tiles">(initialView)
  const [counts, setCounts] = useState<Record<number, number | "">>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  })
  // Seat capacity applied to every block generated for a year level. 40
  // matches the column default, so an untouched year keeps today's size.
  const [studentsPerBlock, setStudentsPerBlock] = useState<
    Record<number, number | "">
  >({ 1: 40, 2: 40, 3: 40, 4: 40 })
  const [curriculumIds, setCurriculumIds] = useState<
    Record<number, number | null>
  >({ 1: null, 2: null, 3: null, 4: null })
  const [editingSection, setEditingSection] = useState<number | null>(null)
  const [scheduleDraft, setScheduleDraft] = useState({
    professor_id: "",
    day: "",
    start: "",
    end: "",
    room: "",
    modality: "f2f",
    capacity: 40,
    override_reason: "",
  })
  const [scheduleError, setScheduleError] = useState("")
  const [calendarSection, setCalendarSection] = useState<{
    blockCode: string
    year: number
    sections: Section[]
  } | null>(null)
  const [roomPickerOpen, setRoomPickerOpen] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [error, setError] = useState("")
  const [forecastOpen, setForecastOpen] = useState(false)
  const [isSwitchingCurriculum, setIsSwitchingCurriculum] = useState(false)
  const termId = currentTerm?.id ?? 0
  const latestGenerationRunQuery = useLatestScheduleGenerationRunQuery(termId)
  const generationRun = latestGenerationRunQuery.data ?? null
  const generationMutation = useMutation({
    mutationFn: () => startScheduleGeneration(termId),
    onSuccess: (run) => {
      queryClient.setQueryData(
        latestScheduleGenerationRunQueryKey(session?.userId ?? null, termId),
        run,
      )
      setForecastOpen(true)
      void queryClient.invalidateQueries({
        queryKey: sectionsQueryKey(session?.userId ?? null),
        exact: true,
      })
      void queryClient.invalidateQueries({
        queryKey: ["section-plans", session?.userId ?? null, termId],
      })
    },
    onError: () =>
      setError(
        "The predictive schedule could not be started. Please try again.",
      ),
  })
  useEffect(() => {
    if (
      generationRun?.status !== "queued" &&
      generationRun?.status !== "running"
    )
      return
    const poll = window.setTimeout(() => {
      void getScheduleGenerationRun(generationRun.id)
        .then((run) => {
          queryClient.setQueryData(
            latestScheduleGenerationRunQueryKey(
              session?.userId ?? null,
              termId,
            ),
            run,
          )
          if (run.status !== "queued" && run.status !== "running") {
            void queryClient.invalidateQueries({
              queryKey: sectionsQueryKey(session?.userId ?? null),
              exact: true,
            })
            void queryClient.invalidateQueries({
              queryKey: ["section-plans", session?.userId ?? null, termId],
            })
          }
        })
        .catch(() => undefined)
    }, 1_500)
    return () => window.clearTimeout(poll)
  }, [generationRun, queryClient, session?.userId, termId])
  const currentProposal = (proposalsQuery.data ?? []).find(
    (proposal) => proposal.academic_term_id === termId,
  )
  const returnedProposal = currentProposal?.is_returned
    ? currentProposal
    : undefined
  const approvalLocked = submitted || currentProposal?.is_submitted === true
  const plansQuery = useSectionPlansQuery(termId, currentTerm !== null)
  const planMutations = useSectionPlanMutations(termId)
  const visibleSections = (sectionsQuery.data ?? []).filter(
    (section) =>
      section.academic_term_id === termId &&
      !/^[1-4][A-Z]$/u.test(section.section_code),
  )
  const selected =
    visibleSections.find((section) => section.id === editingSection) ?? null
  const subjects = (curriculaQuery.data ?? []).flatMap(
    (curriculum) => curriculum.subjects,
  )

  useEffect(() => {
    const next = plansQuery.data ?? []
    if (next.length) {
      const restoredPlans = Object.fromEntries(
        years.map((year) => {
          const plan = next.find(
            (item) => item.year_level === year && item.section_count > 0,
          )
          return [year, plan]
        }),
      )
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCounts(
        Object.fromEntries(
          years.map((year) => [year, restoredPlans[year]?.section_count ?? 0]),
        ),
      )

      setStudentsPerBlock(
        Object.fromEntries(
          years.map((year) => [
            year,
            restoredPlans[year]?.students_per_block ?? 40,
          ]),
        ),
      )
      setCurriculumIds(
        Object.fromEntries(
          years.map((year) => [
            year,
            restoredPlans[year]?.curriculum_id ?? null,
          ]),
        ),
      )

      const hasGeneratedSections = (sectionsQuery.data ?? []).some(
        (section) =>
          section.academic_term_id === termId &&
          !/^[1-4][A-Z]$/u.test(section.section_code),
      )
      if (
        hasGeneratedSections &&
        years.every((year) => restoredPlans[year] !== undefined)
      ) {
        setStep("subjects")
      }
    }
  }, [plansQuery.data, sectionsQuery.data, termId])

  const subjectFor = (subjectId: number) =>
    subjects.find((subject) => subject.subject_id === subjectId)
  const unitsFor = (subjectId: number) =>
    subjectFor(subjectId)?.units ??
    subjectsQuery.data?.find((subject) => subject.id === subjectId)?.units ??
    "—"
  const facultyNameFor = (professorId: number | null) =>
    directoryQuery.data?.find((member) => member.id === professorId)?.name
  const calendarItems: SectionScheduleItem[] = useMemo(() => {
    if (!calendarSection) return []
    const currentSections = sectionsQuery.data ?? []
    return calendarSection.sections.map((sec) => {
      const section =
        currentSections.find((candidate) => candidate.id === sec.id) ?? sec
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
  }, [
    calendarSection,
    sectionsQuery.data,
    subjects,
    subjectsQuery.data,
    directoryQuery.data,
  ])
  const capableIds = selected
    ? (preferencesQuery.data ?? [])
        .filter(
          (item) =>
            item.academic_term_id === termId &&
            item.subject_id === selected.subject_id,
        )
        .map((item) => item.professor_id)
    : []
  const availableFaculty =
    selected && capableIds.length
      ? (directoryQuery.data ?? []).filter((member) =>
          capableIds.includes(member.id),
        )
      : (directoryQuery.data ?? [])
  const roomOptions = roomsQuery.data ?? getLocalRoomOptions(session?.college)
  const groupedSections = (() => {
    const selectedYear = Number(activeYear)
    const groups = new Map<string, Section[]>()

    visibleSections
      .filter(
        (section) => sectionYearLevel(section.section_code) === selectedYear,
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
  })()
  const selectedCurriculumForYear = (year: number) =>
    selectableCurricula.find(
      (curriculum) => curriculum.id === curriculumIds[year],
    ) ?? null
  const selectedCurriculumIds = [
    ...new Set(
      Object.values(curriculumIds).filter((id): id is number => id !== null),
    ),
  ]
  const allYearsHaveCurriculum = years.every(
    (year) => curriculumIds[year] !== null,
  )
  // Incomplete schedule details remain visible to reviewers, but they do
  // not block the Program Chair from submitting a proposal for approval.
  const incompleteScheduleCount = visibleSections.filter(
    (section) =>
      !section.schedule_days ||
      !section.starts_at_time ||
      !section.ends_at_time ||
      !section.room ||
      !section.modality,
  ).length
  const hasInvalidTimeOrder =
    scheduleDraft.start !== "" &&
    scheduleDraft.end !== "" &&
    scheduleDraft.end <= scheduleDraft.start

  if (
    !termsQuery.isPending &&
    !curriculaQuery.isPending &&
    currentTerm === null
  ) {
    return (
      <WorkspacePage
        title="Enrollment"
        description="Program Chair enrollment opens after the Registrar creates the next school year and semester."
      >
        <Alert>
          <AlertDescription>
            Waiting for Registrar for the school year and semester.
          </AlertDescription>
        </Alert>
      </WorkspacePage>
    )
  }

  const saveSelections = async (nextCounts: Record<number, number | "">) => {
    for (const selectedCurriculumId of selectedCurriculumIds) {
      await planMutations.save.mutateAsync({
        academic_term_id: termId,
        curriculum_id: selectedCurriculumId,
        counts: Object.fromEntries(
          years.map((year) => [
            String(year),
            curriculumIds[year] === selectedCurriculumId
              ? toNumber(nextCounts[year])
              : 0,
          ]),
        ),
        students_per_block: Object.fromEntries(
          years.map((year) => [
            String(year),
            Math.max(1, toNumber(studentsPerBlock[year], 40)),
          ]),
        ),
      })
    }
  }
  const saveCurrentCount = async () => {
    if (curriculumIds[yearLevel] === null)
      throw new Error("curriculum-required")
    const next = {
      ...counts,
      [yearLevel]: Math.max(0, toNumber(counts[yearLevel])),
    }
    setCounts(next)
    await saveSelections(next)
  }
  const continueYear = async () => {
    setError("")
    try {
      await saveCurrentCount()
      if (yearLevel < 4) setYearLevel(yearLevel + 1)
      else setStep("review")
    } catch {
      setError(
        "Choose a curriculum, then save the section count for this year level.",
      )
    }
  }
  const releaseSubjects = async () => {
    setError("")
    try {
      if (!allYearsHaveCurriculum) throw new Error("curriculum-required")
      for (const selectedCurriculumId of selectedCurriculumIds)
        await planMutations.release.mutateAsync({
          curriculumId: selectedCurriculumId,
        })
      await sectionsQuery.refetch()
      setActiveYear("1")
      setStep("subjects")
    } catch {
      setError(
        "Choose a curriculum and complete the section count for all four year levels before generating subjects.",
      )
    }
  }
  const addSection = async () => {
    const year = Number(activeYear)
    const nextCounts = { ...counts, [year]: toNumber(counts[year]) + 1 }
    const selectedCurriculumId = curriculumIds[year]

    setError("")
    try {
      if (selectedCurriculumId === null) throw new Error("curriculum-required")
      await saveSelections(nextCounts)
      await planMutations.release.mutateAsync({
        curriculumId: selectedCurriculumId,
        yearLevel: year,
      })
      setCounts(nextCounts)
      await sectionsQuery.refetch()
    } catch {
      setError(
        `The ${yearLabel(year)} section could not be added. Please check the saved year-level plan and retry.`,
      )
    }
  }
  const removeSection = async () => {
    const year = Number(activeYear)
    const selectedCurriculumId = curriculumIds[year]
    const nextCounts = {
      ...counts,
      [year]: Math.max(0, toNumber(counts[year]) - 1),
    }

    setError("")
    try {
      if (selectedCurriculumId === null) throw new Error("curriculum-required")
      await saveSelections(nextCounts)
      await planMutations.release.mutateAsync({
        curriculumId: selectedCurriculumId,
        yearLevel: year,
      })
      setCounts(nextCounts)
      await sectionsQuery.refetch()
    } catch (caughtError) {
      setError(scheduleErrorMessage(caughtError))
    }
  }
  const generateSubjectsForYear = async (year: number) => {
    const selectedCurriculumId = curriculumIds[year]

    setError("")
    try {
      if (selectedCurriculumId === null) throw new Error("curriculum-required")
      await saveSelections(counts)
      await planMutations.release.mutateAsync({
        curriculumId: selectedCurriculumId,
        yearLevel: year,
      })
      await planMutations.autoAssign.mutateAsync({
        curriculumId: selectedCurriculumId,
        yearLevel: year,
      })
      await sectionsQuery.refetch()
    } catch {
      setError(
        `Subjects for ${yearLabel(year)} could not be generated. Check the selected curriculum and saved section count.`,
      )
    }
  }
  const handleCurriculumChange = async (year: number, newCurriculumId: number) => {
    if (curriculumIds[year] === newCurriculumId) return
    setIsSwitchingCurriculum(true)
    setError("")

    try {
      const nextCurriculumIds = {
        ...curriculumIds,
        [year]: newCurriculumId,
      }
      setCurriculumIds(nextCurriculumIds)

      const currentCount = Math.max(1, toNumber(counts[year], 1))
      const currentCapacity = Math.max(1, toNumber(studentsPerBlock[year], 40))

      await planMutations.save.mutateAsync({
        academic_term_id: termId,
        curriculum_id: newCurriculumId,
        counts: {
          [String(year)]: currentCount,
        },
        students_per_block: {
          [String(year)]: currentCapacity,
        },
      })

      await planMutations.release.mutateAsync({
        curriculumId: newCurriculumId,
        yearLevel: year,
      })

      await planMutations.autoAssign.mutateAsync({
        curriculumId: newCurriculumId,
        yearLevel: year,
      })

      await sectionsQuery.refetch()
      await plansQuery.refetch()
    } catch (caughtError) {
      setError(
        `Failed to update curriculum and auto-populate schedule for ${yearLabel(year)}. ${scheduleErrorMessage(caughtError)}`,
      )
    } finally {
      setIsSwitchingCurriculum(false)
    }
  }
  const openEdit = (section: Section) => {
    setScheduleError("")
    setEditingSection(section.id)
    setScheduleDraft({
      professor_id: section.professor_id ? String(section.professor_id) : "",
      day: section.schedule_days ?? "",
      start: section.starts_at_time?.slice(0, 5) ?? "",
      end: section.ends_at_time?.slice(0, 5) ?? "",
      room: section.room ?? "",
      modality: section.modality ?? "f2f",
      capacity: section.capacity,
      override_reason: section.manual_override_reason ?? "",
    })
  }
  const applyPickedSchedule = (result: RoomScheduleAssignmentResult) => {
    setScheduleDraft((current) => ({
      ...current,
      room: result.room,
      day: result.scheduleDays,
      start: result.startsAtTime,
      end: result.endsAtTime,
      modality: result.modality,
    }))
  }
  const saveSchedule = async () => {
    if (!selected) return

    setError("")
    setScheduleError("")
    if (hasInvalidTimeOrder) return
    if (scheduleDraft.capacity < selected.enrolled_count) return

    const input: SectionInput = {
      academic_term_id: selected.academic_term_id,
      subject_id: selected.subject_id,
      section_code: selected.section_code,
      professor_id: scheduleDraft.professor_id
        ? Number(scheduleDraft.professor_id)
        : null,
      schedule_days: scheduleDraft.day || null,
      starts_at_time: timeWithSeconds(scheduleDraft.start),
      ends_at_time: timeWithSeconds(scheduleDraft.end),
      room: scheduleDraft.room || null,
      modality: scheduleDraft.modality as SectionInput["modality"],
      capacity: Math.max(1, scheduleDraft.capacity),
      viability_threshold: selected.viability_threshold,
      status: selected.status,
      override_reason: scheduleDraft.override_reason.trim() || null,
    }

    try {
      await replaceSection(selected.id, input)
      setEditingSection(null)
      void queryClient.invalidateQueries({
        queryKey: sectionsQueryKey(session?.userId ?? null),
        exact: true,
      })
    } catch (caughtError) {
      setScheduleError(scheduleErrorMessage(caughtError))
    }
  }
  const submit = async () => {
    setError("")
    setSubmitError("")
    try {
      for (const selectedCurriculumId of selectedCurriculumIds)
        await planMutations.submit.mutateAsync(selectedCurriculumId)
      await queryClient.invalidateQueries({
        queryKey: scheduleProposalsQueryKey(session?.userId ?? null),
        exact: true,
      })
      setConfirmSubmit(false)
      setSubmitted(true)
    } catch (caughtError) {
      setConfirmSubmit(false)
      setSubmitError(scheduleErrorMessage(caughtError))
    }
  }

  return (
    <WorkspacePage
      title={workspaceTitle}
      description={workspaceDescription}
      lastUpdated={sectionsQuery.dataUpdatedAt}
    >
      {(error || termsQuery.isError || curriculaQuery.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {error || "Enrollment reference data could not be loaded."}
          </AlertDescription>
        </Alert>
      )}
      {returnedProposal?.decision_reason && (
        <Alert variant="destructive">
          <UndoDot className="size-4" aria-hidden="true" />
          <AlertDescription className="grid gap-1">
            <p className="font-medium">Returned for correction</p>
            <p>{returnedProposal.decision_reason}</p>
            <p className="text-sm">
              Sent back by{" "}
              {returnedProposal.decided_by_name ?? "the assigned reviewer"}. Fix
              the flagged schedules below, then resubmit.
            </p>
          </AlertDescription>
        </Alert>
      )}
      <ApprovalStatusCard proposal={currentProposal} submitted={submitted} />
      {approvalLocked && (
        <Card>
          <CardHeader>
            <CardTitle>Still need to fix a room or professor?</CardTitle>
            <CardDescription>
              Room and professor assignments stay editable in Schedule while
              this schedule waits for Dean and Executive Director review —
              only a published section locks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/portal/schedule">
                Open Schedule
                <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {!approvalLocked && (
        <Card>
          <CardHeader>
            <CardTitle>Predictive schedule planning</CardTitle>
            <CardDescription>
              {currentTerm
                ? `${formatAcademicTerm(currentTerm)} · Generate advisory section demand first, then review and edit the resulting draft.`
                : "Loading current term…"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="grid gap-1">
                <p className="font-medium">Section Demand Forecasting</p>
                <p className="text-sm text-muted-foreground">
                  Uses aggregate historical enrollment, curriculum placement,
                  ranked faculty subject preferences, and declared availability
                  as planning inputs. Recommendations remain editable.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <motion.span layoutId="demand-forecast-surface">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForecastOpen(true)}
                    disabled={termId === 0}
                  >
                    Demand Forecast
                  </Button>
                </motion.span>
                <Button
                  type="button"
                  onClick={() => void generationMutation.mutateAsync()}
                  disabled={termId === 0 || generationMutation.isPending}
                >
                  {generationMutation.isPending
                    ? "Generating schedule…"
                    : "Generate Schedule"}
                </Button>
              </div>
            </div>
            {generationRun && (
              <Alert>
                <AlertDescription>
                  {generationRun.status === "queued" ||
                  generationRun.status === "running"
                    ? "Your predictive schedule is being generated. You can continue reviewing the current editable draft."
                    : generationRun.status === "failed"
                      ? (generationRun.error_summary ??
                        "The forecast could not be generated.")
                      : `Demand forecast complete${generationRun.warnings.length ? ` with ${generationRun.warnings.length} warning(s)` : ""}. Review and edit sections before approval.`}
                </AlertDescription>
              </Alert>
            )}
            {step !== "subjects" && (
              <div
                className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"
                aria-label="Enrollment planning progress"
              >
                {[
                  "1st Year",
                  "2nd Year",
                  "3rd Year",
                  "4th Year",
                  "Review",
                  "Approval",
                ].map((label, index) => (
                  <Button
                    key={label}
                    type="button"
                    variant={
                      index < 4
                        ? step === "year" && index === yearLevel - 1
                          ? "destructive"
                          : "outline"
                        : step === "review" && index === 4
                          ? "default"
                          : "outline"
                    }
                    disabled={index > 3 && step === "year"}
                    onClick={() =>
                      index < 4
                        ? (setYearLevel(index + 1), setStep("year"))
                        : index === 4
                          ? setStep("review")
                          : undefined
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            )}

            {step === "year" && (
              <Card>
                <CardHeader>
                  <CardTitle>{yearLabel(yearLevel)} sections</CardTitle>
                  <CardDescription>
                    Choose the curriculum version first, then enter the number
                    of block sections for this year level.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <FieldGroup className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={`curriculum-${yearLevel}`}>
                        Curriculum for {yearLabel(yearLevel)}
                      </FieldLabel>
                      <Select
                        value={
                          curriculumIds[yearLevel]
                            ? String(curriculumIds[yearLevel])
                            : ""
                        }
                        onValueChange={(value) =>
                          setCurriculumIds({
                            ...curriculumIds,
                            [yearLevel]: Number(value),
                          })
                        }
                      >
                        <SelectTrigger id={`curriculum-${yearLevel}`}>
                          <SelectValue placeholder="Choose curriculum" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {selectableCurricula.map((curriculum) => (
                              <SelectItem
                                key={curriculum.id}
                                value={String(curriculum.id)}
                              >
                                {curriculum.name} ·{" "}
                                {curriculum.effective_school_year} ·{" "}
                                {curriculumAgeLabel(
                                  curriculum,
                                  newestCurriculumIdByProgram,
                                )}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      {selectedCurriculumForYear(yearLevel) && (
                        <FieldDescription>
                          Effectivity:{" "}
                          {
                            selectedCurriculumForYear(yearLevel)
                              ?.effective_school_year
                          }{" "}
                          <Badge variant="secondary">
                            {curriculumAgeLabel(
                              selectedCurriculumForYear(yearLevel),
                              newestCurriculumIdByProgram,
                            )}
                          </Badge>
                        </FieldDescription>
                      )}
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="section-count">
                        Number of block sections
                      </FieldLabel>
                      <Input
                        id="section-count"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={counts[yearLevel]}
                        onChange={(event) => {
                          const digits = event.target.value.replace(/\D/gu, "")
                          setCounts({
                            ...counts,
                            [yearLevel]:
                              digits === "" ? "" : Math.min(99, Number(digits)),
                          })
                        }}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="students-per-block">
                        Students per block
                      </FieldLabel>
                      <Input
                        id="students-per-block"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={studentsPerBlock[yearLevel]}
                        onChange={(event) => {
                          const digits = event.target.value.replace(/\D/gu, "")
                          setStudentsPerBlock({
                            ...studentsPerBlock,
                            [yearLevel]:
                              digits === ""
                                ? ""
                                : Math.min(300, Number(digits)),
                          })
                        }}
                      />
                      <FieldDescription>
                        Seats in every block generated for{" "}
                        {yearLabel(yearLevel)}. You can change a single section
                        later when you assign its schedule.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                  <div>
                    <Button
                      type="button"
                      onClick={() => void continueYear()}
                      disabled={
                        curriculumIds[yearLevel] === null ||
                        planMutations.save.isPending
                      }
                    >
                      {yearLevel === 4
                        ? "Continue to review"
                        : "Save and continue"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === "review" && (
              <Card>
                <CardHeader>
                  <CardTitle>Review block sections</CardTitle>
                  <CardDescription>
                    Confirm each year level before releasing the
                    current-semester subject lists.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {years.map((year) => (
                    <div
                      key={year}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    >
                      <div className="grid gap-1">
                        <span className="font-medium">{yearLabel(year)}</span>
                        <span className="text-sm text-muted-foreground">
                          {selectedCurriculumForYear(year)
                            ? `${selectedCurriculumForYear(year)?.name} · ${selectedCurriculumForYear(year)?.effective_school_year}`
                            : "Curriculum not selected"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {toNumber(counts[year])} blocks
                        </Badge>
                        {selectedCurriculumForYear(year) && (
                          <Badge variant="outline">
                            {curriculumAgeLabel(
                              selectedCurriculumForYear(year),
                              newestCurriculumIdByProgram,
                            )}
                          </Badge>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setYearLevel(year)
                            setStep("year")
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void releaseSubjects()}
                      disabled={planMutations.release.isPending}
                    >
                      Generate subject list
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === "subjects" && (
              <Tabs value={activeYear} onValueChange={setActiveYear}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TabsList
                    aria-label="Generated section year filter"
                    className="h-auto w-full p-1 sm:w-fit group-data-horizontal/tabs:h-auto"
                  >
                    {years.map((year) => {
                      const cur = selectedCurriculumForYear(year)
                      return (
                        <TabsTrigger
                          key={year}
                          value={String(year)}
                          aria-label={yearLabel(year)}
                          className="flex flex-col items-center justify-center gap-0.5 px-3.5 py-1.5 h-auto text-xs sm:text-sm data-active:shadow-sm"
                        >
                          <span className="font-semibold leading-tight">{yearLabel(year)}</span>
                          {cur && (
                            <span className="text-[10px] font-medium opacity-80 leading-tight" aria-hidden="true">
                              {cur.effective_school_year}
                            </span>
                          )}
                        </TabsTrigger>
                      )
                    })}
                  </TabsList>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void removeSection()}
                      disabled={
                        approvalLocked ||
                        isSwitchingCurriculum ||
                        toNumber(counts[Number(activeYear)]) <= 0 ||
                        planMutations.save.isPending ||
                        planMutations.release.isPending
                      }
                    >
                      <MinusIcon data-icon="inline-start" />
                      Remove section
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void addSection()}
                      disabled={
                        approvalLocked ||
                        isSwitchingCurriculum ||
                        planMutations.save.isPending ||
                        planMutations.release.isPending
                      }
                    >
                      <PlusIcon data-icon="inline-start" />
                      Add section
                    </Button>
                    <ToggleGroup
                      type="single"
                      value={view}
                      onValueChange={(value) => {
                        if (value === "table" || value === "tiles")
                          setView(value)
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
                </div>

                <div className="my-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-foreground whitespace-nowrap">
                      Curriculum for {yearLabel(Number(activeYear))}:
                    </span>
                    <Select
                      value={
                        curriculumIds[Number(activeYear)]
                          ? String(curriculumIds[Number(activeYear)])
                          : ""
                      }
                      onValueChange={(value) =>
                        void handleCurriculumChange(
                          Number(activeYear),
                          Number(value),
                        )
                      }
                      disabled={approvalLocked || isSwitchingCurriculum}
                    >
                      <SelectTrigger
                        id={`active-curriculum-${activeYear}`}
                        aria-label={`Curriculum for ${yearLabel(Number(activeYear))}`}
                        className="h-9 w-full sm:w-[380px] bg-background text-left truncate"
                      >
                        <SelectValue placeholder="Choose curriculum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {selectableCurricula.map((curriculum) => (
                            <SelectItem
                              key={curriculum.id}
                              value={String(curriculum.id)}
                            >
                              {curriculum.name} ({curriculumAgeLabel(
                                curriculum,
                                newestCurriculumIdByProgram,
                              )})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {selectedCurriculumForYear(Number(activeYear)) && (
                      <Badge variant="secondary" className="font-normal text-xs whitespace-nowrap">
                        Effectivity:{" "}
                        {
                          selectedCurriculumForYear(Number(activeYear))
                            ?.effective_school_year
                        }{" "}
                        (
                        {curriculumAgeLabel(
                          selectedCurriculumForYear(Number(activeYear)),
                          newestCurriculumIdByProgram,
                        )}
                        )
                      </Badge>
                    )}
                  </div>
                  {isSwitchingCurriculum && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                      <span>Applying curriculum & auto-populating schedule and faculty…</span>
                    </div>
                  )}
                </div>

                {years.map((year) => (
                  <TabsContent key={year} value={String(year)} className="mt-0">
                    {groupedSections.length === 0 ? (
                      <Alert>
                        <AlertDescription>
                          No generated subject blocks for {yearLabel(year)} yet.
                          Planned blocks: {toNumber(counts[year])}.
                        </AlertDescription>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void generateSubjectsForYear(year)}
                          disabled={
                            curriculumIds[year] === null ||
                            planMutations.save.isPending ||
                            planMutations.release.isPending
                          }
                        >
                          Generate subjects for {yearLabel(year)}
                        </Button>
                      </Alert>
                    ) : (
                      <div className="grid gap-4">
                        {groupedSections.map(({ blockCode, sections }) => (
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
                              {view === "table" && (
                                <div className="program-chair-schedule-cards">
                                  {sections.map((section) => (
                                    <MobileScheduleCard
                                      key={section.id}
                                      section={section}
                                      code={
                                        subjectFor(section.subject_id)?.code ??
                                        `Subject #${section.subject_id}`
                                      }
                                      title={
                                        subjectFor(section.subject_id)?.title ??
                                        "Subject"
                                      }
                                      units={unitsFor(section.subject_id)}
                                      facultyName={facultyNameFor(
                                        section.professor_id,
                                      )}
                                      approvalLocked={approvalLocked}
                                      onAssign={openEdit}
                                    />
                                  ))}
                                </div>
                              )}
                              {view === "table" ? (
                                <Table className="program-chair-schedule-table">
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
                                    {sections.map((section) => (
                                      <TableRow key={section.id}>
                                        <TableCell className="font-medium">
                                          {subjectFor(section.subject_id)
                                            ?.code ??
                                            `Subject #${section.subject_id}`}
                                        </TableCell>
                                        <TableCell>
                                          {subjectFor(section.subject_id)
                                            ?.title ?? "Subject"}
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
                                          {facultyNameFor(
                                            section.professor_id,
                                          ) ?? "—"}
                                        </TableCell>
                                        <TableCell>
                                          {section.modality
                                            ? modalityLabels[section.modality]
                                            : "—"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={approvalLocked}
                                            onClick={() => openEdit(section)}
                                          >
                                            <CalendarClockIcon data-icon="inline-start" />
                                            Assign schedule
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
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
                                          {scheduleSummary(
                                            section,
                                            facultyNameFor(
                                              section.professor_id,
                                            ),
                                          )}
                                        </p>
                                        <Badge variant="secondary">
                                          {section.modality
                                            ? modalityLabels[section.modality]
                                            : "Modality not set"}
                                        </Badge>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          disabled={approvalLocked}
                                          onClick={() => openEdit(section)}
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
                <div className="grid gap-3">
                  {incompleteScheduleCount > 0 && (
                    <Alert>
                      <AlertDescription>
                        {`${incompleteScheduleCount} schedule assignment${incompleteScheduleCount === 1 ? "" : "s"} remaining will be included for Dean and Executive Director review.`}
                      </AlertDescription>
                    </Alert>
                  )}
                  {submitError && (
                    <Alert variant="destructive">
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex flex-wrap justify-end gap-2">
                    {!approvalLocked && (
                      <Button
                        type="button"
                        onClick={() => {
                          setSubmitError("")
                          setConfirmSubmit(true)
                        }}
                        disabled={
                          visibleSections.length === 0 ||
                          planMutations.submit.isPending
                        }
                      >
                        Submit for Dean and Executive Director Approval
                      </Button>
                    )}
                  </div>
                </div>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}

      <DemandForecastDialog
        open={forecastOpen}
        onOpenChange={setForecastOpen}
        run={generationRun}
        loading={latestGenerationRunQuery.isPending}
        error={latestGenerationRunQuery.isError}
        onRetry={() => void latestGenerationRunQuery.refetch()}
        sections={visibleSections}
        plans={plansQuery.data ?? []}
        subjects={subjectsQuery.data ?? []}
      />

      <Dialog
        open={editingSection !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSection(null)
            setScheduleError("")
          }
        }}
      >
        <DialogContent className="max-h-[100dvh] overflow-y-auto rounded-none sm:max-h-[90dvh] sm:max-w-3xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>
              Schedule assignment · {selected?.section_code ?? "Block"}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `${subjectFor(selected.subject_id)?.code ?? "Subject"} · Sched ID ${selected.id}`
                : "Choose faculty and meeting details for this subject."}
            </DialogDescription>
          </DialogHeader>
          {selected && (
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
                  value={scheduleDraft.professor_id}
                  onValueChange={(value) =>
                    setScheduleDraft({ ...scheduleDraft, professor_id: value })
                  }
                  placeholder="Search professor"
                  emptyMessage="No matching professor."
                />
              </Field>

              {scheduleDraft.room ? (
                <>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRoomPickerOpen(true)}
                      className="w-full"
                    >
                      <CalendarDays data-icon="inline-start" aria-hidden="true" />
                      Change room & schedule on the room calendar
                    </Button>
                  </div>
                  <Field>
                    <FieldLabel htmlFor="schedule-day">Day</FieldLabel>
                    <Select
                      value={scheduleDraft.day}
                      onOpenChange={(open) => {
                        if (open) {
                          setScheduleError("")
                        }
                      }}
                      onValueChange={(value) =>
                        setScheduleDraft({ ...scheduleDraft, day: value })
                      }
                    >
                      <SelectTrigger id="schedule-day">
                        <SelectValue placeholder="Select day" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {dayOptionsList.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                          {scheduleDraft.day &&
                            !dayOptionsList.some(
                              (opt) =>
                                opt.value.toLowerCase() ===
                                scheduleDraft.day.toLowerCase(),
                            ) && (
                              <SelectItem
                                key={scheduleDraft.day}
                                value={scheduleDraft.day}
                              >
                                {scheduleDraft.day}
                              </SelectItem>
                            )}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field data-invalid={hasInvalidTimeOrder}>
                    <FieldLabel htmlFor="schedule-start">Start time</FieldLabel>
                    <Input
                      id="schedule-start"
                      type="time"
                      value={scheduleDraft.start}
                      aria-invalid={hasInvalidTimeOrder}
                      onChange={(event) =>
                        setScheduleDraft({
                          ...scheduleDraft,
                          start: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field data-invalid={hasInvalidTimeOrder}>
                    <FieldLabel htmlFor="schedule-end">End time</FieldLabel>
                    <Input
                      id="schedule-end"
                      type="time"
                      value={scheduleDraft.end}
                      aria-invalid={hasInvalidTimeOrder}
                      onChange={(event) =>
                        setScheduleDraft({
                          ...scheduleDraft,
                          end: event.target.value,
                        })
                      }
                    />
                    {hasInvalidTimeOrder && (
                      <FieldError>End time must be after start time.</FieldError>
                    )}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="schedule-room">Room</FieldLabel>
                    <SearchableCombobox
                      id="schedule-room"
                      label="Room"
                      options={roomOptions.map((room) => ({
                        value: room.name,
                        label: room.name,
                      }))}
                      value={scheduleDraft.room}
                      onValueChange={(value) =>
                        setScheduleDraft({ ...scheduleDraft, room: value })
                      }
                      placeholder="Search room"
                      emptyMessage="No matching room."
                      disabled={roomsQuery.isPending && roomOptions.length === 0}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="schedule-modality">Modality</FieldLabel>
                    <Select
                      value={scheduleDraft.modality}
                      onValueChange={(value) =>
                        setScheduleDraft({ ...scheduleDraft, modality: value })
                      }
                    >
                      <SelectTrigger id="schedule-modality">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {Object.entries(modalityLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              ) : (
                <div className="sm:col-span-2 rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center">
                  <p className="text-sm font-medium mb-1">Room & Schedule</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Select a room to view its weekly calendar and assign a conflict-free schedule slot.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setRoomPickerOpen(true)}
                    className="w-full sm:w-auto"
                  >
                    <CalendarDays data-icon="inline-start" aria-hidden="true" />
                    Select a room
                  </Button>
                </div>
              )}

              <Field
                data-invalid={scheduleDraft.capacity < selected.enrolled_count}
              >
                <FieldLabel htmlFor="schedule-capacity">
                  Seats in this section
                </FieldLabel>
                <Input
                  id="schedule-capacity"
                  type="number"
                  min={Math.max(1, selected.enrolled_count)}
                  max={300}
                  value={scheduleDraft.capacity}
                  aria-invalid={
                    scheduleDraft.capacity < selected.enrolled_count
                  }
                  onChange={(event) =>
                    setScheduleDraft({
                      ...scheduleDraft,
                      capacity: Number(event.target.value),
                    })
                  }
                />
                {scheduleDraft.capacity < selected.enrolled_count ? (
                  <FieldError>
                    {selected.enrolled_count} students are already enrolled
                    here. Set at least {selected.enrolled_count} seats.
                  </FieldError>
                ) : (
                  <FieldDescription>
                    Changing this overrides the year-level default for this
                    section only.
                  </FieldDescription>
                )}
              </Field>
              {selected.recommendation_prediction_run_id !== null && (
                <Field className="sm:col-span-2">
                  <FieldLabel htmlFor="schedule-override-reason">
                    Override reason
                  </FieldLabel>
                  <Textarea
                    id="schedule-override-reason"
                    value={scheduleDraft.override_reason}
                    onChange={(event) =>
                      setScheduleDraft({
                        ...scheduleDraft,
                        override_reason: event.target.value,
                      })
                    }
                    placeholder="Required when changing this AI-generated recommendation."
                  />
                  <FieldDescription>
                    The original recommendation remains in the audit trail.
                  </FieldDescription>
                </Field>
              )}
            </FieldGroup>
          )}
          {scheduleError && (
            <Alert variant="destructive">
              <AlertDescription>{scheduleError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingSection(null)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveSchedule()}>
              Save schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Submit this schedule for approval?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Your section plans and faculty schedules will go to the Dean
              review queue, then the Executive Director checkpoint.
              {incompleteScheduleCount > 0
                ? ` ${incompleteScheduleCount} incomplete schedule assignment${incompleteScheduleCount === 1 ? "" : "s"} will remain visible for review.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={planMutations.submit.isPending}
            >
              {planMutations.submit.isPending
                ? "Submitting…"
                : "Confirm submission"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SectionScheduleCalendarDialog
        open={calendarSection !== null}
        onOpenChange={(open) => !open && setCalendarSection(null)}
        title={`${calendarSection?.blockCode ?? "Section"} Schedule`}
        subtitle={`${yearLabel(calendarSection?.year ?? 1)} Block Section · ${calendarItems.length} subjects`}
        items={calendarItems}
        disabled={approvalLocked}
        onSelectSubject={(item) => {
          const targetSection =
            (sectionsQuery.data ?? []).find((s) => s.id === item.id) ??
            calendarSection?.sections.find((s) => s.id === item.id)
          if (targetSection) {
            openEdit(targetSection)
          }
        }}
      />

      <RoomScheduleAssignmentDialog
        open={roomPickerOpen}
        onOpenChange={setRoomPickerOpen}
        termId={termId}
        initialRoom={scheduleDraft.room || null}
        excludeSectionId={selected?.id}
        onConfirm={applyPickedSchedule}
      />
    </WorkspacePage>
  )
}
