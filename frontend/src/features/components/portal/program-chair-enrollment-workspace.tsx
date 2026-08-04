"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClockIcon, LayoutGridIcon, ListIcon, MinusIcon, PlusIcon, UndoDot } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/features/components/ui/alert-dialog"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/features/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/features/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/features/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/features/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/features/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/features/components/ui/toggle-group"
import { useFacultyDirectoryQuery } from "@/features/hooks/use-faculty-directory"
import { useFacultySubjectPreferencesQuery } from "@/features/hooks/use-faculty-input"
import { useAcademicTermsQuery, useCurriculaQuery, useSectionsQuery, useSubjectsQuery, sectionsQueryKey } from "@/features/hooks/use-reference-data"
import { useSectionPlanMutations, useSectionPlansQuery } from "@/features/hooks/use-section-plans"
import {
  scheduleProposalsQueryKey,
  useScheduleProposalsQuery,
} from "@/features/hooks/use-scheduling"
import { useRoomOptionsQuery } from "@/features/hooks/use-room-catalog"
import { scheduleProposalPresentation } from "@/features/lib/schedule-status"
import { getLocalRoomOptions } from "@/features/services/room-catalog-service"
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
import type { Section } from "@/features/schemas/reference-data-schema"
import type { SectionInput } from "@/features/schemas/scheduling-schema"
import type { ScheduleProposal } from "@/features/schemas/scheduling-schema"
import { formatAcademicTerm, getActiveAcademicTerm } from "@/features/services/reference-data-service"
import { replaceSection } from "@/features/services/scheduling-service"
import { isApiClientError } from "@/features/services/api-client"

const years = [1, 2, 3, 4] as const
const days = ["M", "T", "W", "Th", "F", "Sat"] as const
const modalityLabels = { online: "Online", hyflex_a: "Hyflex A", hyflex_b: "Hyflex B", f2f: "F2F" } as const

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
  const time = section.starts_at_time && section.ends_at_time
    ? `${section.starts_at_time.slice(0, 5)}–${section.ends_at_time.slice(0, 5)}`
    : "Not set"

  return [section.schedule_days ?? "Day not set", time, section.room ?? "Room not set", facultyName ?? "Professor not set"]
    .join(" · ")
}

function curriculumAgeLabel(effectivity: string, termSchoolYear: string | undefined) {
  const effectiveStart = Number(effectivity.slice(0, 4))
  const termStart = Number(termSchoolYear?.slice(0, 4))

  return Number.isFinite(effectiveStart) && Number.isFinite(termStart) && effectiveStart >= termStart
    ? "New curriculum"
    : "Old curriculum"
}

