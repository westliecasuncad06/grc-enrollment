"use client"

import { useMemo, useState } from "react"
import {
  BookOpenText,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Save,
  Send,
  ShieldCheck,
  UsersRound,
} from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Input } from "@/features/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import {
  useGradeSubmissionSectionsQuery,
  useSaveSectionGradeDraftsMutation,
  useSectionGradeSheetQuery,
  useSubmitSectionGradesMutation,
} from "@/features/hooks/use-section-grades"
import {
  allowedMarksForSubject,
  gradeMarkLabel,
  type GradeMarkValue,
} from "@/features/lib/grade-presentation"
import { cn } from "@/features/lib/utils"
import { gradeMarkValues } from "@/features/schemas/academic-grade-schema"
import type {
  GradeSectionSummary,
  SectionGradeRow,
  SectionGradeSheet,
} from "@/features/schemas/section-grade-schema"

interface DraftGrade {
  mark: string
  remarks: string
}

function isGradeMark(value: string): value is GradeMarkValue {
  return (gradeMarkValues as readonly string[]).includes(value)
}

function formatClock(value: string): string {
  const [hours = "0", minutes = "00"] = value.split(":")
  const hour = Number(hours)
  const period = hour >= 12 ? "PM" : "AM"
  const twelveHour = hour % 12 || 12

  return `${String(twelveHour).padStart(2, "0")}:${minutes} ${period}`
}

function scheduleLabel(section: GradeSectionSummary): string {
  const {
    days,
    starts_at_time: startsAt,
    ends_at_time: endsAt,
  } = section.schedule

  if (!days || !startsAt || !endsAt) return "Schedule to be announced"
  return `${days} · ${formatClock(startsAt)}–${formatClock(endsAt)}`
}

const stateLabel: Record<GradeSectionSummary["state"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready: "Ready to submit",
  submitted: "Awaiting Registrar",
  locked: "Locked",
}

