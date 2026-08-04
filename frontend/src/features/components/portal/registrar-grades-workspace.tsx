"use client"

import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { Paginator } from "@/features/components/portal/paginator"
import { ProspectusDocument } from "@/features/components/portal/prospectus-document"
import { GradeSlipDocument } from "@/features/components/portal/grade-slip-document"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
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
import { Input } from "@/features/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import {
  useAcademicGradesQuery,
  useUpdateAcademicGradeMutation,
} from "@/features/hooks/use-academic-grades"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import { gradeBadgeVariant } from "@/features/lib/grade-presentation"
import type { AcademicGrade } from "@/features/schemas/academic-grade-schema"
import { formatAcademicTerm } from "@/features/services/reference-data-service"

const workspaceHeadings: Record<string, string> = {
  "grade-approvals": "Grade approvals",
  "academic-transcripts": "Academic transcripts",
}

/**
 * Locking is permanent — there is no unlock/reject/return in the grade state
 * machine — so a submitted grade can only ever move forward. The confirmation
 * dialog exists for exactly this reason.
 */
export function RegistrarGradesWorkspace({
  initialModuleId = "grade-approvals",
}: {
  initialModuleId?: string
}) {
  const { session } = useAuth()
  const authorized = session?.role === "registrar_head"
  const heading =
    workspaceHeadings[initialModuleId] ?? workspaceHeadings["grade-approvals"]

  const showApprovals = authorized && initialModuleId === "grade-approvals"
  const showTranscripts =
    authorized && initialModuleId === "academic-transcripts"

  const [approvalsPage, setApprovalsPage] = useState(1)
  const [lockTarget, setLockTarget] = useState<AcademicGrade | null>(null)
  const [error, setError] = useState("")

  const [studentIdInput, setStudentIdInput] = useState("")
  const [studentId, setStudentId] = useState<number | null>(null)
  const [studentIdError, setStudentIdError] = useState("")
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null)

  const approvalsQuery = useAcademicGradesQuery(
    { status: "submitted", page: approvalsPage, per_page: 20 },
    { enabled: showApprovals },
  )
  const lockMutation = useUpdateAcademicGradeMutation()
  const termsQuery = useAcademicTermsQuery({ enabled: showTranscripts })

  const confirmLock = async () => {
    if (!lockTarget) return
    setError("")
    try {
      await lockMutation.mutateAsync({
        id: lockTarget.id,
        input: { action: "lock" },
      })
      setLockTarget(null)
    } catch {
      setError(
        "The grade could not be locked. Check the connection and try again.",
      )
    }
  }

  const viewStudent = () => {
    const parsed = Number(studentIdInput)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      setStudentIdError("Enter a valid student ID.")
      return
    }
    setStudentIdError("")
    setSelectedTermId(null)
    setStudentId(parsed)
  }

  return (
    <WorkspacePage
      title={heading}
      description="Lock submitted grades and review any student's academic transcript."
      unauthorized={!authorized}
      lastUpdated={approvalsQuery.dataUpdatedAt}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showApprovals && (
        <Card>
          <CardHeader>
            <CardTitle level={2}>Submitted grades awaiting lock</CardTitle>
          </CardHeader>
          <CardContent>
            <AsyncBoundary
              query={{ ...approvalsQuery, data: approvalsQuery.data?.data }}
              isEmpty={(rows) => rows.length === 0}
              emptyMessage="No submitted grades are awaiting lock."
              loadingLabel="Loading submitted grades…"
            >
              {(grades) => (
                <DataTable
                  caption="Submitted grades awaiting lock"
                  rowKey={(grade) => grade.id}
                  rows={grades}
                  columns={[
                    {
                      key: "student",
                      header: "Student",
                      render: (grade) => grade.student_number,
                    },
                    {
                      key: "subject",
                      header: "Subject",
                      render: (grade) => grade.subject_code,
                    },
                    {
                      key: "section",
                      header: "Section",
                      render: (grade) =>
                        grade.section_id ? `#${grade.section_id}` : "—",
                    },
                    {
                      key: "mark",
                      header: "Mark",
                      render: (grade) => grade.mark_label ?? "—",
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (grade) => (
                        <Badge variant={gradeBadgeVariant(grade.status)}>
                          {grade.status_label}
                        </Badge>
                      ),
                    },
                    {
                      key: "actions",
                      header: "Actions",
                      render: (grade) => (
                        <Button
                          type="button"
                          size="sm"
                          disabled={
                            lockMutation.isPending &&
                            lockTarget?.id === grade.id
                          }
                          onClick={() => {
                            setLockTarget(grade)
                            setError("")
                          }}
                        >
                          Lock
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </AsyncBoundary>
            <div className="mt-4">
              <Paginator
                currentPage={approvalsQuery.data?.meta.current_page ?? 1}
                lastPage={approvalsQuery.data?.meta.last_page ?? 1}
                onPageChange={setApprovalsPage}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {showTranscripts && (
        <>
          <Card>
            <CardHeader>
              <CardTitle level={2}>Look up a student</CardTitle>
            </CardHeader>
            <CardContent>
              <Field data-invalid={studentIdError !== ""}>
                <FieldLabel htmlFor="transcript-student-id">
                  Student ID
                </FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="transcript-student-id"
                    inputMode="numeric"
                    value={studentIdInput}
                    onChange={(event) =>
                      setStudentIdInput(event.target.value)
                    }
                    aria-describedby={
                      studentIdError ? "transcript-student-id-error" : undefined
                    }
                    className="max-w-xs"
                  />
                  <Button type="button" onClick={viewStudent}>
                    View records
                  </Button>
                </div>
                {studentIdError && (
                  <p
                    id="transcript-student-id-error"
                    className="text-sm text-destructive"
                  >
                    {studentIdError}
                  </p>
                )}
              </Field>
            </CardContent>
          </Card>

          {studentId !== null && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle level={2}>Prospectus</CardTitle>
                </CardHeader>
                <CardContent>
                  <ProspectusDocument studentId={studentId} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle level={2}>Grade slip</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Field className="max-w-xs">
                    <FieldLabel htmlFor="transcript-term">
                      Academic term
                    </FieldLabel>
                    <Select
                      value={
                        selectedTermId !== null ? String(selectedTermId) : ""
                      }
                      onValueChange={(value) =>
                        setSelectedTermId(Number(value) || null)
                      }
                      disabled={termsQuery.isLoading}
                    >
                      <SelectTrigger id="transcript-term" className="w-full">
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
                  {selectedTermId !== null ? (
                    <GradeSlipDocument
                      academicTermId={selectedTermId}
                      studentId={studentId}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Select an academic term to view its grade slip.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      <AlertDialog
        open={lockTarget !== null}
        onOpenChange={(open) => {
          if (!open && !lockMutation.isPending) setLockTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock this grade?</AlertDialogTitle>
            <AlertDialogDescription>
              {lockTarget && (
                <>
                  Locking <strong>{lockTarget.subject_code}</strong> for{" "}
                  <strong>{lockTarget.student_number}</strong> is permanent —
                  it can never be unlocked, edited, or re-submitted. This also
                  triggers the student&apos;s Regular/Irregular
                  reclassification.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={lockMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={lockMutation.isPending}
              onClick={() => void confirmLock()}
            >
              {lockMutation.isPending ? "Locking" : "Lock grade"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspacePage>
  )
}
