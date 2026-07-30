"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
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
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import {
  eligibleSubjectsQueryKey,
  enrollmentsQueryKey,
  useEligibleSubjectsQuery,
  useEnrollmentsQuery,
} from "@/features/hooks/use-enrollment"
import { useTermSelection } from "@/features/hooks/use-term-selection"
import type { EligibleSubject } from "@/features/schemas/enrollment-schema"
import { isApiClientError } from "@/features/services/api-client"
import { createEnrollment } from "@/features/services/enrollment-service"
import { formatAcademicTerm } from "@/features/services/reference-data-service"

const TERMINAL_STATUSES = new Set(["rejected", "cancelled", "withdrawn"])

export function EnrollmentWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termsQuery = useAcademicTermsQuery()
  const { selectedTermId, setSelectedTermId } = useTermSelection(
    termsQuery.data,
  )
  const eligibleSubjectsQuery = useEligibleSubjectsQuery(selectedTermId)
  const enrollmentsQuery = useEnrollmentsQuery()
  const [selections, setSelections] = useState<Record<number, number>>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<string[]>([])
  const [receipt, setReceipt] = useState<{ ticketNumber: string } | null>(null)

  const userId = session?.userId ?? null
  const subjects = eligibleSubjectsQuery.data ?? []
  const selectableSubjects = subjects.filter(
    (subject) => subject.is_eligible && subject.available_sections.length > 0,
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
      createEnrollment({
        academic_term_id: selectedTermId!,
        sections: selectedEntries.map((entry) => ({
          section_id: entry.section.id,
        })),
      }),
    onSuccess: async (enrollment) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: enrollmentsQueryKey(userId),
          exact: true,
        }),
        queryClient.invalidateQueries({
          queryKey: eligibleSubjectsQueryKey(userId, selectedTermId),
          exact: true,
        }),
      ])
      setSelections({})
      setConfirmOpen(false)
      setReceipt({ ticketNumber: enrollment.queue_ticket?.ticket_number ?? "" })
    },
  })

  const chooseSection = (subjectId: number, sectionId: number) => {
    setReceipt(null)
    setSelections((prev) => ({ ...prev, [subjectId]: sectionId }))
  }
  const clearSection = (subjectId: number) => {
    setSelections((prev) => {
      const next = { ...prev }
      delete next[subjectId]
      return next
    })
  }

  const submit = async () => {
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

  const isLoading = termsQuery.isLoading || eligibleSubjectsQuery.isFetching

  return (
    <WorkspacePage
      title="Select your subjects"
      description="Select one section per eligible subject, then submit."
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="enrollment-term">Academic term</FieldLabel>
          <select
            id="enrollment-term"
            value={selectedTermId ?? 0}
            onChange={(event) => {
              setSelections({})
              setReceipt(null)
              setSelectedTermId(Number(event.target.value) || null)
            }}
          >
            <option value={0}>Select an academic term</option>
            {(termsQuery.data ?? []).map((term) => (
              <option key={term.id} value={term.id}>
                {formatAcademicTerm(term)}
              </option>
            ))}
          </select>
        </Field>
      </FieldGroup>

      {receipt && (
        <Alert>
          <AlertDescription>
            Enrollment submitted and pending registrar approval. Queue ticket:{" "}
            {receipt.ticketNumber}.
          </AlertDescription>
        </Alert>
      )}
      {(submitError || eligibleSubjectsQuery.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {submitError ||
              "Your eligible-subject pool could not be loaded. Refresh the page and try again."}
          </AlertDescription>
        </Alert>
      )}
      {fieldErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="grid gap-1">
              {fieldErrors.map((message, index) => (
                <li key={index}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
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
      ) : isLoading ? (
        <Skeleton className="h-48" />
      ) : selectableSubjects.length === 0 ? (
        <p>No subjects currently have open sections available to select.</p>
      ) : (
        !hasActiveEnrollmentThisTerm && (
          <div className="grid gap-3">
            {selectableSubjects.map((subject) => (
              <Card
                key={subject.subject_id}
                role="article"
                aria-label={`${subject.code} ${subject.title}`}
              >
                <CardHeader>
                  <CardTitle level={3}>
                    {subject.code} — {subject.title} ({subject.units} units)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Field>
                    <FieldLabel
                      htmlFor={`section-choice-${subject.subject_id}`}
                    >
                      Section
                    </FieldLabel>
                    <select
                      id={`section-choice-${subject.subject_id}`}
                      value={selections[subject.subject_id] ?? 0}
                      onChange={(event) => {
                        const sectionId = Number(event.target.value)
                        if (sectionId)
                          chooseSection(subject.subject_id, sectionId)
                        else clearSection(subject.subject_id)
                      }}
                    >
                      <option value={0}>Not selected</option>
                      {subject.available_sections.map((section) => (
                        <option key={section.id} value={section.id}>
                          Section {section.section_code}
                          {section.schedule_days
                            ? ` · ${section.schedule_days} ${section.starts_at_time}–${section.ends_at_time}`
                            : ""}{" "}
                          · {section.remaining_seats} seats open
                        </option>
                      ))}
                    </select>
                  </Field>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {selectedEntries.length > 0 && !hasActiveEnrollmentThisTerm && (
        <Card>
          <CardHeader>
            <CardTitle level={3}>Review your enrollment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedEntries.map((entry) => (
                  <TableRow key={entry.subject.subject_id}>
                    <TableCell>
                      {entry.subject.code} — {entry.subject.title}
                    </TableCell>
                    <TableCell>{entry.section.section_code}</TableCell>
                    <TableCell>{entry.subject.units}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p>
              Total units: <Badge>{totalUnits}</Badge>
            </p>
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={mutation.isPending}
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
              This submits {selectedEntries.length} subject
              {selectedEntries.length === 1 ? "" : "s"} totaling {totalUnits}{" "}
              units for{" "}
              {termsQuery.data?.find((term) => term.id === selectedTermId)
                ? formatAcademicTerm(
                    termsQuery.data.find((term) => term.id === selectedTermId)!,
                  )
                : "the selected term"}
              . This action is recorded in the operational audit log and
              generates one queue ticket.
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
            <CardTitle level={3}>Your enrollments</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Term</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Queue ticket</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(enrollmentsQuery.data ?? []).map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell>
                      {termsQuery.data?.find(
                        (term) => term.id === enrollment.academic_term_id,
                      )
                        ? formatAcademicTerm(
                            termsQuery.data.find(
                              (term) => term.id === enrollment.academic_term_id,
                            )!,
                          )
                        : enrollment.academic_term_id}
                    </TableCell>
                    <TableCell>
                      <Badge>{enrollment.status_label}</Badge>
                    </TableCell>
                    <TableCell>{enrollment.total_units}</TableCell>
                    <TableCell>
                      {enrollment.queue_ticket?.ticket_number ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </WorkspacePage>
  )
}
