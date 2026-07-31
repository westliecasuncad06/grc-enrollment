"use client"

import { useMemo, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
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
  useCreateAcademicGradeMutation,
  useUpdateAcademicGradeMutation,
} from "@/features/hooks/use-academic-grades"
import { useClassRosterQuery } from "@/features/hooks/use-class-roster"
import { useSectionsQuery } from "@/features/hooks/use-reference-data"
import type { AcademicGrade } from "@/features/schemas/academic-grade-schema"
import { gradeBadgeVariant } from "@/features/lib/grade-presentation"

interface Draft {
  finalGrade: string
  remarks: string
}

export function GradeSubmissionWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "faculty"
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [pendingStudentId, setPendingStudentId] = useState<number | null>(null)
  const [error, setError] = useState("")

  const sectionsQuery = useSectionsQuery({ enabled: authorized })
  const facultyId = Number(session?.userId)
  const ownSections = useMemo(() => {
    if (!Number.isSafeInteger(facultyId) || facultyId <= 0) return []
    return (sectionsQuery.data ?? []).filter(
      (section) => section.professor_id === facultyId,
    )
  }, [sectionsQuery.data, facultyId])
  const selectedSection = ownSections.find(
    (section) => section.id === sectionId,
  )

  const rosterQuery = useClassRosterQuery(
    { section_id: sectionId ?? undefined, page: 1, per_page: 100 },
    { enabled: authorized && sectionId !== null },
  )
  const gradesQuery = useAcademicGradesQuery(
    {
      subject_id: selectedSection?.subject_id,
      academic_term_id: selectedSection?.academic_term_id,
      per_page: 100,
    },
    { enabled: authorized && selectedSection !== undefined },
  )
  const createMutation = useCreateAcademicGradeMutation()
  const updateMutation = useUpdateAcademicGradeMutation()

  const gradesByStudentId = new Map(
    (gradesQuery.data?.data ?? []).map((grade) => [grade.student_id, grade]),
  )

  const draftFor = (studentId: number, grade: AcademicGrade | undefined) =>
    drafts[studentId] ?? {
      finalGrade: grade?.final_grade ?? "",
      remarks: grade?.remarks ?? "",
    }

  const setDraft = (studentId: number, next: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [studentId]: {
        ...draftFor(studentId, gradesByStudentId.get(studentId)),
        ...next,
      },
    }))
  }

  const recordGrade = async (studentId: number) => {
    if (!selectedSection) return
    setError("")
    setPendingStudentId(studentId)
    const draft = draftFor(studentId, undefined)
    try {
      await createMutation.mutateAsync({
        student_id: studentId,
        subject_id: selectedSection.subject_id,
        section_id: selectedSection.id,
        academic_term_id: selectedSection.academic_term_id,
        final_grade: draft.finalGrade.trim()
          ? Number(draft.finalGrade)
          : undefined,
        remarks: draft.remarks.trim() || undefined,
      })
    } catch {
      setError(
        "The grade could not be recorded. Check the connection and try again.",
      )
    } finally {
      setPendingStudentId(null)
    }
  }

  const saveGrade = async (grade: AcademicGrade) => {
    setError("")
    setPendingStudentId(grade.student_id)
    const draft = draftFor(grade.student_id, grade)
    try {
      await updateMutation.mutateAsync({
        id: grade.id,
        input: {
          final_grade: draft.finalGrade.trim()
            ? Number(draft.finalGrade)
            : undefined,
          remarks: draft.remarks.trim() || undefined,
        },
      })
    } catch {
      setError(
        "The grade could not be saved. Check the connection and try again.",
      )
    } finally {
      setPendingStudentId(null)
    }
  }

  const submitGrade = async (grade: AcademicGrade) => {
    setError("")
    setPendingStudentId(grade.student_id)
    try {
      await updateMutation.mutateAsync({
        id: grade.id,
        input: { action: "submit" },
      })
    } catch {
      setError(
        "The grade could not be submitted. Check the connection and try again.",
      )
    } finally {
      setPendingStudentId(null)
    }
  }

  const rosterEntries = (rosterQuery.data?.data ?? []).filter(
    (entry) => entry.status === "enrolled",
  )
  const rosterAndGradesQuery = {
    isPending: rosterQuery.isPending || gradesQuery.isPending,
    isError: rosterQuery.isError || gradesQuery.isError,
    error: rosterQuery.error ?? gradesQuery.error,
    data: rosterEntries,
    refetch: () => {
      void rosterQuery.refetch()
      void gradesQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Grade submission"
      description="Select a section to record, edit, and submit its roster's grades."
      unauthorized={!authorized}
      lastUpdated={gradesQuery.dataUpdatedAt}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle level={2}>Select a section</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={{ ...sectionsQuery, data: ownSections }}
            isEmpty={(sections) => sections.length === 0}
            emptyMessage="No sections are currently assigned to your faculty account."
            loadingLabel="Loading your assigned sections…"
          >
            {(sections) => (
              <Field>
                <FieldLabel htmlFor="grade-section">Section</FieldLabel>
                <Select
                  value={sectionId !== null ? String(sectionId) : ""}
                  onValueChange={(value) => setSectionId(Number(value))}
                >
                  <SelectTrigger id="grade-section" className="w-full">
                    <SelectValue placeholder="Choose a section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={String(section.id)}>
                        Section {section.section_code} ({section.status_label})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>
      {sectionId !== null && (
        <Card>
          <CardHeader>
            <CardTitle level={2}>Roster grades</CardTitle>
          </CardHeader>
          <CardContent>
            <AsyncBoundary
              query={rosterAndGradesQuery}
              isEmpty={(rows) => rows.length === 0}
              emptyMessage="No enrolled students are in this section yet."
              loadingLabel="Loading the roster and its recorded grades…"
            >
              {(rows) => (
                <DataTable
                  caption="Roster grades"
                  rowKey={(entry) => entry.id}
                  rows={rows}
                  columns={[
                    {
                      key: "student",
                      header: "Student",
                      render: (entry) => entry.student_number,
                    },
                    {
                      key: "final_grade",
                      header: "Final grade",
                      render: (entry) => {
                        const grade = gradesByStudentId.get(entry.student_id)
                        const draft = draftFor(entry.student_id, grade)
                        const editable = !grade || grade.status === "draft"
                        const rowPending =
                          pendingStudentId === entry.student_id &&
                          (createMutation.isPending || updateMutation.isPending)

                        return editable ? (
                          <Input
                            inputMode="decimal"
                            aria-label={`Final grade for ${entry.student_number}`}
                            value={draft.finalGrade}
                            disabled={rowPending}
                            onChange={(event) =>
                              setDraft(entry.student_id, {
                                finalGrade: event.target.value,
                              })
                            }
                          />
                        ) : (
                          (grade?.final_grade ?? "—")
                        )
                      },
                    },
                    {
                      key: "remarks",
                      header: "Remarks",
                      render: (entry) => {
                        const grade = gradesByStudentId.get(entry.student_id)
                        const draft = draftFor(entry.student_id, grade)
                        const editable = !grade || grade.status === "draft"
                        const rowPending =
                          pendingStudentId === entry.student_id &&
                          (createMutation.isPending || updateMutation.isPending)

                        return editable ? (
                          <Input
                            aria-label={`Remarks for ${entry.student_number}`}
                            value={draft.remarks}
                            disabled={rowPending}
                            onChange={(event) =>
                              setDraft(entry.student_id, {
                                remarks: event.target.value,
                              })
                            }
                          />
                        ) : (
                          (grade?.remarks ?? "—")
                        )
                      },
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (entry) => {
                        const grade = gradesByStudentId.get(entry.student_id)
                        return (
                          <Badge
                            variant={gradeBadgeVariant(
                              grade?.status ?? "draft",
                            )}
                          >
                            {grade?.status_label ?? "Not recorded"}
                          </Badge>
                        )
                      },
                    },
                    {
                      key: "actions",
                      header: "Actions",
                      render: (entry) => {
                        const grade = gradesByStudentId.get(entry.student_id)
                        const rowPending =
                          pendingStudentId === entry.student_id &&
                          (createMutation.isPending || updateMutation.isPending)

                        return (
                          <>
                            {!grade && (
                              <Button
                                type="button"
                                size="sm"
                                disabled={rowPending}
                                onClick={() =>
                                  void recordGrade(entry.student_id)
                                }
                              >
                                Record grade
                              </Button>
                            )}
                            {grade?.status === "draft" && (
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={rowPending}
                                  onClick={() => void saveGrade(grade)}
                                >
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={rowPending}
                                  onClick={() => void submitGrade(grade)}
                                >
                                  Submit
                                </Button>
                              </div>
                            )}
                          </>
                        )
                      },
                    },
                  ]}
                />
              )}
            </AsyncBoundary>
          </CardContent>
        </Card>
      )}
    </WorkspacePage>
  )
}
