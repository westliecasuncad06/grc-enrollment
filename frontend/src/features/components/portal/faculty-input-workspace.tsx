"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { useAuth } from "@/features/auth/use-auth"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  facultyAvailabilitiesQueryKey,
  facultySubjectPreferencesQueryKey,
  useFacultyAvailabilitiesQuery,
  useFacultySubjectPreferencesQuery,
} from "@/features/hooks/use-faculty-input"
import {
  useAcademicTermsQuery,
  useSubjectsQuery,
} from "@/features/hooks/use-reference-data"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import {
  facultyAvailabilityInputSchema,
  facultySubjectPreferenceInputSchema,
  type FacultyAvailability,
  type FacultyAvailabilityInput,
  type FacultySubjectPreference,
  type FacultySubjectPreferenceInput,
} from "@/features/schemas/faculty-schema"
import {
  createFacultyAvailability,
  createFacultySubjectPreference,
  deleteFacultyAvailability,
  deleteFacultySubjectPreference,
  updateFacultyAvailability,
  updateFacultySubjectPreference,
} from "@/features/services/faculty-service"
import {
  formatAcademicTerm,
  getActiveAcademicTerm,
} from "@/features/services/reference-data-service"

const weekdays = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
] as const

const emptyAvailability: FacultyAvailabilityInput = {
  academic_term_id: 0,
  day_of_week: 1,
  starts_at_time: "",
  ends_at_time: "",
}
const emptyPreference: FacultySubjectPreferenceInput = {
  academic_term_id: 0,
  subject_id: 0,
  rank: 1,
}

function dayLabel(day: number): string {
  return weekdays.find(([value]) => value === day)?.[1] ?? "Unknown day"
}

function availabilitySummary(availability: FacultyAvailability): string {
  return `${dayLabel(availability.day_of_week)} · ${availability.starts_at_time.slice(0, 5)}–${availability.ends_at_time.slice(0, 5)}`
}

