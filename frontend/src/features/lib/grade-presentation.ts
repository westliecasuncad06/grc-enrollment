import {
  academicMarkValues,
  completionOnlyMarkValues,
  gradeMarkValues,
  type AcademicGrade,
} from "@/features/schemas/academic-grade-schema"

export type GradeMarkValue = (typeof gradeMarkValues)[number]

export function gradeBadgeVariant(
  status: AcademicGrade["status"],
): "default" | "secondary" | "outline" {
  if (status === "locked") return "default"
  if (status === "submitted") return "secondary"
  return "outline"
}

/**
 * Mirrors App\Domain\Academic\GradeMark::label() — used only for the
 * encode-time dropdown's option text before a server response exists. Once
 * a grade has a server-assigned `mark`, its own `mark_label` renders
 * instead.
 */
export const gradeMarkLabel: Record<GradeMarkValue, string> = {
  "1.00": "Excellent",
  "1.25": "High Distinction",
  "1.50": "with Distinction",
  "1.75": "Very Good",
  "2.00": "Good",
  "2.25": "Very Satisfactory",
  "2.50": "Satisfactory",
  "2.75": "Fair",
  "3.00": "Passed",
  "5.00": "Failed",
  C: "Complete",
  NC: "Not Complete",
  INC: "Incomplete",
  DRP: "Dropped",
}

/**
 * Which marks a subject may take — Leadership subjects (completion-only)
 * are Complete/Not-Complete/Incomplete/Dropped only, never a numeric grade.
 */
export function allowedMarksForSubject(
  isCompletionOnly: boolean,
): readonly GradeMarkValue[] {
  return isCompletionOnly ? completionOnlyMarkValues : academicMarkValues
}
