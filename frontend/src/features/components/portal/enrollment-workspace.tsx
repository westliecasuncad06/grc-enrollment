"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { EligibleSubjectTable } from "@/features/components/portal/eligible-subject-table"
import { EnrollmentAddDropPanel } from "@/features/components/portal/enrollment-add-drop-panel"
import { EnrollmentAvailabilityBanner } from "@/features/components/portal/enrollment-availability-banner"
import { EnrollmentCategoryExplanation } from "@/features/components/portal/enrollment-category-explanation"
import { EnrollmentQueuePaymentPanel } from "@/features/components/portal/enrollment-queue-payment-panel"
import { EnrollmentSectionTable } from "@/features/components/portal/enrollment-section-table"
import { StudentAccountBalancePanel } from "@/features/components/portal/student-account-balance-panel"
import {
  StatusStepper,
  type StatusStepperStage,
} from "@/features/components/portal/status-stepper"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
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
): readonly StatusStepperStage[] {
  const submitted = enrollment !== undefined
  const approved = enrollment?.registrar_decided_at != null
  const paid = enrollment?.payment_confirmed_at != null
  const enrolled = enrollment?.enrolled_at != null

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
  const scheduleQuery = useEnrollmentScheduleQuery(selectedTermId)
  const viewer = scheduleQuery.data?.viewer
  const selectedTerm = termsQuery.data?.find(
    (term) => term.id === selectedTermId,
  )
  const currentYearLevel = studentAccountQuery.data?.year_level ?? null
  const currentSemester = selectedTerm?.semester ?? null
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

  const selectedEntries = buildSelectedEntries(effectiveSelections, subjects)

  const totalUnits = selectedEntries.reduce(
    (sum, entry) => sum + entry.subject.units,
    0,
  )

  const mutation = useMutation({
    mutationFn: (payload: {
      blockCode: string | null
      sectionIds: readonly number[]
    }) =>
      isRegularAudience
        ? createEnrollment({
            academic_term_id: selectedTermId!,
            block_code: payload.blockCode!,
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
  const submit = async () => {
    setReceipt(false)
    setSubmitError("")
    setFieldErrors([])
    try {
      let payload: { blockCode: string | null; sectionIds: readonly number[] }

      if (isRegularAudience) {
        const freshBlocks = (await blocksQuery.refetch()).data ?? blocks
        payload = {
          blockCode: pruneBlockCode(selectedBlockCode, freshBlocks),
          sectionIds: [],
        }
      } else {
        const freshSubjects =
          (await eligibleSubjectsQuery.refetch()).data ?? subjects
        const freshEntries = buildSelectedEntries(
          pruneSelections(selections, freshSubjects),
          freshSubjects,
        )
        payload = {
          blockCode: null,
          sectionIds: freshEntries.map((entry) => entry.section.id),
        }
      }

      await mutation.mutateAsync(payload)
    } catch (error) {
      if (
        isApiClientError(error) &&
        error.status === 422 &&
        error.fieldErrors
      ) {
        const messages = Object.values(error.fieldErrors).flat()
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
        setSubmitError(
          "Your enrollment could not be submitted. Check the connection and try again.",
        )
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
    ) : receipt ? (
      <Alert>
        <AlertDescription>
          Enrollment submitted and pending registrar approval. Its status is
          shown below — you&apos;ll get a queue number once it&apos;s approved.
        </AlertDescription>
      </Alert>
    ) : null

  // Identical in both the block and per-subject review cards — only the
  // unit total differs — so both call sites share this instead of repeating
  // the total-units row and submit button twice.
  const submitFooter = (totalUnitsValue: number) => (
    <>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <span className="text-sm font-medium text-muted-foreground">
          Total units
        </span>
        <Badge className="text-base">{totalUnitsValue}</Badge>
      </div>
      <Button
        type="button"
        className="w-full sm:w-auto"
        onClick={() => setConfirmOpen(true)}
        disabled={mutation.isPending || enrollmentWindowClosed}
      >
        {mutation.isPending ? "Submitting enrollment" : "Submit enrollment"}
      </Button>
    </>
  )

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
          )}
        />
      )}

      <EnrollmentAvailabilityBanner viewer={viewer} />
      <EnrollmentCategoryExplanation viewer={viewer} />

      {banner}

      {selectedTermId === null ? (
        <p>Select an academic term to begin enrollment.</p>
      ) : (
        !hasActiveEnrollmentThisTerm &&
        (isRegularAudience ? (
          <div className="grid gap-4">
            <AsyncBoundary
              query={{
                isPending: termsQuery.isPending || blocksQuery.isFetching,
                isError: termsQuery.isError || blocksQuery.isError,
                error: termsQuery.error ?? blocksQuery.error,
                data: blocksQuery.data,
                refetch: () => {
                  void termsQuery.refetch()
                  void blocksQuery.refetch()
                },
              }}
              isEmpty={(all) => all.length === 0}
              emptyMessage="No sections were generated for your year level and curriculum yet. Contact the Registrar."
              loadingLabel="Loading your sections…"
              loadingFallback={<Skeleton className="h-48" />}
            >
              {() => (
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
              )}
            </AsyncBoundary>
          </div>
        ) : (
          <div className="grid gap-4">
            <AsyncBoundary
              query={{
                isPending:
                  termsQuery.isPending || eligibleSubjectsQuery.isFetching,
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
                <Card>
                  <CardHeader>
                    <CardTitle level={2}>Eligible subjects</CardTitle>
                    <CardDescription>
                      Pick a section for each subject you want to enrol in.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid min-w-0 gap-4">
                    <EligibleSubjectTable
                      subjects={selectableSubjects}
                      selections={effectiveSelections}
                      onChoose={chooseSection}
                      onClear={clearSection}
                      disabled={enrollmentWindowClosed}
                      currentYearLevel={currentYearLevel}
                      currentSemester={currentSemester}
                    />
                    {selectedEntries.length > 0 && (
                      <div className="grid gap-3 border-t pt-4 sm:flex sm:items-center sm:justify-between">
                        {submitFooter(totalUnits)}
                      </div>
                    )}
                  </CardContent>
                </Card>
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
              {isRegularAudience && selectedBlock ? (
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
              . This action is recorded in the operational audit log and sent
              for registrar approval — your queue number is issued once
              it&apos;s approved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="[&_button]:w-full sm:[&_button]:w-auto">
            <AlertDialogCancel disabled={mutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={() => void submit()}
            >
              {mutation.isPending ? "Submitting" : "Confirm submission"}
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
          {(account) => <StudentAccountBalancePanel account={account} />}
        </AsyncBoundary>
      )}

      {activeEnrollment && (
        <EnrollmentQueuePaymentPanel enrollment={activeEnrollment} />
      )}

      {activeEnrollment?.status === "enrolled" && (
        <EnrollmentAddDropPanel
          enrollment={activeEnrollment}
          windowOpen={addDrop?.is_open ?? false}
          windowMessage={
            addDrop?.reason_message ?? "Loading add/drop availability…"
          }
          windowClosesAt={addDrop?.closes_at ?? null}
        />
      )}

      {(enrollmentsQuery.data ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle level={2}>Your enrollments</CardTitle>
          </CardHeader>
          <CardContent>
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
        </Card>
      )}
    </WorkspacePage>
  )
}
