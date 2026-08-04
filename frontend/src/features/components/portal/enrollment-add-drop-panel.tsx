"use client"

import { useState } from "react"

import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldLabel } from "@/features/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import { Textarea } from "@/features/components/ui/textarea"
import {
  useCreateEnrollmentChangeRequestMutation,
  useEnrollmentChangeRequestsQuery,
} from "@/features/hooks/use-enrollment-change-requests"
import { useSectionsQuery, useSubjectsQuery } from "@/features/hooks/use-reference-data"
import type { Enrollment } from "@/features/schemas/enrollment-schema"
import { isApiClientError } from "@/features/services/api-client"

function firstApiErrorMessage(error: unknown): string | undefined {
  if (!isApiClientError(error)) return undefined
  return Object.values(error.fieldErrors ?? {})[0]?.[0]
}

type PendingDecision =
  | { kind: "drop"; sectionId: number; subjectLabel: string }
  | {
      kind: "change_section"
      fromSectionId: number
      subjectId: number
      subjectLabel: string
    }

function statusBadgeVariant(
  status: "pending" | "approved" | "rejected",
): "default" | "destructive" | "outline" {
  if (status === "approved") return "default"
  if (status === "rejected") return "destructive"
  return "outline"
}

/**
 * The Add/Drop stage of the enrollment process, embedded directly in
 * `EnrollmentWorkspace` once a student's enrollment reaches `enrolled` — no
 * longer a standalone portal module; it only ever appears as a stage of the
 * one enrollment flow, and only opens once `windowOpen` is true.
 */
