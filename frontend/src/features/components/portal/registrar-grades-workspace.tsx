"use client"

import { useState } from "react"
import {
  BookOpenText,
  Clock3,
  History,
  Search,
  UserCheck,
} from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { AcademicRecordView } from "@/features/components/portal/academic-record-view"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { Paginator } from "@/features/components/portal/paginator"
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
  useAcademicGradesQuery,
  useUpdateAcademicGradeMutation,
} from "@/features/hooks/use-academic-grades"
import { gradeBadgeVariant } from "@/features/lib/grade-presentation"
import type { AcademicGrade } from "@/features/schemas/academic-grade-schema"

const workspaceHeadings: Record<string, string> = {
  "grade-approvals": "Grade approvals",
  "academic-transcripts": "Academic transcripts",
}

const departments = [
  { id: "all", label: "All Departments" },
  { id: "ccs", label: "CCS" },
  { id: "cbae", label: "CBAE" },
  { id: "coe", label: "COE" },
  { id: "coa", label: "COA" },
] as const

interface SubjectGradeGroup {
  subjectId: number
  subjectCode: string
  subjectTitle: string
  sectionId: number | null
  sectionCode: string | null
  grades: AcademicGrade[]
}

interface ProfessorGradeGroup {
  professorId: number | null
  professorName: string
  college: string | null
  subjects: SubjectGradeGroup[]
  totalGrades: number
}

