"use client"

import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

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
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { useEnrollmentScheduleQuery, useSaveEnrollmentScheduleMutation } from "@/features/hooks/use-enrollment-windows"
import { useUpdateAcademicTermMutation } from "@/features/hooks/use-reference-data"
import { useScheduleProposalsQuery } from "@/features/hooks/use-scheduling"
import { toDateInputValue } from "@/features/lib/enrollment-window-time"
import type { AcademicTerm } from "@/features/schemas/reference-data-schema"
import type {
  EnrollmentAudience,
  EnrollmentAvailabilityReason,
} from "@/features/schemas/enrollment-window-schema"

const COLLEGES = [
  { code: "ccs", label: "CCS" },
  { code: "coe", label: "COE" },
  { code: "coa", label: "COA" },
  { code: "cbae", label: "CBAE" },
] as const

const REASON_LABEL: Record<EnrollmentAvailabilityReason, string> = {
  term_not_open: "Enrollment not opened",
  term_closed: "Term closed",
  before_window: "Opens later",
  after_window: "Window closed",
  open: "Open now",
}

/**
 * Fallback only — the server sends a `label` per audience and that is what
 * renders. This exists so a row still has a name if the label is ever
 * empty, and it encodes the same ordinals ("1st Year", never "Year 1").
 */
const AUDIENCE_FALLBACK_LABEL: Record<EnrollmentAudience, string> = {
  year_1: "1st Year",
  year_2: "2nd Year",
  year_3: "3rd Year",
  year_4: "4th Year",
  irregular: "Irregular Students",
}

interface AudienceFormValues {
  enrollment_opens_at: string
  enrollment_closes_at: string
  year_1_opens_at: string
  year_1_closes_at: string
  year_2_opens_at: string
  year_2_closes_at: string
  year_3_opens_at: string
  year_3_closes_at: string
  year_4_opens_at: string
  year_4_closes_at: string
  irregular_opens_at: string
  irregular_closes_at: string
}

// Flat field names rather than a mapped `Record<EnrollmentAudience, …>`:
// React Hook Form's `Path<T>` cannot infer paths into a mapped object here.
const AUDIENCE_FIELDS = [
  { audience: "year_1", opensField: "year_1_opens_at", closesField: "year_1_closes_at" },
  { audience: "year_2", opensField: "year_2_opens_at", closesField: "year_2_closes_at" },
  { audience: "year_3", opensField: "year_3_opens_at", closesField: "year_3_closes_at" },
  { audience: "year_4", opensField: "year_4_opens_at", closesField: "year_4_closes_at" },
  { audience: "irregular", opensField: "irregular_opens_at", closesField: "irregular_closes_at" },
] as const satisfies readonly {
  audience: EnrollmentAudience
  opensField: keyof AudienceFormValues
  closesField: keyof AudienceFormValues
}[]

const EMPTY_FORM_VALUES: AudienceFormValues = {
  enrollment_opens_at: "",
  enrollment_closes_at: "",
  year_1_opens_at: "",
  year_1_closes_at: "",
  year_2_opens_at: "",
  year_2_closes_at: "",
  year_3_opens_at: "",
  year_3_closes_at: "",
  year_4_opens_at: "",
  year_4_closes_at: "",
  irregular_opens_at: "",
  irregular_closes_at: "",
}

