"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
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
  // Unlike the Controller-only-`defaultValue` pattern used elsewhere (see
  // ADR 0015), these two forms render unconditionally — not gated behind
  // AsyncBoundary — so each `academic_term_id` Controller mounts immediately,
  // well before the active term is known, and stays mounted (no `key` swap)
  // once it resolves. That makes the classic `useEffect` + `form.setValue()`
  // populate-once-loaded pattern the correct one here: the Controller is
  // already stably registered by the time the effect fires, so the update
  // reaches it cleanly (the opposite of the late-mounting-Controller race
  // this same pattern would hit if the field were AsyncBoundary-gated).
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
    <WorkspacePage
      title="Availability and preferences"
      description="State when you can teach and rank the subjects you prefer per academic term."
      lastUpdated={availabilitiesQuery.dataUpdatedAt}
    >
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
      <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/30 p-3">
        <Button
          type="button"
          onClick={() => document.getElementById("availability-term")?.focus()}
        >
          Set availability window
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById("preference-subject")?.focus()}
        >
          Add subject preference
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle level={2}>Availability windows</CardTitle>
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
                  <Controller
                    control={availabilityForm.control}
                    name="academic_term_id"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) => field.onChange(Number(value))}
                        disabled={isSaving || termsQuery.isLoading}
                      >
                        <SelectTrigger
                          id="availability-term"
                          className="w-full"
                        >
                          <SelectValue placeholder="Select an academic term" />
                        </SelectTrigger>
                        <SelectContent>
                          {terms.map((term) => (
                            <SelectItem key={term.id} value={String(term.id)}>
                              {formatAcademicTerm(term)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
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
                  <Controller
                    control={availabilityForm.control}
                    name="day_of_week"
                    render={({ field }) => (
                      <Select
                        value={String(field.value)}
                        onValueChange={(value) => field.onChange(Number(value))}
                        disabled={isSaving}
                      >
                        <SelectTrigger id="availability-day" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {weekdays.map(([value, label]) => (
                            <SelectItem key={value} value={String(value)}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
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
            <AsyncBoundary
              query={availabilitiesQuery}
              isEmpty={(rows) => rows.length === 0}
              emptyMessage="No availability windows yet."
              loadingLabel="Loading your availability windows…"
            >
              {(rows) => (
                <div className="overflow-x-auto rounded-md border">
                  <Table aria-label="Saved availability windows">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Availability window</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{dayLabel(row.day_of_week)}</TableCell>
                          <TableCell>
                            {availabilitySummary(row).split(" · ")[1]}
                            <span className="sr-only">{availabilitySummary(row)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="inline-flex gap-2">
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
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </AsyncBoundary>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle level={2}>Subject preferences</CardTitle>
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
                  <Controller
                    control={preferenceForm.control}
                    name="academic_term_id"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) => field.onChange(Number(value))}
                        disabled={isSaving || termsQuery.isLoading}
                      >
                        <SelectTrigger id="preference-term" className="w-full">
                          <SelectValue placeholder="Select an academic term" />
                        </SelectTrigger>
                        <SelectContent>
                          {terms.map((term) => (
                            <SelectItem key={term.id} value={String(term.id)}>
                              {formatAcademicTerm(term)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
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
                  <Controller
                    control={preferenceForm.control}
                    name="subject_id"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) => field.onChange(Number(value))}
                        disabled={isSaving || subjectsQuery.isLoading}
                      >
                        <SelectTrigger
                          id="preference-subject"
                          className="w-full"
                        >
                          <SelectValue placeholder="Select a subject" />
                        </SelectTrigger>
                        <SelectContent>
                          {subjects.map((subject) => (
                            <SelectItem
                              key={subject.id}
                              value={String(subject.id)}
                            >
                              {subject.code} — {subject.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
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
            <AsyncBoundary
              query={preferencesQuery}
              isEmpty={(rows) => rows.length === 0}
              emptyMessage="No subject preferences yet."
              loadingLabel="Loading your subject preferences…"
            >
              {(rows) => (
                <div className="overflow-x-auto rounded-md border">
                  <Table aria-label="Saved subject preferences">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Preferred subject</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                    const subject = subjects.find(
                      (item) => item.id === row.subject_id,
                    )
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">#{row.rank}</TableCell>
                        <TableCell>
                          {subject
                            ? `${subject.code} — ${subject.title}`
                            : "Subject unavailable"}
                          <span className="sr-only">
                            #{row.rank} · {subject
                              ? `${subject.code} — ${subject.title}`
                              : "Subject unavailable"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex gap-2">
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
                        </TableCell>
                      </TableRow>
                    )
                  })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </AsyncBoundary>
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
    </WorkspacePage>
  )
}
