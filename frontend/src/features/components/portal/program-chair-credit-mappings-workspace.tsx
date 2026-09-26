"use client"

import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { CreditReviewDialog } from "@/features/components/portal/credit-review-dialog"
import { DataTable } from "@/features/components/portal/data-table"
import { Paginator } from "@/features/components/portal/paginator"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
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
import { Input } from "@/features/components/ui/input"
import { useAcademicRecordStudentSearchQuery } from "@/features/hooks/use-academic-record"
import { useDebouncedValue } from "@/features/hooks/use-debounced-value"
import {
  useCreateTransfereeCreditMutation,
  useTransfereeCreditsQuery,
} from "@/features/hooks/use-transferee-credits"
import type { AcademicRecordStudentLookup } from "@/features/schemas/academic-record-schema"
import type { TransfereeCredit } from "@/features/schemas/transferee-credit-schema"
import { isApiClientError } from "@/features/services/api-client"

const MIN_SEARCH_LENGTH = 2

function studentLabel(credit: TransfereeCredit): string {
  return credit.student_name
    ? `${credit.student_name} (${credit.student_number})`
    : credit.student_number
}

function previousSubject(credit: TransfereeCredit): string {
  return credit.source_subject_code
    ? `${credit.source_subject_title} (${credit.source_subject_code})`
    : credit.source_subject_title
}

function takenAt(credit: TransfereeCredit): string {
  const when = [credit.source_school_year, credit.source_semester]
    .filter(Boolean)
    .join(" ")

  return when
    ? `${credit.source_institution} · ${when}`
    : credit.source_institution
}

/**
 * Credit mapping is the Program Chair's work (ADR 0026, superseding PRD §3.8's
 * "Registrar Staff process transferee credit mappings"): a student asks, the
 * Chair maps the previous subject to a subject of the student's curriculum
 * (the system suggests, the Chair decides) and endorses it, and only then does
 * Registrar Staff approve it. A student who walks in without having asked can
 * be recorded here too. A returnee from an old curriculum is not handled here:
 * the Curriculum Editor's migration already does that.
 */
export function ProgramChairCreditMappingsWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "program_chair"

  const [pendingPage, setPendingPage] = useState(1)
  const [reviewing, setReviewing] = useState<TransfereeCredit | null>(null)

  const pendingQuery = useTransfereeCreditsQuery(
    { status: "pending", page: pendingPage, per_page: 20 },
    { enabled: authorized },
  )
  const endorsedQuery = useTransfereeCreditsQuery(
    { status: "endorsed", page: 1, per_page: 20 },
    { enabled: authorized },
  )

  return (
    <WorkspacePage
      title="Credit mappings"
      description="Review students' requests to credit subjects from another school, map each one to a subject in their curriculum, and endorse it to the Registrar."
      unauthorized={!authorized}
      lastUpdated={Math.max(
        pendingQuery.dataUpdatedAt,
        endorsedQuery.dataUpdatedAt,
      )}
    >
      <Card>
        <CardHeader>
          <CardTitle level={2}>Requests to review</CardTitle>
          <CardDescription>
            Requests from students in your college that still need a mapping.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={{ ...pendingQuery, data: pendingQuery.data?.data }}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="No credit requests are waiting for review."
            loadingLabel="Loading credit requests…"
          >
            {(credits) => (
              <DataTable
                caption="Credit requests to review"
                rowKey={(credit) => credit.id}
                rows={credits}
                columns={[
                  {
                    key: "student",
                    header: "Student",
                    render: (credit) => studentLabel(credit),
                  },
                  {
                    key: "previous",
                    header: "Previous subject",
                    render: (credit) => (
                      <span className="grid gap-0.5">
                        <span>{previousSubject(credit)}</span>
                        <span className="text-xs text-muted-foreground">
                          {takenAt(credit)}
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "units",
                    header: "Units",
                    render: (credit) => credit.credited_units,
                  },
                  {
                    key: "mapped",
                    header: "Mapped to",
                    render: (credit) =>
                      credit.subject_code ? (
                        `${credit.subject_code} — ${credit.subject_title ?? ""}`
                      ) : (
                        <Badge variant="outline">Not mapped</Badge>
                      ),
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    render: (credit) => (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setReviewing(credit)}
                      >
                        Review
                      </Button>
                    ),
                  },
                ]}
              />
            )}
          </AsyncBoundary>
          <div className="mt-4">
            <Paginator
              currentPage={pendingQuery.data?.meta.current_page ?? 1}
              lastPage={pendingQuery.data?.meta.last_page ?? 1}
              onPageChange={setPendingPage}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle level={2}>Waiting for the Registrar</CardTitle>
          <CardDescription>
            Credits you have endorsed. Registrar Staff approve or reject them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={{ ...endorsedQuery, data: endorsedQuery.data?.data }}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="Nothing is waiting for the Registrar."
            loadingLabel="Loading endorsed credits…"
          >
            {(credits) => (
              <DataTable
                caption="Endorsed credits"
                rowKey={(credit) => credit.id}
                rows={credits}
                columns={[
                  {
                    key: "student",
                    header: "Student",
                    render: (credit) => studentLabel(credit),
                  },
                  {
                    key: "previous",
                    header: "Previous subject",
                    render: (credit) => previousSubject(credit),
                  },
                  {
                    key: "credited-as",
                    header: "Credited as",
                    render: (credit) =>
                      `${credit.subject_code ?? ""} — ${credit.subject_title ?? ""}`,
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (credit) => (
                      <Badge variant="secondary">{credit.status_label}</Badge>
                    ),
                  },
                ]}
              />
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>

      <RecordCreditCard />

      {reviewing && (
        <CreditReviewDialog
          key={reviewing.id}
          credit={reviewing}
          onClose={() => setReviewing(null)}
        />
      )}
    </WorkspacePage>
  )
}

/**
 * For a student who came to the Program Chair without having asked online:
 * find the student (own college only), enter what they took, and it joins the
 * review list above to be mapped and endorsed like any other request.
 */
function RecordCreditCard() {
  const [search, setSearch] = useState("")
  const [student, setStudent] = useState<AcademicRecordStudentLookup | null>(
    null,
  )
  const [institution, setInstitution] = useState("")
  const [code, setCode] = useState("")
  const [title, setTitle] = useState("")
  const [grade, setGrade] = useState("")
  const [units, setUnits] = useState("3")
  const [schoolYear, setSchoolYear] = useState("")
  const [semester, setSemester] = useState("")
  const [error, setError] = useState("")
  const [recorded, setRecorded] = useState("")

  // Look the student up 300 ms after typing stops, not on every keystroke.
  const trimmed = useDebouncedValue(search.trim(), 300)
  const lookupQuery = useAcademicRecordStudentSearchQuery(
    { search: trimmed, limit: 8 },
    { enabled: student === null && trimmed.length >= MIN_SEARCH_LENGTH },
  )
  const createMutation = useCreateTransfereeCreditMutation()

  const submit = async () => {
    setError("")
    setRecorded("")
    const parsedUnits = Number(units)

    if (student === null) {
      setError("Find and choose the student first.")
      return
    }
    if (!institution.trim() || !title.trim()) {
      setError("Enter the previous school and the subject title.")
      return
    }
    if (
      !Number.isFinite(parsedUnits) ||
      parsedUnits <= 0 ||
      parsedUnits > 99.9
    ) {
      setError("Units must be more than 0 (for example 3 or 1.5).")
      return
    }

    try {
      await createMutation.mutateAsync({
        student_id: student.student_id,
        source_institution: institution.trim(),
        source_subject_code: code.trim().toUpperCase() || undefined,
        source_subject_title: title.trim(),
        source_grade: grade.trim() || undefined,
        credited_units: parsedUnits,
        source_school_year: schoolYear.trim() || undefined,
        source_semester: semester.trim() || undefined,
      })
      setRecorded(
        `Recorded for ${student.name}. It is in the review list above, ready to map.`,
      )
      setStudent(null)
      setSearch("")
      setInstitution("")
      setCode("")
      setTitle("")
      setGrade("")
      setUnits("3")
      setSchoolYear("")
      setSemester("")
    } catch (createError) {
      const message = isApiClientError(createError)
        ? (Object.values(createError.fieldErrors ?? {})[0]?.[0] ?? "")
        : ""
      setError(
        message ||
          "The credit could not be recorded. Check the connection and try again.",
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Record a credit for a student</CardTitle>
        <CardDescription>
          For a student who did not ask online. It joins the review list above.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {recorded && (
          <Alert className="mb-4">
            <AlertDescription>{recorded}</AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          {student === null ? (
            <Field>
              <FieldLabel htmlFor="credit-student-search">
                Find student (name or student number)
              </FieldLabel>
              <Input
                id="credit-student-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="e.g. Reyes or 2024-06-01298"
              />
              {trimmed.length >= MIN_SEARCH_LENGTH && lookupQuery.isSuccess && (
                <ul className="mt-2 grid gap-1" aria-label="Matching students">
                  {(lookupQuery.data ?? []).length === 0 && (
                    <li className="text-sm text-muted-foreground">
                      No student in your college matches.
                    </li>
                  )}
                  {(lookupQuery.data ?? []).map((match) => (
                    <li key={match.student_id}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => setStudent(match)}
                      >
                        <span>{match.name}</span>
                        <span className="font-mono text-xs">
                          {match.student_number}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <span>
                <span className="font-medium">{student.name}</span>{" "}
                <span className="font-mono text-xs">
                  {student.student_number}
                </span>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStudent(null)}
              >
                Change student
              </Button>
            </div>
          )}
          <Field>
            <FieldLabel htmlFor="credit-source-institution">
              Previous school
            </FieldLabel>
            <Input
              id="credit-source-institution"
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
              disabled={createMutation.isPending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="credit-source-title">Subject title</FieldLabel>
            <Input
              id="credit-source-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={createMutation.isPending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="credit-source-code">
              Subject code (optional)
            </FieldLabel>
            <Input
              id="credit-source-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={createMutation.isPending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="credit-source-units">Units</FieldLabel>
            <Input
              id="credit-source-units"
              inputMode="decimal"
              value={units}
              onChange={(event) => setUnits(event.target.value)}
              disabled={createMutation.isPending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="credit-source-grade">
              Grade (optional)
            </FieldLabel>
            <Input
              id="credit-source-grade"
              value={grade}
              onChange={(event) => setGrade(event.target.value)}
              disabled={createMutation.isPending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="credit-source-year">
              School year (optional)
            </FieldLabel>
            <Input
              id="credit-source-year"
              value={schoolYear}
              onChange={(event) => setSchoolYear(event.target.value)}
              disabled={createMutation.isPending}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="credit-source-semester">
              Semester (optional)
            </FieldLabel>
            <Input
              id="credit-source-semester"
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              disabled={createMutation.isPending}
            />
          </Field>
          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => void submit()}
          >
            {createMutation.isPending ? "Recording credit…" : "Record credit"}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
