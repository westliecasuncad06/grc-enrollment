"use client"

import { ArrowLeft, BookOpenText, ChevronRight, UserCheck } from "lucide-react"
import { useState } from "react"

import { AcademicRecordView } from "@/features/components/portal/academic-record-view"
import { DataTable } from "@/features/components/portal/data-table"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import { gradeBadgeVariant } from "@/features/lib/grade-presentation"
import type { AcademicGrade } from "@/features/schemas/academic-grade-schema"

interface SubjectGradeGroup {
  key: string
  subjectCode: string
  subjectTitle: string
  sectionCode: string | null
  grades: AcademicGrade[]
}

interface ProfessorGradeGroup {
  key: string
  professorName: string
  college: string | null
  subjects: SubjectGradeGroup[]
  totalGrades: number
}

/** The text, or null when it is missing or empty (an empty name is no name). */
function filled(value: string | null | undefined): string | null {
  return value !== undefined && value !== null && value !== "" ? value : null
}

/** Professor → subject/section → the submitted grades in it. */
export function groupGradesByProfessor(
  grades: readonly AcademicGrade[],
): ProfessorGradeGroup[] {
  const professors = new Map<string, ProfessorGradeGroup>()

  for (const grade of grades) {
    const key = String(
      grade.professor_id ?? grade.professor_name ?? "unassigned",
    )
    let professor = professors.get(key)
    if (!professor) {
      professor = {
        key,
        professorName: filled(grade.professor_name) ?? "Unassigned Faculty",
        college: filled(grade.college),
        subjects: [],
        totalGrades: 0,
      }
      professors.set(key, professor)
    }
    professor.totalGrades += 1

    const subjectKey = `${grade.subject_id}_${grade.section_id ?? "none"}`
    let subject = professor.subjects.find((item) => item.key === subjectKey)
    if (!subject) {
      subject = {
        key: subjectKey,
        subjectCode: grade.subject_code,
        subjectTitle: filled(grade.subject_title) ?? grade.subject_code,
        sectionCode: filled(grade.section_code),
        grades: [],
      }
      professor.subjects.push(subject)
    }
    subject.grades.push(grade)
  }

  return Array.from(professors.values())
}

interface StudentTarget {
  studentId: number
  name: string
  number: string
}

/**
 * The Registrar Head's grade approvals as a drill-down (stakeholder Doc 14):
 * professors, then the subjects of one professor, then the students of one
 * subject with the Lock action, then one student's grades. The department
 * filter stays with the page; this component only walks the grades it is
 * given, so locking a grade simply removes it from the next level up and the
 * view steps back on its own when a level empties.
 */
export function GradeApprovalsDrilldown({
  grades,
  lockingGradeId,
  onLock,
}: {
  grades: readonly AcademicGrade[]
  lockingGradeId: number | null
  onLock: (grade: AcademicGrade) => void
}) {
  const [professorKey, setProfessorKey] = useState<string | null>(null)
  const [subjectKey, setSubjectKey] = useState<string | null>(null)
  const [student, setStudent] = useState<StudentTarget | null>(null)

  const professors = groupGradesByProfessor(grades)
  const professor = professors.find((item) => item.key === professorKey)
  const subject = professor?.subjects.find((item) => item.key === subjectKey)

  // Level 4: one student's grades.
  if (professor && subject && student) {
    return (
      <div className="grid gap-4">
        <BackButton onClick={() => setStudent(null)}>
          Back to students
        </BackButton>
        <div className="rounded-lg border bg-card p-3">
          <p className="font-semibold">{student.name}</p>
          <p className="font-mono text-xs text-muted-foreground">
            {student.number}
          </p>
        </div>
        <AcademicRecordView studentId={student.studentId} />
      </div>
    )
  }

  // Level 3: the students of one subject, with Lock.
  if (professor && subject) {
    return (
      <div className="grid gap-4">
        <BackButton onClick={() => setSubjectKey(null)}>
          Back to {professor.professorName}&apos;s subjects
        </BackButton>
        <div className="flex flex-wrap items-center gap-2">
          <BookOpenText className="size-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold">
            {subject.subjectCode} — {subject.subjectTitle}
          </h3>
          {subject.sectionCode && (
            <Badge variant="outline">Section {subject.sectionCode}</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {subject.grades.length} student(s) awaiting lock
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
                <button
                  type="button"
                  className="flex flex-col text-left hover:underline"
                  onClick={() =>
                    setStudent({
                      studentId: grade.student_id,
                      name: filled(grade.student_name) ?? grade.student_number,
                      number: grade.student_number,
                    })
                  }
                >
                  <span className="font-medium text-foreground">
                    {filled(grade.student_name) ?? grade.student_number}
                  </span>
                  {grade.student_name && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {grade.student_number}
                    </span>
                  )}
                </button>
              ),
            },
            {
              key: "mark",
              header: "Mark",
              render: (grade) => grade.mark_label ?? grade.mark ?? "—",
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
                  disabled={lockingGradeId === grade.id}
                  onClick={() => onLock(grade)}
                >
                  Lock
                </Button>
              ),
            },
          ]}
        />
      </div>
    )
  }

  // Level 2: the subjects of one professor.
  if (professor) {
    return (
      <div className="grid gap-4">
        <BackButton onClick={() => setProfessorKey(null)}>
          Back to professors
        </BackButton>
        <div className="flex flex-wrap items-center gap-2">
          <UserCheck className="size-4 text-primary" aria-hidden />
          <h3 className="text-base font-semibold">{professor.professorName}</h3>
          <Badge variant="secondary">
            {professor.totalGrades} grade(s) awaiting lock
          </Badge>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {professor.subjects.map((item) => (
            <li key={item.key}>
              <DrillRow
                onClick={() => setSubjectKey(item.key)}
                title={`${item.subjectCode} — ${item.subjectTitle}`}
                detail={
                  item.sectionCode
                    ? `Section ${item.sectionCode}`
                    : "No section recorded"
                }
                count={`${item.grades.length} student(s)`}
              />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // Level 1: the professors.
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {professors.map((item) => (
        <li key={item.key}>
          <DrillRow
            onClick={() => {
              setProfessorKey(item.key)
              setSubjectKey(null)
              setStudent(null)
            }}
            title={item.professorName}
            detail={`${item.college ? item.college.toUpperCase() : "Faculty"} · ${item.subjects.length} subject(s) submitted`}
            count={`${item.totalGrades} grade(s) awaiting lock`}
          />
        </li>
      ))}
    </ul>
  )
}

function BackButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-fit gap-1.5"
      onClick={onClick}
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Button>
  )
}

function DrillRow({
  title,
  detail,
  count,
  onClick,
}: {
  title: string
  detail: string
  count: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/60 hover:bg-muted/30"
    >
      <span className="grid gap-0.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Badge variant="secondary">{count}</Badge>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </span>
    </button>
  )
}