export function EnrollmentAddDropPanel({
  enrollment,
  windowOpen,
  windowMessage,
  windowClosesAt,
}: {
  enrollment: Enrollment
  windowOpen: boolean
  windowMessage: string
  windowClosesAt: string | null
}) {
  const subjectsQuery = useSubjectsQuery({ enabled: windowOpen })
  const sectionsQuery = useSectionsQuery({ enabled: windowOpen })
  const requestsQuery = useEnrollmentChangeRequestsQuery(
    { page: 1, per_page: 20 },
    { enabled: windowOpen },
  )
  const createMutation = useCreateEnrollmentChangeRequestMutation()

  const [pending, setPending] = useState<PendingDecision | null>(null)
  const [reason, setReason] = useState("")
  const [toSectionId, setToSectionId] = useState<number | null>(null)
  const [error, setError] = useState("")

  const [addSubjectId, setAddSubjectId] = useState<number | null>(null)
  const [addSectionId, setAddSectionId] = useState<number | null>(null)
  const [addReason, setAddReason] = useState("")
  const [addError, setAddError] = useState("")

  const sections = sectionsQuery.data ?? []
  const heldSubjectCodes = new Set(
    enrollment.subjects
      .filter((subject) => subject.status !== "dropped")
      .map((subject) => subject.subject_code),
  )
  const addableSubjects = (subjectsQuery.data ?? []).filter(
    (subject) => !heldSubjectCodes.has(subject.code),
  )
  const sectionsForAddSubject = sections.filter(
    (section) =>
      section.subject_id === addSubjectId &&
      section.status === "published" &&
      section.remaining_seats > 0,
  )
  const sectionsForChange = sections.filter(
    (section) =>
      pending?.kind === "change_section" &&
      section.subject_id === pending.subjectId &&
      section.id !== pending.fromSectionId &&
      section.status === "published" &&
      section.remaining_seats > 0,
  )

  const reasonRequired = pending !== null && !reason.trim()
  const sectionRequired = pending?.kind === "change_section" && toSectionId === null

  const confirmPending = async () => {
    if (!pending) return
    if (reasonRequired || sectionRequired) return
    setError("")
    try {
      await createMutation.mutateAsync({
        enrollmentId: enrollment.id,
        input:
          pending.kind === "drop"
            ? {
                type: "drop",
                from_section_id: pending.sectionId,
                reason: reason.trim(),
              }
            : {
                type: "change_section",
                from_section_id: pending.fromSectionId,
                to_section_id: toSectionId!,
                reason: reason.trim(),
              },
      })
      setPending(null)
      setReason("")
      setToSectionId(null)
    } catch (submitError) {
      setError(
        firstApiErrorMessage(submitError) ??
          "The request could not be submitted. Check the connection and try again.",
      )
    }
  }

  const submitAdd = async () => {
    setAddError("")
    if (addSectionId === null || !addReason.trim()) {
      setAddError("Choose a subject, a section, and state a reason.")
      return
    }
    try {
      await createMutation.mutateAsync({
        enrollmentId: enrollment.id,
        input: {
          type: "add",
          to_section_id: addSectionId,
          reason: addReason.trim(),
        },
      })
      setAddSubjectId(null)
      setAddSectionId(null)
      setAddReason("")
    } catch (submitError) {
      setAddError(
        firstApiErrorMessage(submitError) ??
          "The request could not be submitted. Check the connection and try again.",
      )
    }
  }

  if (!windowOpen) {
    return (
      <Card>
        <CardHeader>
          <CardTitle level={2}>Add/Drop requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>{windowMessage}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {windowClosesAt && (
        <Alert>
          <AlertDescription>
            The add/drop window closes{" "}
            {new Date(windowClosesAt).toLocaleString()}.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle level={2}>Your subjects</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollment.subjects.filter((s) => s.status !== "dropped").length === 0 ? (
            <p>No active subjects on this enrollment.</p>
          ) : (
            <DataTable
              caption="Your subjects"
              rowKey={(subject) => subject.section_id}
              rows={enrollment.subjects.filter((s) => s.status !== "dropped")}
              columns={[
                {
                  key: "subject",
                  header: "Subject",
                  render: (subject) => subject.subject_title,
                },
                {
                  key: "section",
                  header: "Section",
                  render: (subject) =>
                    sections.find((s) => s.id === subject.section_id)
                      ?.section_code ?? `#${subject.section_id}`,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (subject) => (
                    <Badge variant="outline">{subject.status_label}</Badge>
                  ),
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (subject) => {
                    const currentSection = sections.find(
                      (s) => s.id === subject.section_id,
                    )
                    return (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setPending({
                              kind: "drop",
                              sectionId: subject.section_id,
                              subjectLabel: subject.subject_title,
                            })
                            setReason("")
                            setToSectionId(null)
                            setError("")
                          }}
                        >
                          Drop
                        </Button>
                        {currentSection && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPending({
                                kind: "change_section",
                                fromSectionId: subject.section_id,
                                subjectId: currentSection.subject_id,
                                subjectLabel: subject.subject_title,
                              })
                              setReason("")
                              setToSectionId(null)
                              setError("")
                            }}
                          >
                            Change section
                          </Button>
                        )}
                      </div>
                    )
                  },
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle level={2}>Add a subject</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {addError && (
            <Alert variant="destructive">
              <AlertDescription>{addError}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel htmlFor="add-drop-subject">Subject</FieldLabel>
            <Select
              value={addSubjectId !== null ? String(addSubjectId) : ""}
              onValueChange={(value) => {
                setAddSubjectId(Number(value) || null)
                setAddSectionId(null)
              }}
            >
              <SelectTrigger id="add-drop-subject" className="w-full">
                <SelectValue placeholder="Choose a subject" />
              </SelectTrigger>
              <SelectContent>
                {addableSubjects.map((subject) => (
                  <SelectItem key={subject.id} value={String(subject.id)}>
                    {subject.code} — {subject.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {addSubjectId !== null && (
            <Field>
              <FieldLabel htmlFor="add-drop-section">Section</FieldLabel>
              <Select
                value={addSectionId !== null ? String(addSectionId) : ""}
                onValueChange={(value) => setAddSectionId(Number(value) || null)}
              >
                <SelectTrigger id="add-drop-section" className="w-full">
                  <SelectValue placeholder="Choose a section" />
                </SelectTrigger>
                <SelectContent>
                  {sectionsForAddSubject.map((section) => (
                    <SelectItem key={section.id} value={String(section.id)}>
                      Section {section.section_code} ({section.remaining_seats}{" "}
                      seats open)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="add-drop-reason">Reason</FieldLabel>
            <Textarea
              id="add-drop-reason"
              value={addReason}
              onChange={(event) => setAddReason(event.target.value)}
              disabled={createMutation.isPending}
            />
          </Field>
          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => void submitAdd()}
          >
            {createMutation.isPending ? "Submitting" : "Submit request"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle level={2}>Your add/drop requests</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={{ ...requestsQuery, data: requestsQuery.data?.data }}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="You have not submitted any add/drop requests yet."
            loadingLabel="Loading your requests…"
          >
            {(requests) => (
              <DataTable
                caption="Your add/drop requests"
                rowKey={(request) => request.id}
                rows={requests}
                columns={[
                  {
                    key: "type",
                    header: "Type",
                    render: (request) => request.request_type_label,
                  },
                  {
                    key: "subject",
                    header: "Subject",
                    render: (request) => request.subject_code,
                  },
                  {
                    key: "sections",
                    header: "Sections",
                    render: (request) =>
                      [request.from_section_code, request.to_section_code]
                        .filter(Boolean)
                        .join(" → ") || "—",
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (request) => (
                      <Badge variant={statusBadgeVariant(request.status)}>
                        {request.status_label}
                      </Badge>
                    ),
                  },
                  {
                    key: "decision_reason",
                    header: "Decision reason",
                    render: (request) => request.decision_reason ?? "—",
                  },
                ]}
              />
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !createMutation.isPending) setPending(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "drop"
                ? `Drop ${pending.subjectLabel}?`
                : `Change section for ${pending?.subjectLabel}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This submits a request for Registrar Head approval — it does not
              take effect immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending?.kind === "change_section" && (
            <Field data-invalid={sectionRequired}>
              <FieldLabel htmlFor="change-section-target">
                New section
              </FieldLabel>
              <Select
                value={toSectionId !== null ? String(toSectionId) : ""}
                onValueChange={(value) => setToSectionId(Number(value) || null)}
              >
                <SelectTrigger id="change-section-target" className="w-full">
                  <SelectValue placeholder="Choose a section" />
                </SelectTrigger>
                <SelectContent>
                  {sectionsForChange.map((section) => (
                    <SelectItem key={section.id} value={String(section.id)}>
                      Section {section.section_code} ({section.remaining_seats}{" "}
                      seats open)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field data-invalid={reasonRequired}>
            <FieldLabel htmlFor="add-drop-decision-reason">Reason</FieldLabel>
            <Textarea
              id="add-drop-decision-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={createMutation.isPending}
              aria-describedby={
                reasonRequired ? "add-drop-decision-reason-error" : undefined
              }
            />
            {reasonRequired && (
              <p
                id="add-drop-decision-reason-error"
                className="text-sm text-destructive"
              >
                Reason is required.
              </p>
            )}
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={createMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={createMutation.isPending}
              onClick={() => void confirmPending()}
            >
              {createMutation.isPending ? "Submitting" : "Submit request"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
