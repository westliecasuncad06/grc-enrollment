"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Checkbox } from "@/features/components/ui/checkbox"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { Label } from "@/features/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import { Switch } from "@/features/components/ui/switch"
import { Textarea } from "@/features/components/ui/textarea"
import {
  useSaveStudentSchedulePreferenceMutation,
  useStudentSchedulePreferenceQuery,
} from "@/features/hooks/use-student-schedule-preference"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import {
  studentSchedulePreferenceInputSchema,
  type StudentSchedulePreference,
  type StudentSchedulePreferenceInput,
} from "@/features/schemas/student-schedule-preference-schema"

const weekdays = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
] as const

const timeBlocks = [
  ["morning", "Morning"],
  ["afternoon", "Afternoon"],
  ["evening", "Evening"],
  ["any", "No preference"],
] as const

const modalities = [
  ["hyflex_a", "Hyflex A"],
  ["hyflex_b", "Hyflex B"],
  ["f2f", "F2F"],
] as const

const NO_MODALITY_VALUE = "none"

const emptyPreferenceInput: StudentSchedulePreferenceInput = {
  preferred_days: [],
  preferred_time_block: "any",
  preferred_modality: null,
  max_days_on_campus: null,
  avoid_early_first_class: false,
  notes: "",
}

function toFormValues(
  preference: StudentSchedulePreference,
): StudentSchedulePreferenceInput {
  return {
    preferred_days: [...(preference.preferred_days ?? [])],
    preferred_time_block: preference.preferred_time_block,
    preferred_modality: preference.preferred_modality,
    max_days_on_campus: preference.max_days_on_campus,
    avoid_early_first_class: preference.avoid_early_first_class,
    notes: preference.notes ?? "",
  }
}

/**
 * The student's own schedule preference — Mon–Sat days, a time block, a
 * modality, a max-days-on-campus cap, an early-class opt-out, and free-text
 * notes. Saving it re-ranks the enrollment block and eligible-subject pools
 * (Task 2's server-side scoring reads this row), so the mutation invalidates
 * both on success (see `useSaveStudentSchedulePreferenceMutation`).
 *
 * Composed into `EnrollmentWorkspace` (Task 4) above the regular-student
 * section table — saving here invalidates that table's query, so its
 * Preference match column reflects the new preference on the very next
 * render. Not yet wired into the irregular per-subject flow.
 */
export function StudentSchedulePreferencesPanel() {
  const { session } = useAuth()
  const authorized = session?.role === "student"

  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Schedule preference</CardTitle>
        <CardDescription>
          Tell us your preferred days, time block, and modality — we use this
          to rank block and subject choices when you enroll.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {authorized ? (
          <StudentSchedulePreferencesForm />
        ) : (
          <p>This panel is not available for your role.</p>
        )}
      </CardContent>
    </Card>
  )
}