function approvalPresentation(proposal: ScheduleProposal | undefined, submitted: boolean) {
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

function ApprovalStatusCard({ proposal, submitted }: { proposal: ScheduleProposal | undefined; submitted: boolean }) {
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
              {PresentationIcon && <PresentationIcon className="size-4" aria-hidden="true" />}
              {presentation?.title ?? "Approval history"}
            </CardTitle>
            {presentation && <CardDescription>{presentation.description}</CardDescription>}
          </div>
          {presentation && <Badge variant={presentation.badgeVariant}>{presentation.label}</Badge>}
        </div>
      </CardHeader>
      {history.length > 0 && <CardContent>
        <p className="mb-3 text-sm font-medium">Review activity</p>
        <ol className="grid gap-3" aria-label="Schedule approval history">
          {history.map((decision, index) => {
            const isReturn = decision.action === "dean_return" || decision.action === "executive_return"
            return (
              <li
                key={`${decision.action}-${decision.decided_at}-${index}`}
                className={`grid gap-1 border-l-2 pl-3 ${isReturn ? "border-destructive" : "border-success"}`}
              >
                <p className="font-medium">{decision.action_label}</p>
                <p className="text-sm text-muted-foreground">{decision.actor_name} · {new Date(decision.decided_at).toLocaleString()}</p>
                {decision.notes && (
                  <p className={`rounded-md p-2 text-sm ${isReturn ? "bg-destructive/10" : "bg-muted"}`}>
                    <span className="font-medium">Note:</span> {decision.notes}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>}
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
  const selectableCurricula = useMemo(() => (curriculaQuery.data ?? []).filter((item) => item.status === "active"), [curriculaQuery.data])
  const [step, setStep] = useState<"year" | "review" | "subjects">("year")
  const [yearLevel, setYearLevel] = useState(1)
  const [activeYear, setActiveYear] = useState("1")
  const [view, setView] = useState<"table" | "tiles">(initialView)
  const [counts, setCounts] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 })
  // Seat capacity applied to every block generated for a year level. 40
  // matches the column default, so an untouched year keeps today's size.
  const [studentsPerBlock, setStudentsPerBlock] = useState<Record<number, number>>({ 1: 40, 2: 40, 3: 40, 4: 40 })
  const [curriculumIds, setCurriculumIds] = useState<Record<number, number | null>>({ 1: null, 2: null, 3: null, 4: null })
  const [editingSection, setEditingSection] = useState<number | null>(null)
  const [scheduleDraft, setScheduleDraft] = useState({ professor_id: "", day: "", start: "", end: "", room: "", modality: "f2f", capacity: 40 })
  const [scheduleError, setScheduleError] = useState("")
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [error, setError] = useState("")
  const termId = currentTerm?.id ?? 0
  const currentProposal = (proposalsQuery.data ?? []).find(
    (proposal) =>
      proposal.academic_term_id === termId,
  )
  const returnedProposal = currentProposal?.is_returned ? currentProposal : undefined
  const approvalLocked = submitted || currentProposal?.is_submitted === true
  const plansQuery = useSectionPlansQuery(termId, currentTerm !== null)
  const planMutations = useSectionPlanMutations(termId)
  const visibleSections = (sectionsQuery.data ?? []).filter((section) => section.academic_term_id === termId && !/^[1-4][A-Z]$/u.test(section.section_code))
  const selected = visibleSections.find((section) => section.id === editingSection) ?? null
  const subjects = (curriculaQuery.data ?? []).flatMap((curriculum) => curriculum.subjects)

  useEffect(() => {
    const next = plansQuery.data ?? []
    if (next.length) {
      const restoredPlans = Object.fromEntries(years.map((year) => {
        const plan = next.find((item) => item.year_level === year && item.section_count > 0)
        return [year, plan]
      }))
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCounts(Object.fromEntries(years.map((year) => [year, restoredPlans[year]?.section_count ?? 0])))
       
      setStudentsPerBlock(Object.fromEntries(years.map((year) => [year, restoredPlans[year]?.students_per_block ?? 40])))
      setCurriculumIds(Object.fromEntries(years.map((year) => [year, restoredPlans[year]?.curriculum_id ?? null])))

      const hasGeneratedSections = (sectionsQuery.data ?? []).some(
        (section) =>
          section.academic_term_id === termId &&
          !/^[1-4][A-Z]$/u.test(section.section_code),
      )
      if (hasGeneratedSections && years.every((year) => restoredPlans[year] !== undefined)) {
        setStep("subjects")
      }
    }
  }, [plansQuery.data, sectionsQuery.data, termId])

  const subjectFor = (subjectId: number) => subjects.find((subject) => subject.subject_id === subjectId)
  const unitsFor = (subjectId: number) => subjectFor(subjectId)?.units ?? subjectsQuery.data?.find((subject) => subject.id === subjectId)?.units ?? "—"
  const facultyNameFor = (professorId: number | null) => directoryQuery.data?.find((member) => member.id === professorId)?.name
  const capableIds = selected
    ? (preferencesQuery.data ?? [])
      .filter((item) => item.academic_term_id === termId && item.subject_id === selected.subject_id)
      .map((item) => item.professor_id)
    : []
  const availableFaculty = selected && capableIds.length
    ? (directoryQuery.data ?? []).filter((member) => capableIds.includes(member.id))
    : (directoryQuery.data ?? [])
  const roomOptions = roomsQuery.data ?? getLocalRoomOptions(session?.college)
  const groupedSections = (() => {
    const selectedYear = Number(activeYear)
    const groups = new Map<string, Section[]>()

    visibleSections
      .filter((section) => sectionYearLevel(section.section_code) === selectedYear)
      .sort((left, right) => left.section_code.localeCompare(right.section_code) || left.id - right.id)
      .forEach((section) => groups.set(section.section_code, [...(groups.get(section.section_code) ?? []), section]))

    return [...groups.entries()].map(([blockCode, sections]) => ({ blockCode, sections }))
  })()
  const selectedCurriculumForYear = (year: number) => selectableCurricula.find((curriculum) => curriculum.id === curriculumIds[year]) ?? null
  const selectedCurriculumIds = [...new Set(Object.values(curriculumIds).filter((id): id is number => id !== null))]
  const allYearsHaveCurriculum = years.every((year) => curriculumIds[year] !== null)
  const incompleteScheduleCount = visibleSections.filter((section) =>
    section.professor_id === null
    || !section.schedule_days
    || !section.starts_at_time
    || !section.ends_at_time
    || !section.room
    || !section.modality,
  ).length
  const hasInvalidTimeOrder = scheduleDraft.start !== ""
    && scheduleDraft.end !== ""
    && scheduleDraft.end <= scheduleDraft.start

  if (!termsQuery.isPending && !curriculaQuery.isPending && currentTerm === null) {
    return <WorkspacePage title="Enrollment" description="Program Chair enrollment opens after the Registrar creates the next school year and semester."><Alert><AlertDescription>Waiting for Registrar for the school year and semester.</AlertDescription></Alert></WorkspacePage>
  }

  const saveSelections = async (nextCounts: Record<number, number>) => {
    for (const selectedCurriculumId of selectedCurriculumIds) {
      await planMutations.save.mutateAsync({
        academic_term_id: termId,
        curriculum_id: selectedCurriculumId,
        counts: Object.fromEntries(years.map((year) => [String(year), curriculumIds[year] === selectedCurriculumId ? nextCounts[year] ?? 0 : 0])),
        students_per_block: Object.fromEntries(years.map((year) => [String(year), Math.max(1, studentsPerBlock[year] ?? 40)])),
      })
    }
  }
  const saveCurrentCount = async () => {
    if (curriculumIds[yearLevel] === null) throw new Error("curriculum-required")
    const next = { ...counts, [yearLevel]: Math.max(0, Number(counts[yearLevel] ?? 0)) }
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
      setError("Choose a curriculum, then save the section count for this year level.")
    }
  }
  const releaseSubjects = async () => {
    setError("")
    try {
      if (!allYearsHaveCurriculum) throw new Error("curriculum-required")
      for (const selectedCurriculumId of selectedCurriculumIds) await planMutations.release.mutateAsync({ curriculumId: selectedCurriculumId })
      await sectionsQuery.refetch()
      setActiveYear("1")
      setStep("subjects")
    } catch {
      setError("Choose a curriculum and complete the section count for all four year levels before generating subjects.")
    }
  }
  const addSection = async () => {
    const year = Number(activeYear)
    const nextCounts = { ...counts, [year]: (counts[year] ?? 0) + 1 }
    const selectedCurriculumId = curriculumIds[year]

    setError("")
    try {
      if (selectedCurriculumId === null) throw new Error("curriculum-required")
      await saveSelections(nextCounts)
      await planMutations.release.mutateAsync({ curriculumId: selectedCurriculumId, yearLevel: year })
      setCounts(nextCounts)
      await sectionsQuery.refetch()
    } catch {
      setError(`The ${yearLabel(year)} section could not be added. Please check the saved year-level plan and retry.`)
    }
  }
  const removeSection = async () => {
    const year = Number(activeYear)
    const selectedCurriculumId = curriculumIds[year]
    const nextCounts = { ...counts, [year]: Math.max(0, (counts[year] ?? 0) - 1) }

    setError("")
    try {
      if (selectedCurriculumId === null) throw new Error("curriculum-required")
      await saveSelections(nextCounts)
      await planMutations.release.mutateAsync({ curriculumId: selectedCurriculumId, yearLevel: year })
      setCounts(nextCounts)
      await sectionsQuery.refetch()
    } catch {
      setError(`The last ${yearLabel(year)} section could not be removed. Assigned schedules or enrolled students must be cleared first.`)
    }
  }
  const generateSubjectsForYear = async (year: number) => {
    const selectedCurriculumId = curriculumIds[year]

    setError("")
    try {
      if (selectedCurriculumId === null) throw new Error("curriculum-required")
      await saveSelections(counts)
      await planMutations.release.mutateAsync({ curriculumId: selectedCurriculumId, yearLevel: year })
      await sectionsQuery.refetch()
    } catch {
      setError(`Subjects for ${yearLabel(year)} could not be generated. Check the selected curriculum and saved section count.`)
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
    })
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
      professor_id: scheduleDraft.professor_id ? Number(scheduleDraft.professor_id) : null,
      schedule_days: scheduleDraft.day || null,
      starts_at_time: timeWithSeconds(scheduleDraft.start),
      ends_at_time: timeWithSeconds(scheduleDraft.end),
      room: scheduleDraft.room || null,
      modality: scheduleDraft.modality as SectionInput["modality"],
      capacity: Math.max(1, scheduleDraft.capacity),
      viability_threshold: selected.viability_threshold,
      status: selected.status,
    }

    try {
      await replaceSection(selected.id, input)
      setEditingSection(null)
      void queryClient.invalidateQueries({ queryKey: sectionsQueryKey(session?.userId ?? null), exact: true })
    } catch (caughtError) {
      setScheduleError(scheduleErrorMessage(caughtError))
    }
  }
  const submit = async () => {
    setError("")
    setSubmitError("")
    try {
      for (const selectedCurriculumId of selectedCurriculumIds) await planMutations.submit.mutateAsync(selectedCurriculumId)
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
    <WorkspacePage title={workspaceTitle} description={workspaceDescription} lastUpdated={sectionsQuery.dataUpdatedAt}>
      {(error || termsQuery.isError || curriculaQuery.isError) && <Alert variant="destructive"><AlertDescription>{error || "Enrollment reference data could not be loaded."}</AlertDescription></Alert>}
      {returnedProposal?.decision_reason && <Alert variant="destructive"><UndoDot className="size-4" aria-hidden="true" /><AlertDescription className="grid gap-1"><p className="font-medium">Returned for correction</p><p>{returnedProposal.decision_reason}</p><p className="text-sm">Sent back by {returnedProposal.decided_by_name ?? "the assigned reviewer"}. Fix the flagged schedules below, then resubmit.</p></AlertDescription></Alert>}
      <ApprovalStatusCard proposal={currentProposal} submitted={submitted} />
      <Card>
        <CardHeader>
          <CardTitle>Manual enrollment planning</CardTitle>
          <CardDescription>{currentTerm ? `${formatAcademicTerm(currentTerm)} · Select the curriculum version for each year level.` : "Loading current term…"}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {step !== "subjects" && <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Enrollment planning progress">{["1st Year", "2nd Year", "3rd Year", "4th Year", "Review", "Approval"].map((label, index) => <Button key={label} type="button" variant={(step === "year" && index === yearLevel - 1) || (step === "review" && index === 4) ? "default" : "outline"} disabled={index > 3 && step === "year"} onClick={() => index < 4 ? (setYearLevel(index + 1), setStep("year")) : index === 4 ? setStep("review") : undefined}>{label}</Button>)}</div>}

          {step === "year" && <Card>
            <CardHeader><CardTitle>{yearLabel(yearLevel)} sections</CardTitle><CardDescription>Choose the curriculum version first, then enter the number of block sections for this year level.</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`curriculum-${yearLevel}`}>Curriculum for {yearLabel(yearLevel)}</FieldLabel>
                  <Select value={curriculumIds[yearLevel] ? String(curriculumIds[yearLevel]) : ""} onValueChange={(value) => setCurriculumIds({ ...curriculumIds, [yearLevel]: Number(value) })}>
                    <SelectTrigger id={`curriculum-${yearLevel}`}><SelectValue placeholder="Choose curriculum" /></SelectTrigger>
                    <SelectContent><SelectGroup>{selectableCurricula.map((curriculum) => <SelectItem key={curriculum.id} value={String(curriculum.id)}>{curriculum.name} · {curriculum.effective_school_year} · {curriculumAgeLabel(curriculum.effective_school_year, currentTerm?.school_year)}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                  {selectedCurriculumForYear(yearLevel) && <FieldDescription>Effectivity: {selectedCurriculumForYear(yearLevel)?.effective_school_year} <Badge variant="secondary">{curriculumAgeLabel(selectedCurriculumForYear(yearLevel)?.effective_school_year ?? "", currentTerm?.school_year)}</Badge></FieldDescription>}
                </Field>
                <Field><FieldLabel htmlFor="section-count">Number of block sections</FieldLabel><Input id="section-count" type="number" min={0} max={99} value={counts[yearLevel]} onChange={(event) => setCounts({ ...counts, [yearLevel]: Number(event.target.value) })} /></Field>
                <Field>
                  <FieldLabel htmlFor="students-per-block">Students per block</FieldLabel>
                  <Input id="students-per-block" type="number" min={1} max={300} value={studentsPerBlock[yearLevel]} onChange={(event) => setStudentsPerBlock({ ...studentsPerBlock, [yearLevel]: Number(event.target.value) })} />
                  <FieldDescription>Seats in every block generated for {yearLabel(yearLevel)}. You can change a single section later when you assign its schedule.</FieldDescription>
                </Field>
              </FieldGroup>
              <div><Button type="button" onClick={() => void continueYear()} disabled={curriculumIds[yearLevel] === null || planMutations.save.isPending}>{yearLevel === 4 ? "Continue to review" : "Save and continue"}</Button></div>
            </CardContent>
          </Card>}

          {step === "review" && <Card>
            <CardHeader><CardTitle>Review block sections</CardTitle><CardDescription>Confirm each year level before releasing the current-semester subject lists.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              {years.map((year) => <div key={year} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="grid gap-1"><span className="font-medium">{yearLabel(year)}</span><span className="text-sm text-muted-foreground">{selectedCurriculumForYear(year) ? `${selectedCurriculumForYear(year)?.name} · ${selectedCurriculumForYear(year)?.effective_school_year}` : "Curriculum not selected"}</span></div><div className="flex items-center gap-2"><Badge variant="secondary">{counts[year] ?? 0} blocks</Badge>{selectedCurriculumForYear(year) && <Badge variant="outline">{curriculumAgeLabel(selectedCurriculumForYear(year)?.effective_school_year ?? "", currentTerm?.school_year)}</Badge>}<Button type="button" variant="outline" size="sm" onClick={() => { setYearLevel(year); setStep("year") }}>Edit</Button></div></div>)}
              <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => void releaseSubjects()} disabled={planMutations.release.isPending}>Generate subject list</Button><Button type="button" variant="outline" disabled>AI Generate Sections — Coming later</Button></div>
            </CardContent>
          </Card>}

          {step === "subjects" && <Tabs value={activeYear} onValueChange={setActiveYear}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList aria-label="Generated section year filter" className="w-full sm:w-fit">
                {years.map((year) => <TabsTrigger key={year} value={String(year)}>{yearLabel(year)}</TabsTrigger>)}
              </TabsList>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void removeSection()} disabled={approvalLocked || (counts[Number(activeYear)] ?? 0) <= 0 || planMutations.save.isPending || planMutations.release.isPending}>
                  <MinusIcon data-icon="inline-start" />Remove section
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void addSection()} disabled={approvalLocked || planMutations.save.isPending || planMutations.release.isPending}>
                  <PlusIcon data-icon="inline-start" />Add section
                </Button>
                <ToggleGroup type="single" value={view} onValueChange={(value) => { if (value === "table" || value === "tiles") setView(value) }} variant="outline" size="sm" aria-label="Generated section layout">
                  <ToggleGroupItem value="table" aria-label="Table view"><ListIcon data-icon="inline-start" />Table</ToggleGroupItem>
                  <ToggleGroupItem value="tiles" aria-label="Tile view"><LayoutGridIcon data-icon="inline-start" />Tiles</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {years.map((year) => <TabsContent key={year} value={String(year)} className="mt-0">
              {groupedSections.length === 0 ? <Alert><AlertDescription>No generated subject blocks for {yearLabel(year)} yet. Planned blocks: {counts[year] ?? 0}.</AlertDescription><Button type="button" size="sm" variant="outline" onClick={() => void generateSubjectsForYear(year)} disabled={curriculumIds[year] === null || planMutations.save.isPending || planMutations.release.isPending}>Generate subjects for {yearLabel(year)}</Button></Alert> : <div className="grid gap-4">{groupedSections.map(({ blockCode, sections }) => <Card key={blockCode}>
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {blockCode}
                    {sections.every((section) => section.capacity === sections[0].capacity)
                      ? <Badge variant="secondary">{sections[0].capacity} seats</Badge>
                      : <Badge variant="outline">Mixed seat counts</Badge>}
                  </CardTitle>
                  <CardDescription>{yearLabel(year)} block section · {sections.length} subject{sections.length === 1 ? "" : "s"}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {view === "table" ? <Table>
                    <TableHeader><TableRow><TableHead>Subject code</TableHead><TableHead>Description</TableHead><TableHead>Units</TableHead><TableHead>Sched ID</TableHead><TableHead>Day</TableHead><TableHead>Time</TableHead><TableHead>Room</TableHead><TableHead>Professor</TableHead><TableHead>Modality</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                    <TableBody>{sections.map((section) => <TableRow key={section.id}><TableCell className="font-medium">{subjectFor(section.subject_id)?.code ?? `Subject #${section.subject_id}`}</TableCell><TableCell>{subjectFor(section.subject_id)?.title ?? "Subject"}</TableCell><TableCell>{unitsFor(section.subject_id)}</TableCell><TableCell>{section.id}</TableCell><TableCell>{section.schedule_days ?? "—"}</TableCell><TableCell>{section.starts_at_time && section.ends_at_time ? `${section.starts_at_time.slice(0, 5)}–${section.ends_at_time.slice(0, 5)}` : "—"}</TableCell><TableCell>{section.room ?? "—"}</TableCell><TableCell>{facultyNameFor(section.professor_id) ?? "—"}</TableCell><TableCell>{section.modality ? modalityLabels[section.modality] : "—"}</TableCell><TableCell className="text-right"><Button type="button" size="sm" variant="outline" disabled={approvalLocked} onClick={() => openEdit(section)}><CalendarClockIcon data-icon="inline-start" />Assign schedule</Button></TableCell></TableRow>)}</TableBody>
                  </Table> : <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{sections.map((section) => <Card key={section.id} size="sm"><CardHeader><CardTitle>{subjectFor(section.subject_id)?.code ?? `Subject #${section.subject_id}`}</CardTitle><CardDescription>{subjectFor(section.subject_id)?.title ?? "Subject"} · {unitsFor(section.subject_id)} units</CardDescription></CardHeader><CardContent className="grid gap-3"><p className="text-sm text-muted-foreground">Sched ID {section.id} · {scheduleSummary(section, facultyNameFor(section.professor_id))}</p><Badge variant="secondary">{section.modality ? modalityLabels[section.modality] : "Modality not set"}</Badge><Button type="button" variant="outline" disabled={approvalLocked} onClick={() => openEdit(section)}><CalendarClockIcon data-icon="inline-start" />Assign schedule</Button></CardContent></Card>)}</div>}
                </CardContent>
              </Card>)}</div>}
            </TabsContent>)}
            <div className="grid gap-3">
              {incompleteScheduleCount > 0 && <Alert><AlertDescription>{incompleteScheduleCount} schedule assignment{incompleteScheduleCount === 1 ? "" : "s"} remaining before approval submission.</AlertDescription></Alert>}
              {submitError && <Alert variant="destructive"><AlertDescription>{submitError}</AlertDescription></Alert>}
              <div className="flex flex-wrap justify-end gap-2">{!approvalLocked && <Button type="button" onClick={() => { setSubmitError(""); setConfirmSubmit(true) }} disabled={visibleSections.length === 0 || incompleteScheduleCount > 0 || planMutations.submit.isPending}>Submit for Dean and Executive Director Approval</Button>}<Button type="button" variant="outline" disabled>AI Generate Sections — Coming later</Button></div>
            </div>
          </Tabs>}
        </CardContent>
      </Card>

      <Dialog open={editingSection !== null} onOpenChange={(open) => { if (!open) { setEditingSection(null); setScheduleError("") } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Schedule assignment · {selected?.section_code ?? "Block"}</DialogTitle><DialogDescription>{selected ? `${subjectFor(selected.subject_id)?.code ?? "Subject"} · Sched ID ${selected.id}` : "Choose faculty and meeting details for this subject."}</DialogDescription></DialogHeader>
          {selected && <FieldGroup className="grid gap-3 sm:grid-cols-2">
            <Field><FieldLabel htmlFor="schedule-professor">Professor</FieldLabel><SearchableCombobox id="schedule-professor" label="Professor" options={availableFaculty.map((member) => ({ value: String(member.id), label: member.name }))} value={scheduleDraft.professor_id} onValueChange={(value) => setScheduleDraft({ ...scheduleDraft, professor_id: value })} placeholder="Search professor" emptyMessage="No matching professor." /></Field>
            <Field><FieldLabel htmlFor="schedule-day">Day</FieldLabel><Select value={scheduleDraft.day} onValueChange={(value) => setScheduleDraft({ ...scheduleDraft, day: value })}><SelectTrigger id="schedule-day"><SelectValue placeholder="Select day" /></SelectTrigger><SelectContent><SelectGroup>{days.map((day) => <SelectItem key={day} value={day}>{day}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
            <Field data-invalid={hasInvalidTimeOrder}><FieldLabel htmlFor="schedule-start">Start time</FieldLabel><Input id="schedule-start" type="time" value={scheduleDraft.start} aria-invalid={hasInvalidTimeOrder} onChange={(event) => setScheduleDraft({ ...scheduleDraft, start: event.target.value })} /></Field>
            <Field data-invalid={hasInvalidTimeOrder}><FieldLabel htmlFor="schedule-end">End time</FieldLabel><Input id="schedule-end" type="time" value={scheduleDraft.end} aria-invalid={hasInvalidTimeOrder} onChange={(event) => setScheduleDraft({ ...scheduleDraft, end: event.target.value })} />{hasInvalidTimeOrder && <FieldError>End time must be after start time.</FieldError>}</Field>
            <Field><FieldLabel htmlFor="schedule-room">Room</FieldLabel><SearchableCombobox id="schedule-room" label="Room" options={roomOptions.map((room) => ({ value: room.name, label: room.name }))} value={scheduleDraft.room} onValueChange={(value) => setScheduleDraft({ ...scheduleDraft, room: value })} placeholder="Search room" emptyMessage="No matching room." disabled={roomsQuery.isPending && roomOptions.length === 0} /></Field>
            <Field><FieldLabel htmlFor="schedule-modality">Modality</FieldLabel><Select value={scheduleDraft.modality} onValueChange={(value) => setScheduleDraft({ ...scheduleDraft, modality: value })}><SelectTrigger id="schedule-modality"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{Object.entries(modalityLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
            <Field data-invalid={scheduleDraft.capacity < selected.enrolled_count}>
              <FieldLabel htmlFor="schedule-capacity">Seats in this section</FieldLabel>
              <Input id="schedule-capacity" type="number" min={Math.max(1, selected.enrolled_count)} max={300} value={scheduleDraft.capacity} aria-invalid={scheduleDraft.capacity < selected.enrolled_count} onChange={(event) => setScheduleDraft({ ...scheduleDraft, capacity: Number(event.target.value) })} />
              {scheduleDraft.capacity < selected.enrolled_count
                ? <FieldError>{selected.enrolled_count} students are already enrolled here. Set at least {selected.enrolled_count} seats.</FieldError>
                : <FieldDescription>Changing this overrides the year-level default for this section only.</FieldDescription>}
            </Field>
          </FieldGroup>}
          {scheduleError && <Alert variant="destructive"><AlertDescription>{scheduleError}</AlertDescription></Alert>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setEditingSection(null)}>Cancel</Button><Button type="button" onClick={() => void saveSchedule()}>Save schedule</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Submit this schedule for approval?</AlertDialogTitle><AlertDialogDescription>Your completed section plans and faculty schedules will go to the Dean review queue, then the Executive Director checkpoint.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><Button type="button" onClick={() => void submit()} disabled={planMutations.submit.isPending}>Confirm submission</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </WorkspacePage>
  )
}