export function FacultyInputWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termsQuery = useAcademicTermsQuery()
  const subjectsQuery = useSubjectsQuery()
  const availabilitiesQuery = useFacultyAvailabilitiesQuery()
  const preferencesQuery = useFacultySubjectPreferencesQuery()
  const [editingAvailability, setEditingAvailability] =
    useState<FacultyAvailability | null>(null)
  const [editingPreference, setEditingPreference] =
    useState<FacultySubjectPreference | null>(null)
  const [removal, setRemoval] = useState<
    | { kind: "availability"; row: FacultyAvailability }
    | { kind: "preference"; row: FacultySubjectPreference }
    | null
  >(null)
  const [requestError, setRequestError] = useState("")
  const availabilityForm = useForm<FacultyAvailabilityInput>({
    resolver: zodResolver(facultyAvailabilityInputSchema),
    defaultValues: emptyAvailability,
  })
  const preferenceForm = useForm<FacultySubjectPreferenceInput>({
    resolver: zodResolver(facultySubjectPreferenceInputSchema),
    defaultValues: emptyPreference,
  })
  const userId = session?.userId ?? null

  const invalidateAvailabilities = () =>
    queryClient.invalidateQueries({
      queryKey: facultyAvailabilitiesQueryKey(userId),
      exact: true,
    })
  const invalidatePreferences = () =>
    queryClient.invalidateQueries({
      queryKey: facultySubjectPreferencesQueryKey(userId),
      exact: true,
    })

  const availabilityMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: number
      input: FacultyAvailabilityInput
    }) =>
      id === undefined
        ? createFacultyAvailability(input)
        : updateFacultyAvailability(id, input),
    onSuccess: invalidateAvailabilities,
  })
  const preferenceMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: number
      input: FacultySubjectPreferenceInput
    }) =>
      id === undefined
        ? createFacultySubjectPreference(input)
        : updateFacultySubjectPreference(id, input),
    onSuccess: invalidatePreferences,
  })
  const removalMutation = useMutation({
    mutationFn: (target: NonNullable<typeof removal>) =>
      target.kind === "availability"
        ? deleteFacultyAvailability(target.row.id)
        : deleteFacultySubjectPreference(target.row.id),
    onSuccess: async (_, target) => {
      await (target.kind === "availability"
        ? invalidateAvailabilities()
        : invalidatePreferences())
      setRemoval(null)
    },
    onError: () => setRequestError("The item could not be removed. Try again."),
  })

  const activeTerm = getActiveAcademicTerm(termsQuery.data)
  useEffect(() => {
    if (!activeTerm) return
    if (availabilityForm.getValues("academic_term_id") === 0) {
      availabilityForm.setValue("academic_term_id", activeTerm.id)
    }
    if (preferenceForm.getValues("academic_term_id") === 0) {
      preferenceForm.setValue("academic_term_id", activeTerm.id)
    }
  }, [activeTerm, availabilityForm, preferenceForm])

  const saveAvailability = async (input: FacultyAvailabilityInput) => {
    setRequestError("")
    try {
      await availabilityMutation.mutateAsync({
        id: editingAvailability?.id,
        input,
      })
      setEditingAvailability(null)
      availabilityForm.reset({
        ...emptyAvailability,
        academic_term_id: activeTerm?.id ?? 0,
      })
    } catch (error) {
      if (!applyApiFieldErrors(error, availabilityForm.setError)) {
        setRequestError(
          "Availability could not be saved. Check the connection and try again.",
        )
      }
    }
  }

  const savePreference = async (input: FacultySubjectPreferenceInput) => {
    setRequestError("")
    try {
      await preferenceMutation.mutateAsync({ id: editingPreference?.id, input })
      setEditingPreference(null)
      preferenceForm.reset({
        ...emptyPreference,
        academic_term_id: activeTerm?.id ?? 0,
      })
    } catch (error) {
      if (!applyApiFieldErrors(error, preferenceForm.setError)) {
        setRequestError(
          "Subject preference could not be saved. Check the connection and try again.",
        )
      }
    }
  }

  const startAvailabilityEdit = (row: FacultyAvailability) => {
    setEditingAvailability(row)
    availabilityForm.reset({
      academic_term_id: row.academic_term_id,
      day_of_week: row.day_of_week,
      starts_at_time: row.starts_at_time,
      ends_at_time: row.ends_at_time,
    })
  }
  const startPreferenceEdit = (row: FacultySubjectPreference) => {
    setEditingPreference(row)
    preferenceForm.reset({
      academic_term_id: row.academic_term_id,
      subject_id: row.subject_id,
      rank: row.rank,
    })
  }

  const isSaving =
    availabilityMutation.isPending || preferenceMutation.isPending
  const terms = termsQuery.data ?? []
  const subjects = subjectsQuery.data ?? []

  return (
    <section aria-label="Faculty input workspace" className="grid gap-4">
      <div>
        <h2>Availability and preferences</h2>
        <p>
          State when you can teach and rank the subjects you prefer per academic
          term.
        </p>
      </div>
      {(termsQuery.isError ||
        subjectsQuery.isError ||
        availabilitiesQuery.isError ||
        preferencesQuery.isError ||
        requestError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {requestError ||
              "Faculty input could not be loaded. Refresh the page and try again."}
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Availability windows</CardTitle>
            <CardDescription>
              Use ISO weekdays and 24-hour HH:mm:ss times.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form
              noValidate
              onSubmit={(event) =>
                void availabilityForm.handleSubmit(saveAvailability)(event)
              }
            >
              <FieldGroup>
                <Field
                  data-invalid={Boolean(
                    availabilityForm.formState.errors.academic_term_id,
                  )}
                >
                  <FieldLabel htmlFor="availability-term">
                    Academic term
                  </FieldLabel>
                  <select
                    id="availability-term"
                    disabled={isSaving || termsQuery.isLoading}
                    {...availabilityForm.register("academic_term_id", {
                      valueAsNumber: true,
                    })}
                  >
                    <option value={0}>Select an academic term</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {formatAcademicTerm(term)}
                      </option>
                    ))}
                  </select>
                  <FieldError>
                    {
                      availabilityForm.formState.errors.academic_term_id
                        ?.message
                    }
                  </FieldError>
                </Field>
                <Field
                  data-invalid={Boolean(
                    availabilityForm.formState.errors.day_of_week,
                  )}
                >
                  <FieldLabel htmlFor="availability-day">Day</FieldLabel>
                  <select
                    id="availability-day"
                    disabled={isSaving}
                    {...availabilityForm.register("day_of_week", {
                      valueAsNumber: true,
                    })}
                  >
                    {weekdays.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <FieldError>
                    {availabilityForm.formState.errors.day_of_week?.message}
                  </FieldError>
                </Field>
                <Field
                  data-invalid={Boolean(
                    availabilityForm.formState.errors.starts_at_time,
                  )}
                >
                  <FieldLabel htmlFor="availability-start">
                    Start time
                  </FieldLabel>
                  <Input
                    id="availability-start"
                    inputMode="numeric"
                    placeholder="08:00:00"
                    disabled={isSaving}
                    {...availabilityForm.register("starts_at_time")}
                  />
                  <FieldError>
                    {availabilityForm.formState.errors.starts_at_time?.message}
                  </FieldError>
                </Field>
                <Field
                  data-invalid={Boolean(
                    availabilityForm.formState.errors.ends_at_time,
                  )}
                >
                  <FieldLabel htmlFor="availability-end">End time</FieldLabel>
                  <Input
                    id="availability-end"
                    inputMode="numeric"
                    placeholder="10:00:00"
                    disabled={isSaving}
                    {...availabilityForm.register("ends_at_time")}
                  />
                  <FieldError>
                    {availabilityForm.formState.errors.ends_at_time?.message}
                  </FieldError>
                </Field>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isSaving || termsQuery.isLoading}
                  >
                    {editingAvailability
                      ? "Update availability"
                      : "Save availability"}
                  </Button>
                  {editingAvailability && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingAvailability(null)
                        availabilityForm.reset({
                          ...emptyAvailability,
                          academic_term_id: activeTerm?.id ?? 0,
                        })
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                </div>
              </FieldGroup>
            </form>
            {availabilitiesQuery.isLoading ? (
              <Skeleton className="h-20" />
            ) : availabilitiesQuery.data?.length ? (
              <ul
                className="grid gap-2"
                aria-label="Saved availability windows"
              >
                {availabilitiesQuery.data.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-3"
                  >
                    <span>{availabilitySummary(row)}</span>
                    <span className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="Edit availability"
                        onClick={() => startAvailabilityEdit(row)}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="Remove availability"
                        onClick={() =>
                          setRemoval({ kind: "availability", row })
                        }
                      >
                        Remove
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No availability windows yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subject preferences</CardTitle>
            <CardDescription>
              Rank each requested subject once for the selected term.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form
              noValidate
              onSubmit={(event) =>
                void preferenceForm.handleSubmit(savePreference)(event)
              }
            >
              <FieldGroup>
                <Field
                  data-invalid={Boolean(
                    preferenceForm.formState.errors.academic_term_id,
                  )}
                >
                  <FieldLabel htmlFor="preference-term">
                    Academic term
                  </FieldLabel>
                  <select
                    id="preference-term"
                    disabled={isSaving || termsQuery.isLoading}
                    {...preferenceForm.register("academic_term_id", {
                      valueAsNumber: true,
                    })}
                  >
                    <option value={0}>Select an academic term</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {formatAcademicTerm(term)}
                      </option>
                    ))}
                  </select>
                  <FieldError>
                    {preferenceForm.formState.errors.academic_term_id?.message}
                  </FieldError>
                </Field>
                <Field
                  data-invalid={Boolean(
                    preferenceForm.formState.errors.subject_id,
                  )}
                >
                  <FieldLabel htmlFor="preference-subject">
                    Preferred subject
                  </FieldLabel>
                  <select
                    id="preference-subject"
                    disabled={isSaving || subjectsQuery.isLoading}
                    {...preferenceForm.register("subject_id", {
                      valueAsNumber: true,
                    })}
                  >
                    <option value={0}>Select a subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.code} — {subject.title}
                      </option>
                    ))}
                  </select>
                  <FieldError>
                    {preferenceForm.formState.errors.subject_id?.message}
                  </FieldError>
                </Field>
                <Field
                  data-invalid={Boolean(preferenceForm.formState.errors.rank)}
                >
                  <FieldLabel htmlFor="preference-rank">
                    Preference rank
                  </FieldLabel>
                  <Input
                    id="preference-rank"
                    type="number"
                    min={1}
                    disabled={isSaving}
                    {...preferenceForm.register("rank", {
                      valueAsNumber: true,
                    })}
                  />
                  <FieldError>
                    {preferenceForm.formState.errors.rank?.message}
                  </FieldError>
                </Field>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={
                      isSaving ||
                      termsQuery.isLoading ||
                      subjectsQuery.isLoading
                    }
                  >
                    {editingPreference
                      ? "Update subject preference"
                      : "Save subject preference"}
                  </Button>
                  {editingPreference && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingPreference(null)
                        preferenceForm.reset({
                          ...emptyPreference,
                          academic_term_id: activeTerm?.id ?? 0,
                        })
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                </div>
              </FieldGroup>
            </form>
            {preferencesQuery.isLoading ? (
              <Skeleton className="h-20" />
            ) : preferencesQuery.data?.length ? (
              <ul className="grid gap-2" aria-label="Saved subject preferences">
                {preferencesQuery.data.map((row) => {
                  const subject = subjects.find(
                    (item) => item.id === row.subject_id,
                  )
                  return (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-2 rounded-md border p-3"
                    >
                      <span>
                        #{row.rank} ·{" "}
                        {subject
                          ? `${subject.code} — ${subject.title}`
                          : "Subject unavailable"}
                      </span>
                      <span className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label="Edit subject preference"
                          onClick={() => startPreferenceEdit(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label="Remove subject preference"
                          onClick={() =>
                            setRemoval({ kind: "preference", row })
                          }
                        >
                          Remove
                        </Button>
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p>No subject preferences yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <AlertDialog
        open={removal !== null}
        onOpenChange={(open) => {
          if (!open) setRemoval(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove{" "}
              {removal?.kind === "availability"
                ? "availability"
                : "subject preference"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action removes this faculty input from the current term.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removalMutation.isPending}>
              Keep item
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removalMutation.isPending}
              onClick={() =>
                removal && void removalMutation.mutateAsync(removal)
              }
            >
              Confirm removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