function GradeSectionCard({
  section,
  selected,
  onSelect,
}: {
  section: GradeSectionSummary
  selected: boolean
  onSelect: () => void
}) {
  const progress =
    section.enrolled_count === 0
      ? 0
      : Math.round((section.recorded_count / section.enrolled_count) * 100)

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-4 text-left shadow-xs transition duration-200",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected && "border-primary/60 ring-2 ring-primary/15",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-1 bg-muted transition-colors",
          selected || section.state === "ready"
            ? "bg-primary"
            : section.state === "locked"
              ? "bg-emerald-600"
              : "group-hover:bg-primary/50",
        )}
      />
      <span className="flex items-start justify-between gap-3 pl-1">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <BookOpenText
              className="size-4 shrink-0 text-primary"
              aria-hidden
            />
            <span className="font-mono text-xs font-semibold tracking-[0.08em] text-primary">
              {section.subject.code}
            </span>
          </span>
          <span className="mt-1 block font-heading text-lg leading-tight font-semibold text-foreground">
            {section.subject.title}
          </span>
          <span className="mt-1 block text-xs font-medium text-muted-foreground">
            Section {section.section_code}
          </span>
        </span>
        <Badge
          variant={section.state === "locked" ? "default" : "outline"}
          className="shrink-0"
        >
          {stateLabel[section.state]}
        </Badge>
      </span>

      <span className="mt-4 grid gap-2 border-y py-3 text-xs text-muted-foreground sm:grid-cols-2">
        <span className="flex items-center gap-2">
          <CalendarDays className="size-3.5" aria-hidden />
          {section.academic_term.school_year} · {section.academic_term.semester}
        </span>
        <span className="flex items-center gap-2 sm:justify-end">
          <Clock3 className="size-3.5" aria-hidden />
          {scheduleLabel(section)}
        </span>
      </span>

      <span className="mt-3 block">
        <span className="flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <UsersRound className="size-3.5" aria-hidden />
            {section.enrolled_count} enrolled
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            {section.recorded_count === section.enrolled_count &&
              section.enrolled_count > 0 && (
                <CheckCircle2
                  className="size-3.5 text-emerald-600"
                  aria-hidden
                />
              )}
            {section.recorded_count} / {section.enrolled_count} recorded
          </span>
        </span>
        <span
          role="progressbar"
          aria-label={`${section.subject.code} grading progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </span>
      </span>
    </button>
  )
}

function rowBadgeVariant(
  status: SectionGradeRow["status"],
): "default" | "secondary" | "outline" {
  if (status === "locked") return "default"
  if (status === "submitted") return "secondary"
  return "outline"
}

function SectionGradeSheetPanel({ sectionId }: { sectionId: number }) {
  const sheetQuery = useSectionGradeSheetQuery(sectionId)
  const saveMutation = useSaveSectionGradeDraftsMutation(sectionId)
  const submitMutation = useSubmitSectionGradesMutation(sectionId)
  const [drafts, setDrafts] = useState<Record<number, DraftGrade>>({})
  const [error, setError] = useState("")
  const [confirmationOpen, setConfirmationOpen] = useState(false)

  const sheet = sheetQuery.data
  const readOnly =
    sheet?.section.state === "submitted" || sheet?.section.state === "locked"
  const allowedMarks = allowedMarksForSubject(
    sheet?.section.subject.is_completion_only ?? false,
  )

  const draftFor = (row: SectionGradeRow): DraftGrade =>
    drafts[row.student_id] ?? {
      mark: row.mark ?? "",
      remarks: row.remarks ?? "",
    }

  const setDraft = (row: SectionGradeRow, next: Partial<DraftGrade>) => {
    setDrafts((current) => ({
      ...current,
      [row.student_id]: { ...draftFor(row), ...next },
    }))
  }

  const changedRows = useMemo(() => {
    if (!sheet) return []

    return sheet.rows.filter((row) => {
      const draft = drafts[row.student_id]
      if (!draft || row.status === "submitted" || row.status === "locked") {
        return false
      }

      return (
        draft.mark !== (row.mark ?? "") ||
        draft.remarks.trim() !== (row.remarks ?? "")
      )
    })
  }, [drafts, sheet])

  const savableRows = changedRows.filter((row) =>
    isGradeMark(draftFor(row).mark),
  )
  const allComplete =
    (sheet?.rows.length ?? 0) > 0 &&
    (sheet?.rows.every((row) => {
      const mark = draftFor(row).mark
      return isGradeMark(mark) && allowedMarks.includes(mark)
    }) ??
      false)
  const pending = saveMutation.isPending || submitMutation.isPending

  const saveRows = async (rows: readonly SectionGradeRow[]) => {
    if (rows.length === 0) return

    await saveMutation.mutateAsync({
      grades: rows.map((row) => {
        const draft = draftFor(row)
        return {
          student_id: row.student_id,
          mark: draft.mark as GradeMarkValue,
          remarks: draft.remarks.trim() || null,
        }
      }),
    })
  }

  const saveDraft = async () => {
    setError("")
    try {
      await saveRows(savableRows)
      setDrafts({})
    } catch {
      setError(
        "The draft could not be saved. Your unsaved grades are still here; check the roster or connection and try again.",
      )
    }
  }

  const submitFinal = async () => {
    setError("")
    try {
      await saveRows(savableRows)
      await submitMutation.mutateAsync()
      setDrafts({})
    } catch {
      setError(
        "Final grades could not be submitted. Your unsaved grades are still here; review the roster and try again.",
      )
    }
  }

  const columns: DataTableColumn<SectionGradeRow>[] = [
    {
      key: "student_name",
      header: "Student",
      render: (row) => (
        <span className="font-medium text-foreground">{row.student_name}</span>
      ),
    },
    {
      key: "student_number",
      header: "Student number",
      render: (row) => (
        <span className="font-mono text-xs">{row.student_number}</span>
      ),
    },
    {
      key: "mark",
      header: "Grade",
      cellClassName: "min-w-48",
      render: (row) => {
        const draft = draftFor(row)
        const editable =
          !readOnly && row.status !== "submitted" && row.status !== "locked"

        if (!editable) {
          return row.mark ? `${row.mark} — ${row.mark_label ?? ""}` : "—"
        }

        return (
          <Select
            value={draft.mark}
            disabled={pending}
            onValueChange={(mark) => setDraft(row, { mark })}
          >
            <SelectTrigger
              aria-label={`Grade for ${row.student_name}`}
              className="w-full"
            >
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              {allowedMarks.map((mark) => (
                <SelectItem key={mark} value={mark}>
                  {mark} — {gradeMarkLabel[mark]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      },
    },
    {
      key: "remarks",
      header: "Remarks",
      cellClassName: "min-w-56",
      render: (row) => {
        const editable =
          !readOnly && row.status !== "submitted" && row.status !== "locked"

        if (!editable) return row.remarks ?? "—"

        return (
          <Input
            aria-label={`Remarks for ${row.student_name}`}
            value={draftFor(row).remarks}
            disabled={pending}
            placeholder="Optional"
            onChange={(event) => setDraft(row, { remarks: event.target.value })}
          />
        )
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={rowBadgeVariant(row.status)}>{row.status_label}</Badge>
      ),
    },
  ]

  return (
    <Card className="border-primary/10">
      <AsyncBoundary
        query={sheetQuery}
        loadingLabel="Loading the section grade sheet…"
      >
        {(loadedSheet: SectionGradeSheet) => (
          <>
            <CardHeader className="border-b pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-semibold tracking-[0.08em] text-primary">
                    {loadedSheet.section.subject.code} · Section{" "}
                    {loadedSheet.section.section_code}
                  </p>
                  <CardTitle level={2} className="mt-1 text-xl">
                    {loadedSheet.section.subject.title}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {loadedSheet.section.academic_term.school_year} ·{" "}
                    {loadedSheet.section.academic_term.semester} ·{" "}
                    {scheduleLabel(loadedSheet.section)}
                  </p>
                </div>
                <Badge
                  variant={
                    loadedSheet.section.state === "locked"
                      ? "default"
                      : "outline"
                  }
                >
                  {stateLabel[loadedSheet.section.state]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Grade sheet not saved</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {readOnly && (
                <Alert>
                  <ShieldCheck aria-hidden />
                  <AlertTitle>
                    {loadedSheet.section.state === "locked"
                      ? "Official grades locked"
                      : "Final grades submitted"}
                  </AlertTitle>
                  <AlertDescription>
                    {loadedSheet.section.state === "locked"
                      ? "This grade sheet is part of the official academic record and is read-only."
                      : "This complete grade sheet is read-only while awaiting Registrar Head locking."}
                  </AlertDescription>
                </Alert>
              )}
              <DataTable
                caption="Section grade sheet"
                rows={loadedSheet.rows}
                rowKey={(row) => row.enrollment_subject_id}
                columns={columns}
                emptyMessage="No enrolled students are in this section yet."
              />
            </CardContent>
            {!readOnly && loadedSheet.rows.length > 0 && (
              <CardFooter className="flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
                <p className="text-xs text-muted-foreground">
                  {allComplete
                    ? "Every enrolled student has a valid grade."
                    : `${loadedSheet.rows.filter((row) => !isGradeMark(draftFor(row).mark)).length} student(s) still need a grade.`}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || savableRows.length === 0}
                    onClick={() => void saveDraft()}
                  >
                    <Save aria-hidden />
                    {saveMutation.isPending ? "Saving…" : "Save draft"}
                  </Button>
                  <Button
                    type="button"
                    disabled={pending || !allComplete}
                    onClick={() => setConfirmationOpen(true)}
                  >
                    <Send aria-hidden />
                    Submit final grades
                  </Button>
                </div>
              </CardFooter>
            )}

            <AlertDialog
              open={confirmationOpen}
              onOpenChange={setConfirmationOpen}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Submit final grades?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This submits the entire enrolled roster. After submission,
                    you can no longer edit this grade sheet while it awaits
                    Registrar Head locking.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Review again</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void submitFinal()}>
                    Submit section
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </AsyncBoundary>
    </Card>
  )
}

export function GradeSubmissionWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "faculty"
  const [sectionId, setSectionId] = useState<number | null>(null)
  const sectionsQuery = useGradeSubmissionSectionsQuery({
    enabled: authorized,
  })

  const selectSection = (nextSectionId: number) => {
    setSectionId(nextSectionId)
  }

  return (
    <WorkspacePage
      title="Grade submission"
      description="Open an assigned class, save grades as a draft, then submit the complete section for Registrar review."
      unauthorized={!authorized}
      lastUpdated={sectionsQuery.dataUpdatedAt}
    >
      <Card>
        <CardHeader>
          <CardTitle level={2}>Assigned classes</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={sectionsQuery}
            isEmpty={(sections) => sections.length === 0}
            emptyMessage="No sections are currently assigned to your faculty account."
            loadingLabel="Loading your assigned classes…"
          >
            {(sections) => (
              <div className="grid gap-3 xl:grid-cols-2">
                {sections.map((section) => (
                  <GradeSectionCard
                    key={section.section_id}
                    section={section}
                    selected={section.section_id === sectionId}
                    onSelect={() => selectSection(section.section_id)}
                  />
                ))}
              </div>
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>

      {sectionId !== null && (
        <SectionGradeSheetPanel key={sectionId} sectionId={sectionId} />
      )}
    </WorkspacePage>
  )
}
