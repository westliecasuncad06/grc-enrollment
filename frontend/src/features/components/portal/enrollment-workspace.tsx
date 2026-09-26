"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AccordionCard } from "@/features/components/portal/accordion-card"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { EligibleSubjectTable } from "@/features/components/portal/eligible-subject-table"
import { EnrollmentAddDropPanel } from "@/features/components/portal/enrollment-add-drop-panel"
import { EnrollmentCancelPanel } from "@/features/components/portal/enrollment-cancel-panel"
import { EnrollmentAvailabilityBanner } from "@/features/components/portal/enrollment-availability-banner"
import { EnrollmentCategoryExplanation } from "@/features/components/portal/enrollment-category-explanation"
import { EnrollmentQueuePaymentPanel } from "@/features/components/portal/enrollment-queue-payment-panel"
import { EnrollmentSectionTable } from "@/features/components/portal/enrollment-section-table"
import { StudentAccountBalancePanel } from "@/features/components/portal/student-account-balance-panel"
import {
  StatusStepper,
  type StatusStepperStage,
} from "@/features/components/portal/status-stepper"
import { CalendarDays, ListIcon } from "lucide-react"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  SectionScheduleCalendar,
  type SectionScheduleItem,
} from "@/features/components/portal/section-schedule-calendar"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/features/components/ui/accordion"
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
  ToggleGroup,
  ToggleGroupItem,
} from "@/features/components/ui/toggle-group"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Skeleton } from "@/features/components/ui/skeleton"
import { useEnrollmentScheduleQuery } from "@/features/hooks/use-enrollment-windows"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import {
  eligibleSubjectsQueryKey,
  enrollmentBlocksQueryKey,
  enrollmentsQueryKey,
  useEligibleSubjectsQuery,
  useEnrollmentBlocksQuery,
  useEnrollmentsQuery,
} from "@/features/hooks/use-enrollment"
import { useOwnStudentAccountQuery } from "@/features/hooks/use-student-account"
import { useOwnStudentProfileQuery } from "@/features/hooks/use-student-records"
import { useTermSelection } from "@/features/hooks/use-term-selection"
import type { EnrollmentBlock } from "@/features/schemas/enrollment-block-schema"
import type {
  Enrollment,
  EligibleSubject,
} from "@/features/schemas/enrollment-schema"
import { isApiClientError } from "@/features/services/api-client"
import { createBrowserEnrollmentDraftStore } from "@/features/services/enrollment-draft-store"
import { createEnrollment } from "@/features/services/enrollment-service"
import { formatAcademicTerm } from "@/features/services/reference-data-service"
import { formatTimeRange } from "@/features/lib/format-time"
import { hasScheduleConflict } from "@/features/lib/schedule-order"

const TERMINAL_STATUSES = new Set(["rejected", "cancelled", "withdrawn"])

/**
 * The exact substring `StoreEnrollmentRequest::rejectScheduleConflicts()`
 * uses for every conflict field error — matched so a stale-pick submission
 * failure gets a clearer explanation than the raw backend message.
 */
const CONFLICT_ERROR_SUBSTRING = "conflicts with another section"

/**
 * Subject/section picks the current eligible-subject pool no longer backs —
 * a section removed, or the subject no longer eligible — dropped from the
 * view. Pure so it can run both at render time (`effectiveSelections`) and
 * again, synchronously, against a just-refetched pool right before submit
 * (see `submit()`), without the two ever drifting out of sync.
 */
function pruneSelections(
  selections: Record<number, number>,
  subjects: readonly EligibleSubject[],
): Record<number, number> {
  const next: Record<number, number> = {}
  for (const [subjectIdKey, sectionId] of Object.entries(selections)) {
    const subjectId = Number(subjectIdKey)
    const subject = subjects.find((s) => s.subject_id === subjectId)
    if (
      subject?.available_sections.some((section) => section.id === sectionId)
    ) {
      next[subjectId] = sectionId
    }
  }
  return next
}

/** Same idea as `pruneSelections`, for the single block-code pick. */
function pruneBlockCode(
  blockCode: string | null,
  blocks: readonly EnrollmentBlock[],
): string | null {
  if (blockCode === null) return null
  return blocks.some((block) => block.block_code === blockCode)
    ? blockCode
    : null
}

/** Expands a pruned selections map into full (subject, section) pairs. */
function buildSelectedEntries(
  selections: Record<number, number>,
  subjects: readonly EligibleSubject[],
): {
  subject: EligibleSubject
  section: EligibleSubject["available_sections"][number]
}[] {
  return Object.entries(selections)
    .map(([subjectId, sectionId]) => {
      const subject = subjects.find((s) => s.subject_id === Number(subjectId))
      const section = subject?.available_sections.find(
        (candidate) => candidate.id === sectionId,
      )
      return subject && section ? { subject, section } : null
    })
    .filter(
      (
        entry,
      ): entry is {
        subject: EligibleSubject
        section: NonNullable<typeof entry>["section"]
      } => entry !== null,
    )
}