export function EnrollmentScheduleCard({
  currentTerm,
}: {
  currentTerm: AcademicTerm
}) {
  const proposalsQuery = useScheduleProposalsQuery()
  const scheduleQuery = useEnrollmentScheduleQuery(currentTerm.id)
  const openMutation = useUpdateAcademicTermMutation()
  const saveMutation = useSaveEnrollmentScheduleMutation(currentTerm.id)
  const [openError, setOpenError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [saveReceipt, setSaveReceipt] = useState(false)

  const proposalsForTerm = (proposalsQuery.data ?? []).filter(
    (proposal) => proposal.academic_term_id === currentTerm.id,
  )
  const publishedColleges = new Set(
    proposalsForTerm
      .filter((proposal) => proposal.status === "published")
      .map((proposal) => proposal.college),
  )
  const unpublishedColleges = COLLEGES.filter(
    (college) => !publishedColleges.has(college.code),
  )
  const canOpenEnrollment =
    currentTerm.status === "draft" || currentTerm.status === "for_dean_approval"
  const isOngoing = currentTerm.status === "semester_ongoing"

  const form = useForm<AudienceFormValues>({
    defaultValues: EMPTY_FORM_VALUES,
  })

  useEffect(() => {
    const schedule = scheduleQuery.data
    if (!schedule) return

    const audienceValues = Object.fromEntries(
      AUDIENCE_FIELDS.flatMap(({ audience, opensField, closesField }) => {
        const match = schedule.audiences.find((item) => item.audience === audience)

        return [
          [opensField, toDateInputValue(match?.opens_at ?? null)],
          [closesField, toDateInputValue(match?.closes_at ?? null)],
        ]
      }),
    ) as Omit<AudienceFormValues, "enrollment_opens_at" | "enrollment_closes_at">

    form.reset({
      enrollment_opens_at: toDateInputValue(schedule.enrollment_opens_at),
      enrollment_closes_at: toDateInputValue(schedule.enrollment_closes_at),
      ...audienceValues,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when fresh server data arrives, not on every render
  }, [scheduleQuery.data])

  async function saveSchedule(values: AudienceFormValues) {
    setSaveError("")
    setOpenError("")
    setSaveReceipt(false)
    try {
      await saveMutation.mutateAsync({
        enrollment_opens_at: values.enrollment_opens_at,
        enrollment_closes_at: values.enrollment_closes_at,
        windows: AUDIENCE_FIELDS.map(({ audience, opensField, closesField }) => ({
          audience,
          opens_at: values[opensField],
          closes_at: values[closesField],
        })),
      })
      setSaveReceipt(true)

      // The schedule save always succeeds independently of the term's
      // lifecycle status — a Registrar Head may adjust dates before any
      // college has published. Opening is only attempted once that guard
      // (see `TransitionAcademicTerm`'s `open_enrollment` action) can pass,
      // so this single click both saves the dates and starts enrollment in
      // one step instead of requiring a second manual "Open enrollment"
      // click.
      if (canOpenEnrollment && publishedColleges.size > 0) {
        try {
          await openMutation.mutateAsync({
            academicTermId: currentTerm.id,
            action: "open_enrollment",
          })
          toast.success("Enrollment schedule saved. Enrollment is now open.")
        } catch {
          setOpenError(
            "The schedule was saved, but enrollment could not be opened automatically. Confirm at least one college has published its schedule, then save again.",
          )
        }
      } else {
        toast.success("Enrollment schedule saved.")
      }
    } catch {
      setSaveError(
        "The enrollment schedule could not be saved. Check the dates and try again.",
      )
    }
  }

  function resetAudienceToTermWindow(entry: (typeof AUDIENCE_FIELDS)[number]) {
    form.setValue(entry.opensField, form.getValues("enrollment_opens_at"))
    form.setValue(entry.closesField, form.getValues("enrollment_closes_at"))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrollment schedule</CardTitle>
        <CardDescription>
          Saving the schedule below opens enrollment automatically once a
          college has published its schedule, and lets you stagger which
          year level may enroll and when.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div>
          <p className="mb-2 text-sm font-medium">Publication readiness</p>
          <div className="flex flex-wrap gap-2">
            {COLLEGES.map((college) => (
              <Badge
                key={college.code}
                variant={publishedColleges.has(college.code) ? "success" : "outline"}
              >
                {college.label} {publishedColleges.has(college.code) ? "published" : "not published"}
              </Badge>
            ))}
          </div>
        </div>

        {canOpenEnrollment && (
          <div className="grid gap-2">
            {openError && (
              <Alert variant="destructive">
                <AlertDescription>{openError}</AlertDescription>
              </Alert>
            )}
            {publishedColleges.size === 0 && (
              <Alert>
                <AlertDescription>
                  Enrollment will open automatically when you save the
                  schedule below, once at least one college has published its
                  schedule. Not yet published:{" "}
                  {unpublishedColleges.map((college) => college.label).join(", ")}.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {isOngoing && scheduleQuery.data && (
          <div>
            <p className="mb-2 text-sm font-medium">Live enrollment status</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {scheduleQuery.data.audiences.map((audience) => (
                <div key={audience.audience} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {audience.label || AUDIENCE_FALLBACK_LABEL[audience.audience]}
                  </p>
                  <Badge variant={audience.is_open ? "success" : "secondary"}>
                    {REASON_LABEL[audience.reason]}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <form
          noValidate
          onSubmit={(event) => void form.handleSubmit(saveSchedule)(event)}
          className="grid gap-4 border-t pt-4"
        >
          {saveError && (
            <Alert variant="destructive">
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          {saveReceipt && (
            <Alert>
              <AlertDescription>Enrollment schedule saved.</AlertDescription>
            </Alert>
          )}
          <FieldGroup>
            <FieldDescription>
              <strong>Enrollment always starts at 8:00 AM</strong> and runs to
              the end of the closing day (11:59 PM). Pick dates only — there is
              no time to set.
            </FieldDescription>
            <div className="grid gap-3 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="schedule-term-opens">
                  Term-wide enrollment start date
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="enrollment_opens_at"
                  render={({ field }) => (
                    <Input id="schedule-term-opens" type="date" {...field} />
                  )}
                />
                <FieldDescription>Opens 8:00 AM this date.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="schedule-term-closes">
                  Term-wide enrollment deadline date
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="enrollment_closes_at"
                  render={({ field }) => (
                    <Input id="schedule-term-closes" type="date" {...field} />
                  )}
                />
                <FieldDescription>Closes 11:59 PM this date.</FieldDescription>
              </Field>
            </div>

            <div>
              <p className="text-sm font-medium">Per-audience window</p>
              <p className="text-sm text-muted-foreground">
                Each year level enrols into its own block. Irregular students
                enrol per subject during their own window and may take any
                section that still has seats.
              </p>
            </div>
            <div className="grid gap-3">
              {AUDIENCE_FIELDS.map((entry) => (
                <div
                  key={entry.audience}
                  className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_1fr_auto]"
                >
                  <p className="text-sm font-medium sm:pb-2">
                    {AUDIENCE_FALLBACK_LABEL[entry.audience]}
                  </p>
                  <Field>
                    <FieldLabel htmlFor={`schedule-${entry.opensField}`}>
                      Opens (8:00 AM)
                    </FieldLabel>
                    <Controller
                      control={form.control}
                      name={entry.opensField}
                      render={({ field }) => (
                        <Input id={`schedule-${entry.opensField}`} type="date" {...field} />
                      )}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`schedule-${entry.closesField}`}>
                      Closes (11:59 PM)
                    </FieldLabel>
                    <Controller
                      control={form.control}
                      name={entry.closesField}
                      render={({ field }) => (
                        <Input id={`schedule-${entry.closesField}`} type="date" {...field} />
                      )}
                    />
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => resetAudienceToTermWindow(entry)}
                  >
                    Same as term window
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="submit"
              disabled={saveMutation.isPending || openMutation.isPending}
            >
              {saveMutation.isPending
                ? "Saving schedule"
                : openMutation.isPending
                  ? "Opening enrollment"
                  : "Save enrollment schedule"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