function groupGradesByProfessor(
  grades: readonly AcademicGrade[],
): ProfessorGradeGroup[] {
  const profMap = new Map<string, ProfessorGradeGroup>()

  for (const grade of grades) {
    const profKey = String(
      grade.professor_id ?? grade.professor_name ?? "unassigned",
    )
    const profName = grade.professor_name || "Unassigned Faculty"
    const college = grade.college || null

    let profGroup = profMap.get(profKey)
    if (!profGroup) {
      profGroup = {
        professorId: grade.professor_id ?? null,
        professorName: profName,
        college,
        subjects: [],
        totalGrades: 0,
      }
      profMap.set(profKey, profGroup)
    }

    profGroup.totalGrades += 1

    let subjectGroup = profGroup.subjects.find(
      (s) =>
        s.subjectId === grade.subject_id && s.sectionId === grade.section_id,
    )
    if (!subjectGroup) {
      subjectGroup = {
        subjectId: grade.subject_id,
        subjectCode: grade.subject_code,
        subjectTitle: grade.subject_title || grade.subject_code,
        sectionId: grade.section_id,
        sectionCode: grade.section_code || null,
        grades: [],
      }
      profGroup.subjects.push(subjectGroup)
    }

    subjectGroup.grades.push(grade)
  }

  return Array.from(profMap.values())
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

  const [activeTab, setActiveTab] = useState<"approvals" | "history">(
    "approvals",
  )
  const [approvalsDepartment, setApprovalsDepartment] = useState<string>("all")
  const [approvalsPage, setApprovalsPage] = useState(1)
  const [lockTarget, setLockTarget] = useState<AcademicGrade | null>(null)
  const [error, setError] = useState("")

  const [historyDepartment, setHistoryDepartment] = useState<string>("all")
  const [historyPage, setHistoryPage] = useState(1)
  const [historySearchInput, setHistorySearchInput] = useState("")
  const [historySearch, setHistorySearch] = useState("")

  const [studentIdInput, setStudentIdInput] = useState("")
  const [studentId, setStudentId] = useState<number | null>(null)
  const [studentIdError, setStudentIdError] = useState("")

  const approvalsQuery = useAcademicGradesQuery(
    {
      status: "submitted",
      college: approvalsDepartment === "all" ? undefined : approvalsDepartment,
      page: approvalsPage,
      per_page: 50,
    },
    { enabled: showApprovals && activeTab === "approvals" },
  )

  const historyQuery = useAcademicGradesQuery(
    {
      status: "locked",
      college: historyDepartment === "all" ? undefined : historyDepartment,
      search: historySearch.trim() || undefined,
      page: historyPage,
      per_page: 20,
    },
    { enabled: showApprovals && activeTab === "history" },
  )

  const lockMutation = useUpdateAcademicGradeMutation()

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
    setStudentId(parsed)
  }

  return (
    <WorkspacePage
      title={heading}
      description="Lock submitted grades and review any student's academic transcript."
      unauthorized={!authorized}
      lastUpdated={
        activeTab === "approvals"
          ? approvalsQuery.dataUpdatedAt
          : historyQuery.dataUpdatedAt
      }
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {showApprovals && (
        <div className="space-y-4">
          <div
            className="flex items-center gap-2 border-b pb-2"
            role="group"
            aria-label="Approvals view"
          >
            <Button
              type="button"
              variant={activeTab === "approvals" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setActiveTab("approvals")}
            >
              <Clock3 className="size-4" aria-hidden />
              Pending approvals
              {approvalsQuery.data?.meta.total !== undefined && (
                <Badge
                  variant={activeTab === "approvals" ? "secondary" : "outline"}
                  className="ml-1 px-1.5 py-0 text-[10px]"
                >
                  {approvalsQuery.data.meta.total}
                </Badge>
              )}
            </Button>
            <Button
              type="button"
              variant={activeTab === "history" ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setActiveTab("history")}
            >
              <History className="size-4" aria-hidden />
              Grade history
            </Button>
          </div>

          {activeTab === "approvals" && (
            <Card>
              <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle level={2}>Submitted grades awaiting lock</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Grouped by Department → Professor → Submitted Subjects
                  </p>
                </div>
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="group"
                  aria-label="Filter by department"
                >
                  {departments.map((dept) => (
                    <Button
                      key={dept.id}
                      type="button"
                      variant={
                        approvalsDepartment === dept.id ? "default" : "outline"
                      }
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setApprovalsDepartment(dept.id)
                        setApprovalsPage(1)
                      }}
                    >
                      {dept.label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <AsyncBoundary
                  query={{
                    ...approvalsQuery,
                    data: approvalsQuery.data?.data,
                  }}
                  isEmpty={(rows) => rows.length === 0}
                  emptyMessage="No submitted grades are awaiting lock."
                  loadingLabel="Loading submitted grades…"
                >
                  {(grades) => {
                    const professorGroups = groupGradesByProfessor(grades)

                    return (
                      <div className="space-y-6">
                        {professorGroups.map((profGroup) => (
                          <Card
                            key={
                              profGroup.professorId ?? profGroup.professorName
                            }
                            className="overflow-hidden border-border/80"
                          >
                            <CardHeader className="bg-muted/30 border-b pb-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                                    <UserCheck className="size-4" aria-hidden />
                                  </div>
                                  <div>
                                    <CardTitle
                                      level={3}
                                      className="text-base font-semibold"
                                    >
                                      {profGroup.professorName}
                                    </CardTitle>
                                    <p className="text-xs text-muted-foreground">
                                      {profGroup.college
                                        ? profGroup.college.toUpperCase()
                                        : "Faculty"}{" "}
                                      · {profGroup.subjects.length} subject(s)
                                      submitted
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="secondary">
                                  {profGroup.totalGrades} grade(s) awaiting lock
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-4">
                              {profGroup.subjects.map((subject) => (
                                <div
                                  key={`${subject.subjectId}_${subject.sectionId}`}
                                  className="rounded-lg border bg-card p-3 shadow-2xs"
                                >
                                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                                    <div className="flex items-center gap-2">
                                      <BookOpenText
                                        className="size-4 text-primary"
                                        aria-hidden
                                      />
                                      <span className="font-semibold text-sm">
                                        {subject.subjectCode} —{" "}
                                        {subject.subjectTitle}
                                      </span>
                                      {subject.sectionCode && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs"
                                        >
                                          Section {subject.sectionCode}
                                        </Badge>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {subject.grades.length} student(s)
                                    </span>
                                  </div>
                                  <DataTable
                                    caption="Submitted grades awaiting lock"
                                    rowKey={(grade) => grade.id}
                                    rows={subject.grades}
                                    columns={[
                                      {
                                        key: "student",
                                        header: "Student",
                                        render: (grade) => (
                                          <div className="flex flex-col">
                                            <span className="font-medium text-foreground">
                                              {grade.student_name ||
                                                grade.student_number}
                                            </span>
                                            {grade.student_name && (
                                              <span className="font-mono text-xs text-muted-foreground">
                                                {grade.student_number}
                                              </span>
                                            )}
                                          </div>
                                        ),
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
                                          grade.section_code ??
                                          (grade.section_id
                                            ? `#${grade.section_id}`
                                            : "—"),
                                      },
                                      {
                                        key: "mark",
                                        header: "Mark",
                                        render: (grade) =>
                                          grade.mark_label ??
                                          grade.mark ??
                                          "—",
                                      },
                                      {
                                        key: "status",
                                        header: "Status",
                                        render: (grade) => (
                                          <Badge
                                            variant={gradeBadgeVariant(
                                              grade.status,
                                            )}
                                          >
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
                                </div>
                              ))}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )
                  }}
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

          {activeTab === "history" && (
            <Card>
              <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle level={2}>Official Grade History</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Archived and official locked grades across all semesters
                  </p>
                </div>
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="group"
                  aria-label="Filter grade history by department"
                >
                  {departments.map((dept) => (
                    <Button
                      key={dept.id}
                      type="button"
                      variant={
                        historyDepartment === dept.id ? "default" : "outline"
                      }
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setHistoryDepartment(dept.id)
                        setHistoryPage(1)
                      }}
                    >
                      {dept.label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-64 max-w-md">
                    <Search
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      placeholder="Search by student number, student name, or subject..."
                      value={historySearchInput}
                      onChange={(e) => setHistorySearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          setHistorySearch(historySearchInput)
                          setHistoryPage(1)
                        }
                      }}
                      className="pl-9 h-9 text-sm"
                      aria-label="Search grade history"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                      setHistorySearch(historySearchInput)
                      setHistoryPage(1)
                    }}
                  >
                    Search
                  </Button>
                  {historySearch && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 text-xs"
                      onClick={() => {
                        setHistorySearchInput("")
                        setHistorySearch("")
                        setHistoryPage(1)
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <AsyncBoundary
                  query={{
                    ...historyQuery,
                    data: historyQuery.data?.data,
                  }}
                  isEmpty={(rows) => rows.length === 0}
                  emptyMessage="No historical grade records found matching the criteria."
                  loadingLabel="Loading grade history…"
                >
                  {(grades) => (
                    <DataTable
                      caption="Official Grade History"
                      rowKey={(grade) => grade.id}
                      rows={grades}
                      columns={[
                        {
                          key: "term",
                          header: "Term",
                          render: (grade) => (
                            <span className="font-mono text-xs">
                              {grade.school_year && grade.semester
                                ? `${grade.school_year} · ${grade.semester}`
                                : "—"}
                            </span>
                          ),
                        },
                        {
                          key: "student",
                          header: "Student",
                          render: (grade) => (
                            <div>
                              <p className="font-medium text-foreground">
                                {grade.student_name || grade.student_number}
                              </p>
                              {grade.student_name && (
                                <p className="font-mono text-xs text-muted-foreground">
                                  {grade.student_number}
                                </p>
                              )}
                            </div>
                          ),
                        },
                        {
                          key: "college",
                          header: "Dept",
                          render: (grade) => (
                            <Badge variant="outline" className="text-xs">
                              {grade.college ? grade.college.toUpperCase() : "—"}
                            </Badge>
                          ),
                        },
                        {
                          key: "subject",
                          header: "Subject",
                          render: (grade) => (
                            <div>
                              <p className="font-mono font-medium text-xs text-primary">
                                {grade.subject_code}
                              </p>
                              {grade.subject_title && (
                                <p className="text-xs text-muted-foreground truncate max-w-56">
                                  {grade.subject_title}
                                </p>
                              )}
                            </div>
                          ),
                        },
                        {
                          key: "section",
                          header: "Section",
                          render: (grade) =>
                            grade.section_code ??
                            (grade.section_id ? `#${grade.section_id}` : "—"),
                        },
                        {
                          key: "professor",
                          header: "Professor",
                          render: (grade) => (
                            <span className="text-xs">
                              {grade.professor_name ?? "—"}
                            </span>
                          ),
                        },
                        {
                          key: "mark",
                          header: "Mark",
                          render: (grade) => (
                            <span className="font-semibold">
                              {grade.mark
                                ? `${grade.mark} — ${grade.mark_label ?? ""}`
                                : "—"}
                            </span>
                          ),
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
                      ]}
                    />
                  )}
                </AsyncBoundary>
                <div className="mt-4">
                  <Paginator
                    currentPage={historyQuery.data?.meta.current_page ?? 1}
                    lastPage={historyQuery.data?.meta.last_page ?? 1}
                    onPageChange={setHistoryPage}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
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

          {studentId !== null && <AcademicRecordView studentId={studentId} />}
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
