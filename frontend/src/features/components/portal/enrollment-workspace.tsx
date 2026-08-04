"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { EnrollmentAvailabilityBanner } from "@/features/components/portal/enrollment-availability-banner"
import { EnrollmentBlockChoice } from "@/features/components/portal/enrollment-block-choice"
import { StaggerItem, StaggerList } from "@/features/components/portal/motion"
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
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
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
import { useTermSelection } from "@/features/hooks/use-term-selection"
import type { EnrollmentBlock } from "@/features/schemas/enrollment-block-schema"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"
import { isApiClientError } from "@/features/services/api-client"
import { createEnrollment } from "@/features/services/enrollment-service"
import { formatAcademicTerm } from "@/features/services/reference-data-service"

const TERMINAL_STATUSES = new Set(["rejected", "cancelled", "withdrawn"])

function SectionChoice({
  subject,
  selectedSectionId,
  onChoose,
  onClear,
  disabled = false,
}: {
  subject: EligibleSubject
  selectedSectionId: number | undefined
  onChoose: (sectionId: number) => void
  onClear: () => void
  disabled?: boolean
}) {
  return (
    <Card role="article" aria-label={`${subject.code} ${subject.title}`}>
      <CardHeader>
        <CardTitle level={2}>
          {subject.code} — {subject.title} ({subject.units} units)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor={`section-choice-${subject.subject_id}`}>
            Section
          </FieldLabel>
          <Select
            value={selectedSectionId ? String(selectedSectionId) : ""}
            onValueChange={(value) => {
              const sectionId = Number(value)
              if (sectionId) onChoose(sectionId)
              else onClear()
            }}
            disabled={disabled}
          >
            <SelectTrigger
              id={`section-choice-${subject.subject_id}`}
              className="w-full"
            >
              <SelectValue placeholder="Not selected" />
            </SelectTrigger>
            <SelectContent>
              {subject.available_sections.map((section) => (
                <SelectItem key={section.id} value={String(section.id)}>
                  Section {section.section_code}
                  {section.schedule_days
                    ? ` · ${section.schedule_days} ${section.starts_at_time}–${section.ends_at_time}`
                    : ""}{" "}
                  · {section.remaining_seats} seat
                  {section.remaining_seats === 1 ? "" : "s"} open
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  )
}

export function EnrollmentWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termsQuery = useAcademicTermsQuery()
  const { selectedTermId, setSelectedTermId } = useTermSelection(
    termsQuery.data,
  )
  const eligibleSubjectsQuery = useEligibleSubjectsQuery(selectedTermId)
  const enrollmentsQuery = useEnrollmentsQuery()
  const scheduleQuery = useEnrollmentScheduleQuery(selectedTermId)
  const viewer = scheduleQuery.data?.viewer
  // Only a resolved "closed" reads as closed — an unresolved fetch (still
  // loading, or no viewer block for a non-student session) must not block
  // the workspace by default.
  const enrollmentWindowClosed = viewer !== undefined && viewer !== null && !viewer.is_open
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
  const subjects = eligibleSubjectsQuery.data ?? []
  const selectableSubjects = subjects.filter(
    (subject) => subject.is_eligible && subject.available_sections.length > 0,
  )
  const blocksQuery = useEnrollmentBlocksQuery(
    isRegularAudience ? selectedTermId : null,
  )
  const blocks = blocksQuery.data ?? []
  const selectedBlock: EnrollmentBlock | undefined = blocks.find(
    (block) => block.block_code === selectedBlockCode,
  )

  const hasActiveEnrollmentThisTerm = (enrollmentsQuery.data ?? []).some(
    (enrollment) =>
      enrollment.academic_term_id === selectedTermId &&
      !TERMINAL_STATUSES.has(enrollment.status),
  )

  const selectedEntries = Object.entries(selections)
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

  const totalUnits = selectedEntries.reduce(
    (sum, entry) => sum + entry.subject.units,
    0,
  )

  const mutation = useMutation({
    mutationFn: () =>
      isRegularAudience
        ? createEnrollment({
            academic_term_id: selectedTermId!,
            block_code: selectedBlockCode!,
          })
        : createEnrollment({
            academic_term_id: selectedTermId!,
            sections: selectedEntries.map((entry) => ({
              section_id: entry.section.id,
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

  const submit = async () => {
    setReceipt(false)
    setSubmitError("")
    setFieldErrors([])
    try {
      await mutation.mutateAsync()
    } catch (error) {
      if (
        isApiClientError(error) &&
        error.status === 422 &&
        error.fieldErrors
      ) {
        setFieldErrors(Object.values(error.fieldErrors).flat())
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
          Enrollment submitted and pending registrar approval. You&apos;ll get
          a queue number once it&apos;s approved — check Queue &amp; Payment
          for status.
        </AlertDescription>
      </Alert>
    ) : null

  return (
    <WorkspacePage
      title={isRegularAudience ? "Select your block" : "Select your subjects"}
      description={
        isRegularAudience
          ? "Choose the block that enrolls you in every subject for your year level at once."
          : "Select one section per eligible subject, then submit."
      }
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="enrollment-term">Academic term</FieldLabel>
          <Select
            value={selectedTermId !== null ? String(selectedTermId) : ""}
            onValueChange={(value) => {
              setSelections({})
              setSelectedBlockCode(null)
              setReceipt(false)
              setSelectedTermId(Number(value) || null)
            }}
            disabled={termsQuery.isLoading}
          >
            <SelectTrigger id="enrollment-term" className="w-full">
              <SelectValue placeholder="Select an academic term" />
            </SelectTrigger>
            <SelectContent>
              {(termsQuery.data ?? []).map((term) => (
                <SelectItem key={term.id} value={String(term.id)}>
                  {formatAcademicTerm(term)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <EnrollmentAvailabilityBanner viewer={viewer} />

      {banner}

      {selectedTermId !== null && hasActiveEnrollmentThisTerm && (
        <Alert>
          <AlertDescription>
            You already have an active enrollment for this term. View its status
            below.
          </AlertDescription>
        </Alert>
      )}

      {selectedTermId === null ? (
        <p>Select an academic term to begin enrollment.</p>
      ) : (
        !hasActiveEnrollmentThisTerm &&
        (isRegularAudience ? (
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
            emptyMessage="No blocks were generated for your year level and curriculum yet. Contact the Registrar."
            loadingLabel="Loading your blocks…"
            loadingFallback={<Skeleton className="h-48" />}
          >
            {() => (
              <div role="radiogroup" aria-label="Blocks">
                <StaggerList className="grid gap-3">
                  {blocks.map((block) => (
                    <StaggerItem key={block.block_code}>
                      <EnrollmentBlockChoice
                        block={block}
                        selected={block.block_code === selectedBlockCode}
                        onSelect={() => chooseBlock(block.block_code)}
                        disabled={enrollmentWindowClosed}
                      />
                    </StaggerItem>
                  ))}
                </StaggerList>
              </div>
            )}
          </AsyncBoundary>
        ) : (
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
                  subject.is_eligible && subject.available_sections.length > 0,
              ).length === 0
            }
            emptyMessage="No subjects currently have open sections available to select."
            loadingLabel="Loading your eligible subjects…"
            loadingFallback={<Skeleton className="h-48" />}
          >
            {() => (
              <StaggerList className="grid gap-3">
                {selectableSubjects.map((subject) => (
                  <StaggerItem key={subject.subject_id}>
                    <SectionChoice
                      subject={subject}
                      selectedSectionId={selections[subject.subject_id]}
                      onChoose={(sectionId) =>
                        chooseSection(subject.subject_id, sectionId)
                      }
                      onClear={() => clearSection(subject.subject_id)}
                      disabled={enrollmentWindowClosed}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </AsyncBoundary>
        ))
      )}

      {isRegularAudience
        ? selectedBlock &&
          !hasActiveEnrollmentThisTerm && (
            <Card className="portal-workspace-highlight">
              <CardHeader>
                <CardTitle level={2}>Review your block</CardTitle>
                <CardDescription>
                  Confirm block {selectedBlock.block_code} before submitting —
                  every subject below enrolls together.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <DataTable
                  caption="Selected block subjects"
                  rowKey={(subject) => subject.section_id}
                  rows={selectedBlock.subjects}
                  columns={[
                    {
                      key: "subject",
                      header: "Subject",
                      render: (subject) => `${subject.code} — ${subject.title}`,
                    },
                    {
                      key: "units",
                      header: "Units",
                      render: (subject) => subject.units,
                    },
                  ]}
                />
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Total units
                  </span>
                  <Badge className="text-base">{selectedBlock.total_units}</Badge>
                </div>
                <Button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={mutation.isPending || enrollmentWindowClosed}
                >
                  {mutation.isPending
                    ? "Submitting enrollment"
                    : "Submit enrollment"}
                </Button>
              </CardContent>
            </Card>
          )
        : selectedEntries.length > 0 &&
          !hasActiveEnrollmentThisTerm && (
            <Card className="portal-workspace-highlight">
              <CardHeader>
                <CardTitle level={2}>Review your enrollment</CardTitle>
                <CardDescription>
                  Confirm your selections before submitting.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <DataTable
                  caption="Selected subjects"
                  rowKey={(entry) => entry.subject.subject_id}
                  rows={selectedEntries}
                  columns={[
                    {
                      key: "subject",
                      header: "Subject",
                      render: (entry) =>
                        `${entry.subject.code} — ${entry.subject.title}`,
                    },
                    {
                      key: "section",
                      header: "Section",
                      render: (entry) => entry.section.section_code,
                    },
                    {
                      key: "units",
                      header: "Units",
                      render: (entry) => entry.subject.units,
                    },
                  ]}
                />
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <span className="text-sm font-medium text-muted-foreground">
                    Total units
                  </span>
                  <Badge className="text-base">{totalUnits}</Badge>
                </div>
                <Button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={mutation.isPending || enrollmentWindowClosed}
                >
                  {mutation.isPending
                    ? "Submitting enrollment"
                    : "Submit enrollment"}
                </Button>
              </CardContent>
            </Card>
          )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setConfirmOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm enrollment submission</AlertDialogTitle>
            <AlertDialogDescription>
              {isRegularAudience && selectedBlock ? (
                <>
                  This enrolls you in all {selectedBlock.subjects.length}{" "}
                  subjects of block {selectedBlock.block_code}, totaling{" "}
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
          <AlertDialogFooter>
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
