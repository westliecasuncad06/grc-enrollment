"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
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
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
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
  facultyCurriculumSubjectPreferencesQueryKey,
  useFacultyAvailabilitiesQuery,
  useFacultyCurriculumSubjectPreferencesQuery,
  useFacultyPreferenceCatalogQuery,
  useFacultyTeachingHistoryQuery,
} from "@/features/hooks/use-faculty-input"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import {
  facultyAvailabilityInputSchema,
  facultyCurriculumSubjectPreferenceInputSchema,
  type FacultyAvailability,
  type FacultyAvailabilityInput,
  type FacultyCurriculumSubjectPreference,
  type FacultyCurriculumSubjectPreferenceInput,
} from "@/features/schemas/faculty-schema"
import {
  createFacultyAvailability,
  createFacultyCurriculumSubjectPreference,
  deleteFacultyAvailability,
  deleteFacultyCurriculumSubjectPreference,
  updateFacultyAvailability,
  updateFacultyCurriculumSubjectPreference,
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
const emptyPreference: FacultyCurriculumSubjectPreferenceInput = {
  curriculum_id: 0,
  semester: "1st",
  subject_id: 0,
  rank: 1,
}

type Removal =
  | { kind: "availability"; row: FacultyAvailability }
  | { kind: "preference"; row: FacultyCurriculumSubjectPreference }

function dayLabel(day: number): string {
  return weekdays.find(([value]) => value === day)?.[1] ?? "Unknown day"
}

function availabilitySummary(row: FacultyAvailability): string {
  return `${dayLabel(row.day_of_week)} · ${row.starts_at_time.slice(0, 5)}–${row.ends_at_time.slice(0, 5)}`
}

export function FacultyInputWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termsQuery = useAcademicTermsQuery()
  const availabilitiesQuery = useFacultyAvailabilitiesQuery()
  const catalogQuery = useFacultyPreferenceCatalogQuery()
  const preferencesQuery = useFacultyCurriculumSubjectPreferencesQuery()
  const historyQuery = useFacultyTeachingHistoryQuery()
  const userId = session?.userId ?? null
  const [editingAvailability, setEditingAvailability] =
    useState<FacultyAvailability | null>(null)
  const [editingPreference, setEditingPreference] =
    useState<FacultyCurriculumSubjectPreference | null>(null)
  const [removal, setRemoval] = useState<Removal | null>(null)
  const [preferenceSearch, setPreferenceSearch] = useState("")
  const [requestError, setRequestError] = useState("")

  const availabilityForm = useForm<FacultyAvailabilityInput>({
    resolver: zodResolver(facultyAvailabilityInputSchema),
    defaultValues: emptyAvailability,
  })
  const preferenceForm = useForm<FacultyCurriculumSubjectPreferenceInput>({
    resolver: zodResolver(facultyCurriculumSubjectPreferenceInputSchema),
    defaultValues: emptyPreference,
  })
  const selectedCurriculumId = preferenceForm.watch("curriculum_id")
  const selectedSemester = preferenceForm.watch("semester")

  const invalidateAvailabilities = () =>
    queryClient.invalidateQueries({
      queryKey: facultyAvailabilitiesQueryKey(userId),
      exact: true,
    })
  const invalidatePreferences = () =>
    queryClient.invalidateQueries({
      queryKey: facultyCurriculumSubjectPreferencesQueryKey(userId),
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
      input: FacultyCurriculumSubjectPreferenceInput
    }) =>
      id === undefined
        ? createFacultyCurriculumSubjectPreference(input)
        : updateFacultyCurriculumSubjectPreference(id, input),
    onSuccess: invalidatePreferences,
  })
  const removalMutation = useMutation({
    mutationFn: (target: Removal) =>
      target.kind === "availability"
        ? deleteFacultyAvailability(target.row.id)
        : deleteFacultyCurriculumSubjectPreference(target.row.id),
    onSuccess: async (_result, target) => {
      await (target.kind === "availability"
        ? invalidateAvailabilities()
        : invalidatePreferences())
      setRemoval(null)
    },
    onError: () => setRequestError("The item could not be removed. Try again."),
  })

  const activeTerm = getActiveAcademicTerm(termsQuery.data)
  useEffect(() => {
    if (activeTerm && availabilityForm.getValues("academic_term_id") === 0) {
      availabilityForm.setValue("academic_term_id", activeTerm.id)
    }
  }, [activeTerm, availabilityForm])
  useEffect(() => {
    if (selectedCurriculumId === 0 && catalogQuery.data?.[0]) {
      preferenceForm.setValue(
        "curriculum_id",
        catalogQuery.data[0].curriculum_id,
      )
    }
  }, [catalogQuery.data, preferenceForm, selectedCurriculumId])

  const selectedCurriculum = catalogQuery.data?.find(
    (entry) => entry.curriculum_id === selectedCurriculumId,
  )
  const curriculumSubjects =
    selectedCurriculum?.semesters.find(
      (entry) => entry.semester === selectedSemester,
    )?.subjects ?? []
  const subjectOptions = curriculumSubjects.map((subject) => ({
    value: String(subject.id),
    label: `${subject.code} — ${subject.title}`,
  }))
  const subjectsById = useMemo(
    () =>
      new Map(
        (catalogQuery.data ?? [])
          .flatMap((entry) =>
            entry.semesters.flatMap((semester) => semester.subjects),
          )
          .map((subject) => [subject.id, subject]),
      ),
    [catalogQuery.data],
  )
  const savedPreferences = (preferencesQuery.data ?? []).filter((row) => {
    const subject = subjectsById.get(row.subject_id)
    const text = `${subject?.code ?? ""} ${subject?.title ?? ""}`.toLowerCase()
    return (
      row.curriculum_id === selectedCurriculumId &&
      row.semester === selectedSemester &&
      text.includes(preferenceSearch.toLowerCase())
    )
  })

  const isSaving =
    availabilityMutation.isPending || preferenceMutation.isPending
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
      if (!applyApiFieldErrors(error, availabilityForm.setError))
        setRequestError(
          "Availability could not be saved. Check the connection and try again.",
        )
    }
  }
  const savePreference = async (
    input: FacultyCurriculumSubjectPreferenceInput,
  ) => {
    setRequestError("")
    try {
      await preferenceMutation.mutateAsync({ id: editingPreference?.id, input })
      setEditingPreference(null)
      preferenceForm.reset({
        curriculum_id: input.curriculum_id,
        semester: input.semester,
        subject_id: 0,
        rank: 1,
      })
    } catch (error) {
      if (!applyApiFieldErrors(error, preferenceForm.setError))
        setRequestError(
          "Subject preference could not be saved. Check the connection and try again.",
        )
    }
  }

  const inputErrors =
    termsQuery.isError ||
    availabilitiesQuery.isError ||
    catalogQuery.isError ||
    preferencesQuery.isError ||
    historyQuery.isError

  return (
    <WorkspacePage
      title="Availability and preferences"
      description="Declare teaching availability, then rank curriculum subjects for each semester. The schedule recommendation uses these preferences as advisory evidence."
      lastUpdated={Math.max(
        availabilitiesQuery.dataUpdatedAt,
        preferencesQuery.dataUpdatedAt,
        historyQuery.dataUpdatedAt,
      )}
    >
      {(inputErrors || requestError) && (
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
          onClick={() =>
            document.getElementById("preference-curriculum")?.focus()
          }
        >
          Add subject preference
        </Button>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle level={2}>Availability windows</CardTitle>
            <CardDescription>
              Use your actual academic-term availability. Times are checked
              before recommendation.
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
                          {(termsQuery.data ?? []).map((term) => (
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
                <Field>
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
                        <TableHead>Window</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {dayLabel(row.day_of_week)}
                          </TableCell>
                          <TableCell>
                            {availabilitySummary(row).split(" · ")[1]}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              aria-label="Edit availability"
                              onClick={() => {
                                setEditingAvailability(row)
                                availabilityForm.reset({
                                  academic_term_id: row.academic_term_id,
                                  day_of_week: row.day_of_week,
                                  starts_at_time: row.starts_at_time,
                                  ends_at_time: row.ends_at_time,
                                })
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="ml-2"
                              aria-label="Remove availability"
                              onClick={() =>
                                setRemoval({ kind: "availability", row })
                              }
                            >
                              Remove
                            </Button>
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
              Choose New or Old curriculum context, then rank the subjects you
              prefer for that semester.
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
                    preferenceForm.formState.errors.curriculum_id,
                  )}
                >
                  <FieldLabel htmlFor="preference-curriculum">
                    Curriculum
                  </FieldLabel>
                  <Controller
                    control={preferenceForm.control}
                    name="curriculum_id"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) => {
                          field.onChange(Number(value))
                          preferenceForm.setValue("subject_id", 0)
                        }}
                        disabled={isSaving || catalogQuery.isLoading}
                      >
                        <SelectTrigger
                          id="preference-curriculum"
                          className="w-full"
                        >
                          <SelectValue placeholder="Select a curriculum" />
                        </SelectTrigger>
                        <SelectContent>
                          {(catalogQuery.data ?? []).map((entry) => (
                            <SelectItem
                              key={entry.curriculum_id}
                              value={String(entry.curriculum_id)}
                            >
                              {entry.program_code} ·{" "}
                              {entry.version_label === "new" ? "New" : "Old"} ·{" "}
                              {entry.curriculum_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError>
                    {preferenceForm.formState.errors.curriculum_id?.message}
                  </FieldError>
                </Field>
                <Field>
                  <FieldLabel>Semester</FieldLabel>
                  <div
                    className="grid grid-cols-2 gap-2"
                    role="group"
                    aria-label="Preference semester"
                  >
                    <Button
                      type="button"
                      variant={
                        selectedSemester === "1st" ? "default" : "outline"
                      }
                      onClick={() => {
                        preferenceForm.setValue("semester", "1st")
                        preferenceForm.setValue("subject_id", 0)
                      }}
                    >
                      1st Semester
                    </Button>
                    <Button
                      type="button"
                      variant={
                        selectedSemester === "2nd" ? "default" : "outline"
                      }
                      onClick={() => {
                        preferenceForm.setValue("semester", "2nd")
                        preferenceForm.setValue("subject_id", 0)
                      }}
                    >
                      2nd Semester
                    </Button>
                  </div>
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
                      <SearchableCombobox
                        id="preference-subject"
                        label="Preferred subject"
                        options={subjectOptions}
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) =>
                          field.onChange(Number(value) || 0)
                        }
                        placeholder={
                          selectedCurriculum
                            ? "Search code or subject title"
                            : "Select a curriculum first"
                        }
                        emptyMessage="No matching curriculum subject."
                        disabled={isSaving || !selectedCurriculum}
                      />
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
                    disabled={isSaving || !selectedCurriculum}
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
                          curriculum_id: selectedCurriculumId,
                          semester: selectedSemester,
                          subject_id: 0,
                          rank: 1,
                        })
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                </div>
              </FieldGroup>
            </form>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                aria-label="Search saved subject preferences"
                value={preferenceSearch}
                onChange={(event) => setPreferenceSearch(event.target.value)}
                placeholder="Filter saved subjects"
              />
              <p className="self-center text-sm text-muted-foreground">
                {selectedCurriculum
                  ? `${selectedCurriculum.version_label === "new" ? "New" : "Old"} · ${selectedSemester} semester`
                  : "Choose a curriculum"}
              </p>
            </div>
            <AsyncBoundary
              query={preferencesQuery}
              isEmpty={() => savedPreferences.length === 0}
              emptyMessage="No saved subject preferences for this curriculum and semester."
              loadingLabel="Loading your subject preferences…"
            >
              {() => (
                <div className="overflow-x-auto rounded-md border">
                  <Table aria-label="Saved curriculum subject preferences">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {savedPreferences.map((row) => {
                        const subject = subjectsById.get(row.subject_id)
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">
                              #{row.rank}
                            </TableCell>
                            <TableCell>
                              {subject
                                ? `${subject.code} — ${subject.title}`
                                : "Subject unavailable"}
                            </TableCell>
                            <TableCell>
                              <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                                {row.origin === "workbook_seeded"
                                  ? "Seeded"
                                  : "Declared"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                aria-label="Edit subject preference"
                                onClick={() => {
                                  setEditingPreference(row)
                                  preferenceForm.reset({
                                    curriculum_id: row.curriculum_id,
                                    semester: row.semester,
                                    subject_id: row.subject_id,
                                    rank: row.rank,
                                  })
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="ml-2"
                                aria-label="Remove subject preference"
                                onClick={() =>
                                  setRemoval({ kind: "preference", row })
                                }
                              >
                                Remove
                              </Button>
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
      <Card>
        <CardHeader>
          <CardTitle level={2}>Teaching history</CardTitle>
          <CardDescription>
            Read-only workbook-reference evidence used only as an explainable
            tie-breaker after curriculum preference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={historyQuery}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="No workbook teaching history is available yet."
            loadingLabel="Loading teaching history…"
          >
            {(rows) => (
              <div className="overflow-x-auto rounded-md border">
                <Table aria-label="Teaching history">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curriculum</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Evidence</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          {row.curriculum_name ?? "Curriculum unavailable"}
                        </TableCell>
                        <TableCell>{row.semester}</TableCell>
                        <TableCell>
                          {row.subject_code
                            ? `${row.subject_code} — ${row.subject_title ?? ""}`
                            : "Subject unavailable"}
                        </TableCell>
                        <TableCell>{row.evidence_count}</TableCell>
                        <TableCell>{row.source_workbook}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>
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
              This removes the saved faculty input. Historical workbook evidence
              remains unchanged.
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