type SelectedEntry = ReturnType<typeof buildSelectedEntries>[number]

/** The first pair of picked sections whose meeting times overlap, if any. */
function findScheduleConflict(
  entries: readonly SelectedEntry[],
): { subjectA: EligibleSubject; subjectB: EligibleSubject } | null {
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]
      const b = entries[j]
      if (hasScheduleConflict(a.section, b.section)) {
        return { subjectA: a.subject, subjectB: b.subject }
      }
    }
  }
  return null
}

/**
 * A lecture/lab pairing violation message — the paired component is
 * missing, or picked in a different section — or null when all pairs agree.
 */
function findUnpairedComponent(
  entries: readonly SelectedEntry[],
  subjects: readonly EligibleSubject[],
): string | null {
  const sectionCodeBySubjectId = new Map<number, string>()
  for (const entry of entries) {
    sectionCodeBySubjectId.set(
      entry.subject.subject_id,
      entry.section.section_code,
    )
  }

  for (const entry of entries) {
    const pairedId = entry.subject.paired_subject_id
    if (pairedId !== null) {
      const pairedCode = sectionCodeBySubjectId.get(pairedId)
      const pairedSubject = subjects.find((s) => s.subject_id === pairedId)
      if (!pairedCode) {
        return `${entry.subject.code} requires its paired component (${pairedSubject?.code ?? "paired component"}) to be selected together.`
      }
      if (pairedCode !== entry.section.section_code) {
        return `${entry.subject.code} and ${pairedSubject?.code ?? "its paired component"} must be enrolled in the same section (${entry.section.section_code}).`
      }
    }
  }
  return null
}

/**
 * The single progress indicator for the whole enrollment process — from
 * picking a block/subjects through to being fully `enrolled`. Replaces the
 * separate steppers the old Queue & Payment module used to own, now that
 * that module's content is embedded here as a stage instead of a page of
 * its own.
 */
function overallStages(
  selectionLabel: string,
  enrollment: Enrollment | undefined,
  isRegular: boolean,
): readonly StatusStepperStage[] {
  const submitted = enrollment !== undefined
  const programHeadApproved = enrollment?.program_head_decided_at != null
  const approved = enrollment?.registrar_decided_at != null
  const paid = enrollment?.payment_confirmed_at != null
  const enrolled = enrollment?.enrolled_at != null

  if (isRegular) {
    return [
      { label: selectionLabel, done: submitted, current: !submitted },
      { label: "Submitted", done: submitted, current: submitted && !approved },
      {
        label: "Registrar approved",
        done: approved,
        current: approved && !paid,
      },
      { label: "Payment confirmed", done: paid, current: paid && !enrolled },
      { label: "Enrolled", done: enrolled, current: false },
    ]
  }

  // Irregular or overload: the Program Head checks the schedule first, then
  // the Registrar approves (ADR 0030).
  return [
    { label: selectionLabel, done: submitted, current: !submitted },
    {
      label: "Submitted",
      done: submitted,
      current: submitted && !programHeadApproved,
    },
    {
      label: "Program Head approved",
      done: programHeadApproved,
      current: programHeadApproved && !approved,
    },
    {
      label: "Registrar approved",
      done: approved,
      current: approved && !paid,
    },
    { label: "Payment confirmed", done: paid, current: paid && !enrolled },
    { label: "Enrolled", done: enrolled, current: false },
  ]
}

const SUBMIT_FAILED_MESSAGE =
  "Your enrollment could not be submitted. Check the connection and try again."

/**
 * What the student is told when a submit fails. The server's own sentence is
 * used where it is written for the student (a 409 "this section filled up",
 * a 422 without a field list); the rest get a fixed, readable explanation
 * instead of one generic "check the connection" line for every failure.
 */
function submitFailureMessage(error: unknown): string {
  if (!isApiClientError(error)) {
    return error instanceof Error && error.message
      ? error.message
      : SUBMIT_FAILED_MESSAGE
  }
  if (error.status === 403) {
    return "Your account is not allowed to submit this enrollment."
  }
  if (error.status === 404) {
    return "Your student record could not be found. Please contact the Registrar."
  }
  if (error.status === 409 || error.status === 422) {
    return error.message || SUBMIT_FAILED_MESSAGE
  }
  if (error.status !== undefined && error.status >= 500) {
    return "The server had a problem submitting your enrollment. Please try again in a moment."
  }

  return SUBMIT_FAILED_MESSAGE
}

