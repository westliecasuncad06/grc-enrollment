"use client"

import { useMemo, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
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
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useClassRosterQuery } from "@/features/hooks/use-class-roster"
import {
  useAcademicGradesQuery,
  useCreateAcademicGradeMutation,
  useUpdateAcademicGradeMutation,
} from "@/features/hooks/use-academic-grades"
import { useSectionsQuery } from "@/features/hooks/use-reference-data"
import type { AcademicGrade } from "@/features/schemas/academic-grade-schema"

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"

function gradeBadgeVariant(
  status: AcademicGrade["status"],
): "default" | "secondary" | "outline" {
  if (status === "locked") return "default"
  if (status === "submitted") return "secondary"
  return "outline"
}

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

  if (!authorized) {
    return (
      <section aria-label="Grade submission workspace">
        <p>This workspace is not available for your role.</p>
      </section>
    )
  }

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
  const isLoading = rosterQuery.isLoading || gradesQuery.isLoading

  return (
    <section aria-label="Grade submission workspace" className="grid gap-4">
      <div>
        <h2>Grade submission</h2>
        <p>Select a section to record, edit, and submit its roster's grades.</p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Select a section</CardTitle>
        </CardHeader>
        <CardContent>
          {sectionsQuery.isLoading ? (
            <Skeleton className="h-8" />
          ) : ownSections.length === 0 ? (
            <p>No sections are currently assigned to your faculty account.</p>
          ) : (
            <Field>
              <FieldLabel htmlFor="grade-section">Section</FieldLabel>
              <select
                id="grade-section"
                className={selectClassName}
                value={sectionId ?? ""}
                onChange={(event) =>
                  setSectionId(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">Choose a section</option>
                {ownSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    Section {section.section_code} ({section.status_label})
                  </option>
                ))}
              </select>
            </Field>
          )}
        </CardContent>
      </Card>
      {sectionId !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Roster grades</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : rosterQuery.isError || gradesQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  This section's roster and grades could not be loaded. Refresh
                  the page and try again.
                </AlertDescription>
              </Alert>
            ) : rosterEntries.length === 0 ? (
              <p>No enrolled students are in this section yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Final grade</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rosterEntries.map((entry) => {
                    const grade = gradesByStudentId.get(entry.student_id)
                    const draft = draftFor(entry.student_id, grade)
                    const editable = !grade || grade.status === "draft"
                    const rowPending =
                      pendingStudentId === entry.student_id &&
                      (createMutation.isPending || updateMutation.isPending)

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.student_number}
                        </TableCell>
                        <TableCell>
                          {editable ? (
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
                          )}
                        </TableCell>
                        <TableCell>
                          {editable ? (
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
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={gradeBadgeVariant(
                              grade?.status ?? "draft",
                            )}
                          >
                            {grade?.status_label ?? "Not recorded"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {!grade && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={rowPending}
                              onClick={() => void recordGrade(entry.student_id)}
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
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
