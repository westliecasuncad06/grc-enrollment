"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { CalendarDays, PencilLine } from "lucide-react"
import { useMemo, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AcademicTermSelector } from "@/features/components/portal/academic-term-selector"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspaceField } from "@/features/components/portal/workspace-field"
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
import {
  RoomScheduleAssignmentDialog,
  type RoomScheduleAssignmentResult,
} from "@/features/components/portal/room-schedule-assignment-dialog"
import { useFacultyDirectoryQuery } from "@/features/hooks/use-faculty-directory"
import { useAcademicTermSelection } from "@/features/hooks/use-academic-term-selection"
import {
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
import type { Section } from "@/features/schemas/reference-data-schema"

const years = [1, 2, 3, 4] as const

function yearLabel(year: number) {
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`
}

const asTime = (value: string) => (value ? `${value}:00`.slice(0, 8) : "")

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
  const plansQuery = useSectionPlansQuery(termId, term !== null)
  const [activeYear, setActiveYear] = useState("1")
  const [editing, setEditing] = useState<Section | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
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
      plansQuery.isPending,
    isError:
      termSelection.termsQuery.isError ||
      sectionsQuery.isError ||
      subjectsQuery.isError ||
      facultyQuery.isError ||
      plansQuery.isError,
    error:
      termSelection.termsQuery.error ??
      sectionsQuery.error ??
      subjectsQuery.error ??
      facultyQuery.error ??
      plansQuery.error,
    data: true as const,
    refetch: () => {
      void termSelection.termsQuery.refetch()
      void sectionsQuery.refetch()
      void subjectsQuery.refetch()
      void facultyQuery.refetch()
      void plansQuery.refetch()
    },
  }

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
                  <TabsList aria-label="Generated section year filter">
                    {years.map((year) => (
                      <TabsTrigger key={year} value={String(year)}>
                        {yearLabel(year)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
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
        <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit section assignment</DialogTitle>
            <DialogDescription>
              Changes to an AI-generated faculty, time, room, or modality need
              an override reason for the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <WorkspaceField label="Professor">
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
            </WorkspaceField>
            <div className="sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center"
                onClick={() => setPickerOpen(true)}
                disabled={editing?.status === "published" || !isCurrentTerm}
              >
                <CalendarDays data-icon="inline-start" aria-hidden="true" />
                {draft.room
                  ? "Change room & schedule on the room calendar"
                  : "Pick a room & schedule on the room calendar"}
              </Button>
            </div>
            <WorkspaceField label="Schedule days">
              <Input value={draft.schedule_days} readOnly placeholder="Pick a room and slot above" />
            </WorkspaceField>
            <WorkspaceField label="Start time">
              <Input type="time" value={draft.starts_at_time} readOnly />
            </WorkspaceField>
            <WorkspaceField label="End time">
              <Input type="time" value={draft.ends_at_time} readOnly />
            </WorkspaceField>
            <WorkspaceField label="Room">
              <Input value={draft.room} readOnly placeholder="Pick a room above" />
            </WorkspaceField>
            <WorkspaceField label="Modality">
              <Input
                value={draft.modality ? draft.modality.replace("_", " ").toUpperCase() : ""}
                readOnly
                placeholder="Pick a room and slot above"
              />
            </WorkspaceField>
            <WorkspaceField label="Capacity">
              <Input
                type="number"
                min="1"
                value={draft.capacity}
                onChange={(event) =>
                  setDraft({ ...draft, capacity: Number(event.target.value) })
                }
              />
            </WorkspaceField>
            <WorkspaceField label="Override reason">
              <Input
                value={draft.override_reason}
                onChange={(event) =>
                  setDraft({ ...draft, override_reason: event.target.value })
                }
                placeholder="Required when changing AI output"
              />
            </WorkspaceField>
          </div>
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
              {saveSection.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RoomScheduleAssignmentDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        termId={termId}
        excludeSectionId={editing?.id}
        onConfirm={applyPickedSchedule}
      />
    </WorkspacePage>
  )
}