function StudentSchedulePreferencesForm() {
  const preferenceQuery = useStudentSchedulePreferenceQuery()
  const saveMutation = useSaveStudentSchedulePreferenceMutation()
  const [requestError, setRequestError] = useState("")
  const form = useForm<StudentSchedulePreferenceInput>({
    resolver: zodResolver(studentSchedulePreferenceInputSchema),
    defaultValues: emptyPreferenceInput,
  })

  useEffect(() => {
    if (preferenceQuery.data) {
      form.reset(toFormValues(preferenceQuery.data))
    }
    // `form` is stable across renders (react-hook-form memoizes it), so only
    // a new preference row should trigger a reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferenceQuery.data])

  const save = async (input: StudentSchedulePreferenceInput) => {
    setRequestError("")
    try {
      await saveMutation.mutateAsync(input)
    } catch (error) {
      if (!applyApiFieldErrors(error, form.setError))
        setRequestError(
          "Schedule preference could not be saved. Check the connection and try again.",
        )
    }
  }

  return (
    <AsyncBoundary
      query={preferenceQuery}
      loadingLabel="Loading your schedule preference…"
    >
      {() => (
        <div className="grid gap-4">
          {(saveMutation.isError || requestError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {requestError ||
                  "Schedule preference could not be saved. Check the connection and try again."}
              </AlertDescription>
            </Alert>
          )}
          <form
            noValidate
            onSubmit={(event) => void form.handleSubmit(save)(event)}
          >
            <FieldGroup>
              <Field
                data-invalid={Boolean(form.formState.errors.preferred_days)}
              >
                <FieldLabel>Preferred days</FieldLabel>
                <Controller
                  control={form.control}
                  name="preferred_days"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-4">
                      {weekdays.map(([value, label]) => {
                        const id = `student-schedule-preference-day-${value}`
                        const checked = field.value.includes(value)

                        return (
                          <div key={value} className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={checked}
                              onCheckedChange={(next) => {
                                field.onChange(
                                  next
                                    ? [...field.value, value].sort(
                                        (a, b) => a - b,
                                      )
                                    : field.value.filter(
                                        (day) => day !== value,
                                      ),
                                )
                              }}
                            />
                            <Label htmlFor={id}>{label}</Label>
                          </div>
                        )
                      })}
                    </div>
                  )}
                />
                <FieldError>
                  {form.formState.errors.preferred_days?.message}
                </FieldError>
              </Field>

              <Field
                data-invalid={Boolean(
                  form.formState.errors.preferred_time_block,
                )}
              >
                <FieldLabel htmlFor="student-schedule-preference-time-block">
                  Preferred time block
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="preferred_time_block"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="student-schedule-preference-time-block"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeBlocks.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>
                  {form.formState.errors.preferred_time_block?.message}
                </FieldError>
              </Field>

              <Field
                data-invalid={Boolean(
                  form.formState.errors.preferred_modality,
                )}
              >
                <FieldLabel htmlFor="student-schedule-preference-modality">
                  Preferred modality
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="preferred_modality"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? NO_MODALITY_VALUE}
                      onValueChange={(value) =>
                        field.onChange(
                          value === NO_MODALITY_VALUE ? null : value,
                        )
                      }
                    >
                      <SelectTrigger
                        id="student-schedule-preference-modality"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_MODALITY_VALUE}>
                          No preference
                        </SelectItem>
                        {modalities.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>
                  {form.formState.errors.preferred_modality?.message}
                </FieldError>
              </Field>

              <Field
                data-invalid={Boolean(
                  form.formState.errors.max_days_on_campus,
                )}
              >
                <FieldLabel htmlFor="student-schedule-preference-max-days">
                  Maximum days on campus
                </FieldLabel>
                <Controller
                  control={form.control}
                  name="max_days_on_campus"
                  render={({ field }) => (
                    <Input
                      id="student-schedule-preference-max-days"
                      type="number"
                      min={1}
                      max={6}
                      value={field.value ?? ""}
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                        )
                      }
                      placeholder="No limit"
                    />
                  )}
                />
                <FieldError>
                  {form.formState.errors.max_days_on_campus?.message}
                </FieldError>
              </Field>

              <Field orientation="horizontal">
                <Controller
                  control={form.control}
                  name="avoid_early_first_class"
                  render={({ field }) => (
                    <Switch
                      id="student-schedule-preference-avoid-early"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <FieldLabel htmlFor="student-schedule-preference-avoid-early">
                  Avoid an early first class
                </FieldLabel>
              </Field>

              <Field data-invalid={Boolean(form.formState.errors.notes)}>
                <FieldLabel htmlFor="student-schedule-preference-notes">
                  Notes
                </FieldLabel>
                <Textarea
                  id="student-schedule-preference-notes"
                  disabled={saveMutation.isPending}
                  {...form.register("notes")}
                />
                <FieldError>{form.formState.errors.notes?.message}</FieldError>
              </Field>

              <div>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending
                    ? "Saving…"
                    : "Save my schedule preference"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </div>
      )}
    </AsyncBoundary>
  )
}
