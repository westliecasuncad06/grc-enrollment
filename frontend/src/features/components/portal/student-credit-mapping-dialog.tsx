"use client"

import { useState } from "react"
import { CheckCircle2, FilePlus2, School } from "lucide-react"

import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/features/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import {
  useCreateTransfereeCreditMutation,
  useTransfereeCreditsQuery,
} from "@/features/hooks/use-transferee-credits"
import type { TransfereeCredit } from "@/features/schemas/transferee-credit-schema"

function creditBadgeVariant(
  status: TransfereeCredit["status"],
): "default" | "destructive" | "outline" | "secondary" {
  if (status === "approved") return "default"
  if (status === "rejected") return "destructive"
  if (status === "endorsed") return "secondary"
  return "outline"
}

/** Where the request is in its route: the student's own words, not the API's. */
function creditStatusLabel(credit: TransfereeCredit): string {
  if (credit.status === "pending") return "Awaiting Program Head"
  if (credit.status === "endorsed") return "Awaiting Registrar"
  return credit.status_label
}

/**
 * The student's own "request a credit mapping" form and list. It always acts
 * for the signed-in student (the API pins the request to them and ignores any
 * student id), so it takes no student. Mapping a previous subject to a GRC
 * subject is the Program Chair's decision, and the Registrar approves it
 * (ADR 0026).
 */
export function StudentCreditMappingDialog() {
  const [open, setOpen] = useState(false)
  const [sourceInstitution, setSourceInstitution] = useState("")
  const [sourceSubjectCode, setSourceSubjectCode] = useState("")
  const [sourceSubjectTitle, setSourceSubjectTitle] = useState("")
  const [sourceGrade, setSourceGrade] = useState("")
  const [creditedUnits, setCreditedUnits] = useState("3")
  const [sourceSchoolYear, setSourceSchoolYear] = useState("")
  const [sourceSemester, setSourceSemester] = useState("")
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const creditsQuery = useTransfereeCreditsQuery(
    { page: 1, per_page: 20 },
    { enabled: open },
  )
  const createMutation = useCreateTransfereeCreditMutation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccessMessage("")

    if (!sourceInstitution.trim()) {
      setError("Please specify the previous school or institution.")
      return
    }
    if (!sourceSubjectTitle.trim()) {
      setError("Please specify the previous subject title.")
      return
    }
    const units = Number.parseFloat(creditedUnits)
    if (Number.isNaN(units) || units <= 0 || units > 99.9) {
      setError("Units must be more than 0 (for example 3 or 1.5).")
      return
    }
    if (!sourceSchoolYear.trim()) {
      setError("Please enter the school year you took the subject.")
      return
    }
    if (!sourceSemester.trim()) {
      setError("Please enter the semester you took the subject.")
      return
    }

    try {
      await createMutation.mutateAsync({
        source_institution: sourceInstitution.trim(),
        source_subject_code: sourceSubjectCode.trim().toUpperCase() || undefined,
        source_subject_title: sourceSubjectTitle.trim(),
        source_grade: sourceGrade.trim() || undefined,
        credited_units: units,
        source_school_year: sourceSchoolYear.trim(),
        source_semester: sourceSemester.trim(),
      })

      setSuccessMessage("Credit mapping request submitted. Your Program Head will map it to a subject in your curriculum, and the Registrar approves it after that.")
      setSourceSubjectCode("")
      setSourceSubjectTitle("")
      setSourceGrade("")
      setSourceSchoolYear("")
      setSourceSemester("")
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to submit credit mapping request. Please try again.",
      )
    }
  }

  const existingCredits = creditsQuery.data?.data ?? []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <FilePlus2 className="mr-1.5 size-4" />
          Request Credit Mapping
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <School className="size-5 text-primary" />
            <DialogTitle>Transferee Credit Mapping</DialogTitle>
          </div>
          <DialogDescription>
            Submit subjects previously completed at another college or university.
            Your Program Head maps each one to a subject in your GRC curriculum,
            and the Registrar approves it.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert className="border-emerald-600/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-4 py-2">
          <FieldGroup className="grid gap-3 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="source-institution">Previous School / Institution</FieldLabel>
              <Input
                id="source-institution"
                placeholder="e.g. University of the East, TIP, UST"
                value={sourceInstitution}
                onChange={(e) => setSourceInstitution(e.target.value)}
                disabled={createMutation.isPending}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="source-subject-code">Previous Subject Code (optional)</FieldLabel>
              <Input
                id="source-subject-code"
                placeholder="e.g. CS101, ENG01"
                value={sourceSubjectCode}
                onChange={(e) => setSourceSubjectCode(e.target.value)}
                disabled={createMutation.isPending}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="source-units">Units</FieldLabel>
              <Input
                id="source-units"
                type="number"
                min="0.5"
                max="99.9"
                step="0.5"
                value={creditedUnits}
                onChange={(e) => setCreditedUnits(e.target.value)}
                disabled={createMutation.isPending}
              />
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="source-subject-title">Subject Title / Description</FieldLabel>
              <Input
                id="source-subject-title"
                placeholder="e.g. Introduction to Computer Science"
                value={sourceSubjectTitle}
                onChange={(e) => setSourceSubjectTitle(e.target.value)}
                disabled={createMutation.isPending}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="source-school-year">School Year</FieldLabel>
              <Input
                id="source-school-year"
                placeholder="e.g. 2023-2024"
                value={sourceSchoolYear}
                onChange={(e) => setSourceSchoolYear(e.target.value)}
                disabled={createMutation.isPending}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="source-semester">Semester</FieldLabel>
              <Input
                id="source-semester"
                placeholder="e.g. 1st Semester, 2nd Semester"
                value={sourceSemester}
                onChange={(e) => setSourceSemester(e.target.value)}
                disabled={createMutation.isPending}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="source-grade">Grade Obtained (optional)</FieldLabel>
              <Input
                id="source-grade"
                placeholder="e.g. 1.25, 88%, A"
                value={sourceGrade}
                onChange={(e) => setSourceGrade(e.target.value)}
                disabled={createMutation.isPending}
              />
            </Field>
          </FieldGroup>

          <Button type="submit" disabled={createMutation.isPending} className="mt-2">
            {createMutation.isPending ? "Submitting Request…" : "Submit Subject for Crediting"}
          </Button>
        </form>

        {existingCredits.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Your Credited & Pending Subjects
            </h4>
            <div className="grid gap-2">
              {existingCredits.map((credit) => (
                <div
                  key={credit.id}
                  className="flex items-center justify-between rounded-lg border p-2.5 text-xs"
                >
                  <div className="grid gap-0.5">
                    <span className="font-semibold text-foreground">
                      {credit.source_subject_code
                        ? `${credit.source_subject_code} — ${credit.source_subject_title}`
                        : credit.source_subject_title}
                    </span>
                    <span className="text-muted-foreground">
                      {credit.source_institution} · {credit.credited_units} units
                      {credit.source_school_year ? ` · ${credit.source_school_year}` : ""}
                      {credit.source_semester ? ` (${credit.source_semester})` : ""}
                      {credit.source_grade ? ` · Grade: ${credit.source_grade}` : ""}
                      {credit.subject_code ? ` → Mapped to GRC ${credit.subject_code}` : ""}
                    </span>
                  </div>
                  <Badge variant={creditBadgeVariant(credit.status)}>
                    {creditStatusLabel(credit)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="mt-4 border-t pt-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