export function EnrollmentWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termsQuery = useAcademicTermsQuery()
  const { selectedTermId } = useTermSelection(termsQuery.data)
  const eligibleSubjectsQuery = useEligibleSubjectsQuery(selectedTermId)
  const enrollmentsQuery = useEnrollmentsQuery()
  const studentAccountQuery = useOwnStudentAccountQuery({
    enabled: session?.role === "student",
  })
  const studentProfileQuery = useOwnStudentProfileQuery()
  const scheduleQuery = useEnrollmentScheduleQuery(selectedTermId)
  const viewer = scheduleQuery.data?.viewer
  const selectedTerm = termsQuery.data?.find(
    (term) => term.id === selectedTermId,
  )
  const currentYearLevel = studentAccountQuery.data?.year_level ?? null
  const currentSemester = selectedTerm?.semester ?? null
  const effectiveMaxUnits =
    studentProfileQuery.data?.curriculum_max_units ?? 30.0
  // Only a resolved "closed" reads as closed — an unresolved fetch (still
  // loading, or no viewer block for a non-student session) must not block
  // the workspace by default.
  const enrollmentWindowClosed =
    viewer !== undefined && viewer !== null && !viewer.is_open
  // Unresolved audience (still loading, or no viewer block at all) falls
  // back to the per-subject flow — the safer of the two while the real
  // audience is unknown, since it never assumes a single-block commitment.
  const isRegularAudience = viewer != null && viewer.audience !== "irregular"
  const [selections, setSelections] = useState<Record<number, number>>({})
  const [selectedBlockCode, setSelectedBlockCode] = useState<string | null>(
    null,
  )
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [outstandingBalancePromptOpen, setOutstandingBalancePromptOpen] =
    useState(false)
  const [submitError, setSubmitError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [receipt, setReceipt] = useState(false)

  const userId = session?.userId ?? null
  // Stable empty-array fallbacks (`useMemo`, not `?? []` inline) so the
  // `effectiveSelections`/`effectiveSelectedBlockCode` memos below don't see
  // a new dependency reference — and re-derive for no reason — on every
  // render while a query is still loading.
  const subjects = useMemo(
    () => eligibleSubjectsQuery.data ?? [],
    [eligibleSubjectsQuery.data],
  )
  const selectableSubjects = subjects.filter(
    (subject) => subject.is_eligible && subject.available_sections.length > 0,
  )
  const blocksQuery = useEnrollmentBlocksQuery(
    isRegularAudience ? selectedTermId : null,
  )
  const blocks = useMemo(() => blocksQuery.data ?? [], [blocksQuery.data])

  // `selections`/`selectedBlockCode` can carry entries restored from a
  // persisted draft (see below) that the live data no longer backs — a
  // section removed, or a block no longer offered. Rather than reconciling
  // that with its own effect + setState (an extra render for something
  // already derivable), every consumer below reads the pruned view instead;
  // the raw state is never rendered, submitted, or persisted directly.
  const effectiveSelections = useMemo(
    () =>
      eligibleSubjectsQuery.isSuccess
        ? pruneSelections(selections, subjects)
        : selections,
    [selections, subjects, eligibleSubjectsQuery.isSuccess],
  )

  const effectiveSelectedBlockCode = useMemo(
    () =>
      isRegularAudience && blocksQuery.isSuccess
        ? pruneBlockCode(selectedBlockCode, blocks)
        : selectedBlockCode,
    [selectedBlockCode, blocks, isRegularAudience, blocksQuery.isSuccess],
  )

  const selectedBlock: EnrollmentBlock | undefined = blocks.find(
    (block) => block.block_code === effectiveSelectedBlockCode,
  )

  // Persists in-progress picks (subject sections, or the chosen block)
  // across navigation — see `enrollment-draft-store.ts`. `restoredDraftKeyRef`
  // marks which (user, term) has already had its stored draft read into
  // state, so the effect below restores exactly once per term and never
  // overwrites a live edit with a stale re-read.
  const draftStore = useMemo(() => createBrowserEnrollmentDraftStore(), [])
  const restoredDraftKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (userId === null || selectedTermId === null) return
    const draftKey = `${userId}|${selectedTermId}`

    if (restoredDraftKeyRef.current !== draftKey) {
      restoredDraftKeyRef.current = draftKey
      const draft = draftStore.read(userId, selectedTermId)
      if (draft) {
        // Synchronizing local state from an external system (localStorage)
        // on (user, term) change — the sanctioned use of an effect, not
        // state derivable from props/state already in this render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelections(draft.selections)
        setSelectedBlockCode(draft.selectedBlockCode)
      }

      // The restore above (if any) hasn't rendered into `selections`/
      // `selectedBlockCode` yet on this pass — persisting now would write
      // back this render's pre-restore values. The next effect run (once
      // the restored state actually renders) takes the write branch below.
      return
    }

    draftStore.write(userId, selectedTermId, {
      selections: effectiveSelections,
      selectedBlockCode: effectiveSelectedBlockCode,
    })
  }, [
    userId,
    selectedTermId,
    effectiveSelections,
    effectiveSelectedBlockCode,
    draftStore,
  ])

  const activeEnrollment = (enrollmentsQuery.data ?? []).find(
    (enrollment) =>
      enrollment.academic_term_id === selectedTermId &&
      !TERMINAL_STATUSES.has(enrollment.status),
  )
  const hasActiveEnrollmentThisTerm = activeEnrollment !== undefined
  const addDrop = scheduleQuery.data?.add_drop

  const [enrolledScheduleView, setEnrolledScheduleView] = useState<
    "calendar" | "table"
  >("table")

  const activeEnrollmentCalendarItems: SectionScheduleItem[] = useMemo(() => {
    if (!activeEnrollment) return []
    return activeEnrollment.subjects.map((subj) => ({
      id: subj.section_id,
      subject_code: subj.subject_code,
      subject_title: subj.subject_title,
      units: subj.units,
      section_code: subj.section_code,
      room: subj.room,
      professor_name: subj.professor_name,
      schedule_days: subj.schedule_days ?? null,
      starts_at_time: subj.starts_at_time ?? null,
      ends_at_time: subj.ends_at_time ?? null,
      modality: subj.modality ?? null,
    }))
  }, [activeEnrollment])

  // Plain derived values — the React Compiler memoizes them. Manual
  // `useMemo`s here passed `selectedEntries` items into helpers the compiler
  // must assume could mutate them, which made it skip this whole component.
  const selectedEntries = buildSelectedEntries(effectiveSelections, subjects)

  const totalUnits = selectedEntries.reduce(
    (sum, entry) => sum + entry.subject.units,
    0,
  )

  const scheduleConflict = isRegularAudience
    ? null
    : findScheduleConflict(selectedEntries)

  const unpairedComponent = isRegularAudience
    ? null
    : findUnpairedComponent(selectedEntries, subjects)

  const validationError = isRegularAudience
    ? null
    : totalUnits > effectiveMaxUnits
      ? `Total units (${totalUnits}) exceeds the maximum allowed limit of ${effectiveMaxUnits.toFixed(1)} units. Please remove some subjects before submitting.`
      : scheduleConflict
        ? `Schedule conflict detected: ${scheduleConflict.subjectA.code} conflicts with ${scheduleConflict.subjectB.code}. Please choose non-conflicting sections.`
        : unpairedComponent

  // One source for both the dialog's sentence and its Confirm button. The
  // sentence used to read the pruned selection while the button read the raw
  // one, so the dialog could say "0 subjects, 0 units" over a live button.
  const nothingToSubmit = isRegularAudience
    ? selectedBlock === undefined
    : selectedEntries.length === 0
  const confirmErrors =
    fieldErrors.length > 0
      ? fieldErrors
      : submitError
        ? [submitError]
        : validationError
          ? [validationError]
          : []

  const mutation = useMutation({
    mutationFn: (payload: {
      blockCode: string | null
      sectionIds: readonly number[]
    }) =>
      payload.blockCode
        ? createEnrollment({
            academic_term_id: selectedTermId!,
            block_code: payload.blockCode,
          })
        : createEnrollment({
            academic_term_id: selectedTermId!,
            sections: payload.sectionIds.map((sectionId) => ({
              section_id: sectionId,
            })),
          }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: enrollmentsQueryKey(userId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: eligibleSubjectsQueryKey(userId, selectedTermId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: enrollmentBlocksQueryKey(userId, selectedTermId),
          exact: true,
        }),
      ])
      if (userId !== null && selectedTermId !== null) {
        draftStore.clear(userId, selectedTermId)
      }
      setSelections({})
      setSelectedBlockCode(null)
      setConfirmOpen(false)
      setReceipt(true)
    },
  })

  const chooseSection = (subjectId: number, sectionId: number) => {
    setReceipt(false)
    setSelections((prev) => ({ ...prev, [subjectId]: sectionId }))
  }
  const clearSection = (subjectId: number) => {
    setSelections((prev) => {
      const next = { ...prev }
      delete next[subjectId]
      return next
    })
  }
  const batchChooseSections = (newSelections: Record<number, number>) => {
    setReceipt(false)
    setSelections(newSelections)
  }
  const chooseBlock = (blockCode: string) => {
    setReceipt(false)
    setSelectedBlockCode(blockCode)
  }

  /**
   * The eligible-subject/block pool shown while picking can be several
   * minutes stale by submit time — nothing forces a refetch just from the
   * picker staying mounted (`staleTime` alone doesn't trigger one). Since
   * the server re-validates every submission from scratch regardless
   * (`StoreEnrollmentRequest`'s own docblock: "the client's view is
   * advisory only"), a pick that was valid when chosen but has since gone
   * stale (a section's schedule changed, a block was withdrawn, ...) would
   * otherwise fail with a confusing error the student has no way to
   * connect to "this page has been open a while." Refetching immediately
   * before building the payload — and building it from that fresh result,
   * not from render state — closes that gap.
   */
  // Every failure below keeps the confirm dialog open and reports inside it:
  // for a regular student the section picker is itself a dialog, and a page
  // banner behind it (the old behaviour) was never seen, so Confirm looked
  // dead.
  const openConfirm = () => {
    setSubmitError("")
    setFieldErrors([])
    // The window can close while the page sits open; refresh it so the dialog
    // does not offer a submit that the server is about to refuse.
    void scheduleQuery.refetch()
    setConfirmOpen(true)
  }

  const submit = async () => {
    setReceipt(false)
    setSubmitError("")
    setFieldErrors([])

    if (validationError) {
      setFieldErrors([validationError])
      return
    }

    try {
      let payload: { blockCode: string | null; sectionIds: readonly number[] }

      if (isRegularAudience) {
        if (!selectedBlockCode) {
          setFieldErrors(["Please select a section before submitting."])
          return
        }
        const freshBlocks = (await blocksQuery.refetch()).data ?? blocks
        const validBlockCode = pruneBlockCode(selectedBlockCode, freshBlocks)
        if (!validBlockCode) {
          setFieldErrors([
            `Section ${selectedBlockCode} is no longer available or has filled up. Please choose an open section.`,
          ])
          setSelectedBlockCode(null)
          return
        }
        const block = freshBlocks.find((b) => b.block_code === validBlockCode)
        if (!block || block.subjects.length === 0 || block.total_units === 0) {
          setFieldErrors([
            `Section ${validBlockCode} has no available subjects or units. Please choose another section.`,
          ])
          return
        }
        payload = {
          blockCode: validBlockCode,
          sectionIds: [],
        }
      } else {
        if (Object.keys(selections).length === 0) {
          setFieldErrors([
            "Please select at least one subject section before submitting.",
          ])
          return
        }
        const freshSubjects =
          (await eligibleSubjectsQuery.refetch()).data ?? subjects
        const freshEntries = buildSelectedEntries(
          pruneSelections(selections, freshSubjects),
          freshSubjects,
        )
        if (freshEntries.length === 0) {
          setFieldErrors([
            "Your selected subject sections are no longer available. Please review the available sections and try again.",
          ])
          return
        }
        payload = {
          blockCode: null,
          sectionIds: freshEntries.map((entry) => entry.section.id),
        }
      }

      await mutation.mutateAsync(payload)
      setConfirmOpen(false)
    } catch (error) {
      if (
        isApiClientError(error) &&
        error.fieldErrors &&
        Object.keys(error.fieldErrors).length > 0
      ) {
        const messages = [...new Set(Object.values(error.fieldErrors).flat())]
        const hasStaleConflict = messages.some((message) =>
          message.includes(CONFLICT_ERROR_SUBSTRING),
        )
        setFieldErrors(
          hasStaleConflict
            ? [
                ...messages,
                "Your selections were just refreshed against the current schedule — please review the sections above and submit again.",
              ]
            : messages,
        )
      } else {
        setSubmitError(submitFailureMessage(error))
      }
    }
  }

  // At most one of these ever renders — a fresh submit attempt clears the
  // others (see `submit()`), so a stale receipt can never sit stacked above
  // a failure from a later attempt.
  const banner =
    fieldErrors.length > 0 ? (
      <Alert variant="destructive">
        <AlertDescription>
          <ul className="grid gap-1">
            {fieldErrors.map((message, index) => (
              <li key={index}>{message}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    ) : submitError ? (
      <Alert variant="destructive">
        <AlertDescription>{submitError}</AlertDescription>
      </Alert>
    ) : validationError ? (
      <Alert variant="destructive">
        <AlertDescription>{validationError}</AlertDescription>
      </Alert>
    ) : receipt ? (
      <Alert>
        <AlertDescription>
          {isRegularAudience
            ? "Enrollment submitted and pending Registrar approval. Its status is shown below — once approved, please proceed in person to the school Cashier kiosk on campus to claim your queuing ticket for payment."
            : "Enrollment submitted and pending Program Head approval, then Registrar approval. Its status is shown below — once approved, please proceed in person to the school Cashier kiosk on campus to claim your queuing ticket for payment."}
        </AlertDescription>
      </Alert>
    ) : null

  // Identical in both the block and per-subject review cards — only the
  // unit total differs — so both call sites share this instead of repeating
  // the total-units row and submit button twice.
  const submitFooter = (totalUnitsValue: number) => {
    const isExceeded = !isRegularAudience && totalUnitsValue > effectiveMaxUnits
    const isOverload =
      !isRegularAudience &&
      totalUnitsValue > 24.0 &&
      totalUnitsValue <= effectiveMaxUnits
    const hasBlocker =
      totalUnitsValue === 0 ||
      isExceeded ||
      scheduleConflict !== null ||
      unpairedComponent !== null

    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border p-2.5">
            <span className="text-sm font-medium text-muted-foreground">
              Total units
            </span>
            <Badge
              variant={
                isExceeded ? "destructive" : isOverload ? "warning" : "default"
              }
              className="text-base font-semibold"
            >
              {totalUnitsValue}
            </Badge>
          </div>
          {isOverload && (
            <Badge variant="warning">Overload (requires approval)</Badge>
          )}
          {isExceeded && (
            <Badge variant="destructive">
              Exceeds {effectiveMaxUnits.toFixed(1)} unit maximum
            </Badge>
          )}
        </div>
        <Button
          type="button"
          className="w-full sm:w-auto"
          onClick={() => {
            const balance = Number(
              studentAccountQuery.data?.outstanding_balance ?? "0",
            )
            if (balance > 10000) {
              setOutstandingBalancePromptOpen(true)
            } else {
              openConfirm()
            }
          }}
          disabled={mutation.isPending || enrollmentWindowClosed || hasBlocker}
        >
          {mutation.isPending ? "Submitting enrollment" : "Submit enrollment"}
        </Button>
      </div>
    )
  }

  return (
    <WorkspacePage
      title={isRegularAudience ? "Select your section" : "Select your subjects"}
      description={
        isRegularAudience
          ? "Choose the section that enrolls you in every subject for your year level at once."
          : "Select one section per eligible subject, then submit."
      }
    >
      {selectedTermId !== null && (
        <StatusStepper
          stages={overallStages(
            isRegularAudience ? "Select section" : "Select subjects",
            activeEnrollment,
            activeEnrollment?.is_irregular != null
              ? !activeEnrollment.is_irregular
              : activeEnrollment?.student_enrollment_category != null
                ? activeEnrollment.student_enrollment_category === "regular"
                : isRegularAudience,
          )}
        />
      )}

      <EnrollmentAvailabilityBanner viewer={viewer} />
      <EnrollmentCategoryExplanation viewer={viewer} />

      {/* While the confirm dialog is open its errors render inside it. */}
      {!confirmOpen && banner}

      {selectedTermId === null ? (
        <p>Select an academic term to begin enrollment.</p>
      ) : (
        !hasActiveEnrollmentThisTerm &&
        (isRegularAudience ? (
          <div className="grid gap-4">
            <AsyncBoundary
              query={{
                // isPending, not isFetching: a background refetch (the one
                // submit() does first) must not unmount the section picker,
                // whose remount re-portals it above the confirm dialog.
                isPending: termsQuery.isPending || blocksQuery.isPending,
                isError: termsQuery.isError || blocksQuery.isError,
                error: termsQuery.error ?? blocksQuery.error,
                data: blocksQuery.data,
                refetch: () => {
                  void termsQuery.refetch()
                  void blocksQuery.refetch()
                },
              }}
              isEmpty={(all) => all.length === 0}
              emptyMessage="No sections were generated for your year level and curriculum yet. Contact the Program Head."
              loadingLabel="Loading your sections…"
              loadingFallback={<Skeleton className="h-48" />}
            >
              {() => (
                <AccordionCard
                  id="available-sections"
                  title="Available sections"
                >
                  <EnrollmentSectionTable
                    blocks={blocks}
                    selectedBlockCode={effectiveSelectedBlockCode}
                    onChoose={chooseBlock}
                    onChangeSection={() => setSelectedBlockCode(null)}
                    disabled={enrollmentWindowClosed}
                    renderSelectedFooter={(block) =>
                      submitFooter(block.total_units)
                    }
                  />
                </AccordionCard>
              )}
            </AsyncBoundary>
          </div>
        ) : (
          <div className="grid gap-4">
            <AsyncBoundary
              query={{
                isPending:
                  termsQuery.isPending || eligibleSubjectsQuery.isPending,
                isError: termsQuery.isError || eligibleSubjectsQuery.isError,
                error: termsQuery.error ?? eligibleSubjectsQuery.error,
                data: eligibleSubjectsQuery.data,
                refetch: () => {
                  void termsQuery.refetch()
                  void eligibleSubjectsQuery.refetch()
                },
              }}
              isEmpty={(all) =>
                all.filter(
                  (subject) =>
                    subject.is_eligible &&
                    subject.available_sections.length > 0,
                ).length === 0
              }
              emptyMessage="No subjects currently have open sections available to select."
              loadingLabel="Loading your eligible subjects…"
              loadingFallback={<Skeleton className="h-48" />}
            >
              {() => (
                <AccordionCard
                  id="eligible-subjects"
                  title="Eligible subjects"
                  description="Pick a section for each subject you want to enrol in."
                  contentClassName="min-w-0"
                >
                  <EligibleSubjectTable
                    subjects={selectableSubjects}
                    selections={effectiveSelections}
                    onChoose={chooseSection}
                    onClear={clearSection}
                    onBatchChoose={batchChooseSections}
                    disabled={enrollmentWindowClosed}
                    currentYearLevel={currentYearLevel}
                    currentSemester={currentSemester}
                    maxUnits={effectiveMaxUnits}
                  />
                  {selectedEntries.length > 0 && (
                    <div className="grid gap-3 border-t pt-4 sm:flex sm:items-center sm:justify-between">
                      {submitFooter(totalUnits)}
                    </div>
                  )}
                </AccordionCard>
              )}
            </AsyncBoundary>
          </div>
        ))
      )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setConfirmOpen(false)
        }}
      >
        <AlertDialogContent className="max-h-[100dvh] overflow-y-auto rounded-none sm:max-h-[90dvh] sm:rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm enrollment submission</AlertDialogTitle>
            <AlertDialogDescription>
              {nothingToSubmit ? (
                <>
                  {isRegularAudience
                    ? "No section is selected any more (it may have filled up or been withdrawn). Cancel and choose a section before submitting."
                    : "No subjects are selected. Cancel and choose at least one subject section before submitting."}{" "}
                </>
              ) : isRegularAudience && selectedBlock ? (
                <>
                  This enrolls you in all {selectedBlock.subjects.length}{" "}
                  subjects of section {selectedBlock.block_code}, totaling{" "}
                  {selectedBlock.total_units} units for{" "}
                </>
              ) : (
                <>
                  This submits {selectedEntries.length} subject
                  {selectedEntries.length === 1 ? "" : "s"} totaling{" "}
                  {totalUnits} units for{" "}
                </>
              )}
              {termsQuery.data?.find((term) => term.id === selectedTermId)
                ? formatAcademicTerm(
                    termsQuery.data.find((term) => term.id === selectedTermId)!,
                  )
                : "the selected term"}
              {nothingToSubmit ? null : (
                <>
                  . This action is recorded in the operational audit log and
                  sent
                  {isRegularAudience
                    ? " for Registrar approval — once approved, please proceed in person to"
                    : " for Program Head and then Registrar approval — once approved, please proceed in person to"}{" "}
                  the school Cashier kiosk on campus to claim your queuing
                  ticket for payment.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {enrollmentWindowClosed && (
            <Alert variant="destructive">
              <AlertDescription>
                Enrollment is not open for you right now, so this cannot be
                submitted.
              </AlertDescription>
            </Alert>
          )}
          {confirmErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="grid gap-1">
                  {confirmErrors.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter className="[&_button]:w-full sm:[&_button]:w-auto">
            <AlertDialogCancel disabled={mutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={
                mutation.isPending ||
                nothingToSubmit ||
                enrollmentWindowClosed ||
                validationError !== null
              }
              onClick={() => void submit()}
            >
              {mutation.isPending ? "Submitting" : "Confirm submission"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={outstandingBalancePromptOpen}
        onOpenChange={(open) => {
          if (!open) setOutstandingBalancePromptOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Outstanding balance notice</AlertDialogTitle>
            <AlertDialogDescription>
              You currently have an outstanding balance exceeding ₱10,000.00 (
              {studentAccountQuery.data?.outstanding_balance
                ? `₱${studentAccountQuery.data.outstanding_balance}`
                : ""}
              ). Are you willing to pay your remaining balance?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="[&_button]:w-full sm:[&_button]:w-auto">
            <AlertDialogCancel
              onClick={() => setOutstandingBalancePromptOpen(false)}
            >
              No, cancel
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                setOutstandingBalancePromptOpen(false)
                openConfirm()
              }}
            >
              Yes, proceed
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {session?.role === "student" && (
        <AsyncBoundary
          query={{
            isPending: studentAccountQuery.isPending,
            isError: studentAccountQuery.isError,
            error: studentAccountQuery.error,
            data: studentAccountQuery.data,
            refetch: () => void studentAccountQuery.refetch(),
          }}
          loadingLabel="Loading your account balance…"
          loadingFallback={<Skeleton className="h-40" />}
        >
          {(account) => (
            <StudentAccountBalancePanel account={account} defaultOpen={false} />
          )}
        </AsyncBoundary>
      )}

      {/* Sections start open only for the step the student is on: the queue
          ticket while the enrollment is in progress, the timetable once it is
          confirmed. Everything else starts collapsed and can be opened. */}
      {activeEnrollment && (
        <EnrollmentCancelPanel enrollment={activeEnrollment} />
      )}

      {activeEnrollment && (
        <EnrollmentQueuePaymentPanel
          enrollment={activeEnrollment}
          defaultOpen={activeEnrollment.status !== "enrolled"}
        />
      )}

      {activeEnrollment && activeEnrollment.subjects.length > 0 && (
        <Card role="region" aria-label="Enrolled class schedule">
          <Accordion
            type="single"
            collapsible
            defaultValue={
              activeEnrollment.status === "enrolled" ? "schedule" : undefined
            }
          >
            <AccordionItem value="schedule" className="border-none">
              <CardHeader className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <AccordionTrigger className="hover:no-underline py-0 text-left">
                    <div>
                      <CardTitle
                        level={2}
                        className="flex items-center gap-2 text-lg font-bold"
                      >
                        <CalendarDays
                          className="size-5 text-primary"
                          aria-hidden="true"
                        />
                        Enrolled Class Schedule
                      </CardTitle>
                      <CardDescription className="text-xs font-normal">
                        Weekly class timetable and professor assignments for{" "}
                        {selectedTerm
                          ? formatAcademicTerm(selectedTerm)
                          : "the selected term"}
                        .
                      </CardDescription>
                    </div>
                  </AccordionTrigger>
                </div>
                <div
                  className="flex flex-wrap items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Badge variant="secondary">
                    {activeEnrollment.status_label}
                  </Badge>
                  <Badge variant="outline">
                    {activeEnrollment.total_units} units
                  </Badge>
                  <ToggleGroup
                    type="single"
                    value={enrolledScheduleView}
                    onValueChange={(val) => {
                      if (val === "table" || val === "calendar")
                        setEnrolledScheduleView(val)
                    }}
                    variant="outline"
                    size="sm"
                    aria-label="Enrolled schedule layout"
                  >
                    <ToggleGroupItem value="table" aria-label="Schedule list">
                      <ListIcon data-icon="inline-start" aria-hidden="true" />
                      Schedule list
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="calendar"
                      aria-label="View in calendar"
                    >
                      <CalendarDays
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      View in calendar
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <AccordionContent className="pt-4 pb-0">
                <CardContent className="pt-0">
                  {enrolledScheduleView === "calendar" ? (
                    <SectionScheduleCalendar
                      items={activeEnrollmentCalendarItems}
                      disabled={true}
                      emptyMessage="No timetable slots found for enrolled subjects."
                    />
                  ) : (
                    <DataTable
                      caption="Enrolled subjects schedule"
                      rowKey={(subj) => subj.section_id}
                      rows={activeEnrollment.subjects}
                      columns={[
                        {
                          key: "code",
                          header: "Subject code",
                          render: (subj) => subj.subject_code,
                        },
                        {
                          key: "title",
                          header: "Description",
                          render: (subj) => subj.subject_title,
                        },
                        {
                          key: "units",
                          header: "Units",
                          render: (subj) => subj.units ?? "—",
                        },
                        {
                          key: "section",
                          header: "Section",
                          render: (subj) => subj.section_code ?? "—",
                        },
                        {
                          key: "day",
                          header: "Day",
                          render: (subj) =>
                            subj.schedule_days ?? "To be confirmed",
                        },
                        {
                          key: "time",
                          header: "Time",
                          render: (subj) =>
                            subj.starts_at_time && subj.ends_at_time
                              ? formatTimeRange(
                                  subj.starts_at_time,
                                  subj.ends_at_time,
                                )
                              : "To be confirmed",
                        },
                        {
                          key: "room",
                          header: "Room",
                          render: (subj) => subj.room ?? "To be confirmed",
                        },
                        {
                          key: "professor",
                          header: "Professor",
                          render: (subj) =>
                            subj.professor_name ?? "Announced after enrollment",
                        },
                        {
                          key: "status",
                          header: "Status",
                          render: (subj) => (
                            <Badge variant="outline">{subj.status_label}</Badge>
                          ),
                        },
                      ]}
                    />
                  )}
                </CardContent>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}

      {activeEnrollment?.status === "enrolled" && (
        <EnrollmentAddDropPanel
          enrollment={activeEnrollment}
          windowOpen={addDrop?.is_open ?? false}
          windowMessage={
            addDrop?.reason_message ?? "Loading add/drop availability…"
          }
          windowClosesAt={addDrop?.closes_at ?? null}
          defaultOpen={false}
        />
      )}

      {(enrollmentsQuery.data ?? []).length > 0 && (
        <Card>
          <Accordion type="single" collapsible>
            <AccordionItem value="enrollments" className="border-none">
              <CardHeader className="py-3">
                <AccordionTrigger className="hover:no-underline py-0 text-left">
                  <CardTitle level={2}>Your enrollments</CardTitle>
                </AccordionTrigger>
              </CardHeader>
              <AccordionContent className="pb-0">
                <CardContent className="pt-2">
                  <DataTable
                    caption="Your enrollments"
                    rowKey={(enrollment) => enrollment.id}
                    rows={enrollmentsQuery.data ?? []}
                    columns={[
                      {
                        key: "term",
                        header: "Term",
                        render: (enrollment) => {
                          const term = termsQuery.data?.find(
                            (candidate) =>
                              candidate.id === enrollment.academic_term_id,
                          )
                          return term
                            ? formatAcademicTerm(term)
                            : enrollment.academic_term_id
                        },
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (enrollment) => (
                          <Badge>{enrollment.status_label}</Badge>
                        ),
                      },
                      {
                        key: "units",
                        header: "Units",
                        render: (enrollment) => enrollment.total_units,
                      },
                      {
                        key: "queue_ticket",
                        header: "Queue ticket",
                        render: (enrollment) =>
                          enrollment.queue_ticket?.ticket_number ?? "—",
                      },
                    ]}
                  />
                </CardContent>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}
    </WorkspacePage>
  )
}
