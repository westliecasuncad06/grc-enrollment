"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm, useWatch } from "react-hook-form"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
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
import {
  useAcademicTermsQuery,
  useSectionsQuery,
  useSubjectsQuery,
  sectionsQueryKey,
} from "@/features/hooks/use-reference-data"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import {
  sectionEditorSchema,
  type SectionEditorValues,
  type SectionInput,
} from "@/features/schemas/scheduling-schema"
import {
  createSection,
  replaceSection,
} from "@/features/services/scheduling-service"
import {
  formatAcademicTerm,
  getActiveAcademicTerm,
} from "@/features/services/reference-data-service"

const fresh = (termId = 0): SectionEditorValues => ({
  academic_term_id: termId,
  subject_id: 0,
  section_code: "",
  professor_id: null,
  schedule_days: "",
  starts_at_time: "",
  ends_at_time: "",
  room: "",
  capacity: 1,
  viability_threshold: null,
  status: "planned",
})

export function SectionsWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termsQuery = useAcademicTermsQuery()
  const subjectsQuery = useSubjectsQuery()
  const sectionsQuery = useSectionsQuery()
  const activeTerm = getActiveAcademicTerm(termsQuery.data)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [requestError, setRequestError] = useState("")
  const form = useForm<SectionEditorValues, unknown, SectionInput>({
    resolver: zodResolver(sectionEditorSchema),
    defaultValues: fresh(),
  })
  const termId = useWatch({ control: form.control, name: "academic_term_id" })
  const viabilityThreshold = useWatch({
    control: form.control,
    name: "viability_threshold",
  })
  const visibleSections = (sectionsQuery.data ?? []).filter(
    (section) => section.academic_term_id === termId,
  )
  const selected =
    visibleSections.find((section) => section.id === selectedId) ?? null
  const userId = session?.userId ?? null
  const mutation = useMutation({
    mutationFn: (values: SectionInput) =>
      selected ? replaceSection(selected.id, values) : createSection(values),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: sectionsQueryKey(userId),
        exact: true,
      }),
  })

  useEffect(() => {
    if (activeTerm && form.getValues("academic_term_id") === 0)
      form.setValue("academic_term_id", activeTerm.id)
  }, [activeTerm, form])

  const edit = (id: number) => {
    const next = (sectionsQuery.data ?? []).find((section) => section.id === id)
    if (!next) return
    setSelectedId(id)
    form.reset({
      academic_term_id: next.academic_term_id,
      subject_id: next.subject_id,
      section_code: next.section_code,
      professor_id: next.professor_id,
      schedule_days: next.schedule_days ?? "",
      starts_at_time: next.starts_at_time ?? "",
      ends_at_time: next.ends_at_time ?? "",
      room: next.room ?? "",
      capacity: next.capacity,
      viability_threshold: next.viability_threshold,
      status: next.status,
    })
  }
  const startNew = (nextTermId = termId) => {
    setSelectedId(null)
    form.reset(fresh(nextTermId === 0 ? (activeTerm?.id ?? 0) : nextTermId))
  }
  const retryReferences = () => {
    void Promise.all([
      termsQuery.refetch(),
      subjectsQuery.refetch(),
      sectionsQuery.refetch(),
    ])
  }
  const save = async (values: SectionInput) => {
    setRequestError("")
    // The resolver supplies the transformed, contract-ready values here.
    try {
      await mutation.mutateAsync(values)
      startNew()
    } catch (error) {
      if (!applyApiFieldErrors(error, form.setError))
        setRequestError(
          "The section could not be saved. Check the connection and try again.",
        )
    }
  }
  const referenceDataQuery = {
    isPending:
      termsQuery.isPending ||
      subjectsQuery.isPending ||
      sectionsQuery.isPending,
    isError:
      termsQuery.isError || subjectsQuery.isError || sectionsQuery.isError,
    error: termsQuery.error ?? subjectsQuery.error ?? sectionsQuery.error,
    data: true as const,
    refetch: retryReferences,
  }
  return (
    <WorkspacePage
      title="Sections and schedules"
      description="Plan each term's sections, capacity, room, and meeting time."
    >
      {requestError && (
        <Alert variant="destructive">
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}
      <AsyncBoundary
        query={referenceDataQuery}
        loadingLabel="Loading section planning data…"
      >
        {() => (
          <Card>
            <CardHeader>
              <CardTitle level={3}>
                {selected
                  ? `Edit section ${selected.section_code}`
                  : "New planned section"}
              </CardTitle>
              <CardDescription>
                Updates replace every writable section field. Meeting details
                are optional, but any entered time needs valid days and an end
                time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="section-existing">
                    Existing section
                  </FieldLabel>
                  <select
                    id="section-existing"
                    value={selectedId ?? 0}
                    onChange={(event) =>
                      Number(event.target.value)
                        ? edit(Number(event.target.value))
                        : startNew()
                    }
                  >
                    <option value={0}>New section</option>
                    {visibleSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.section_code}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => startNew()}
                  >
                    New section
                  </Button>
                </div>
              </div>
              <form
                noValidate
                onSubmit={(event) => void form.handleSubmit(save)(event)}
              >
                <FieldGroup>
                  <Field
                    data-invalid={Boolean(
                      form.formState.errors.academic_term_id,
                    )}
                  >
                    <FieldLabel htmlFor="section-term">
                      Academic term
                    </FieldLabel>
                    <select
                      id="section-term"
                      {...form.register("academic_term_id", {
                        valueAsNumber: true,
                      })}
                      onChange={(event) => {
                        startNew(Number(event.target.value))
                      }}
                    >
                      <option value={0}>Select an academic term</option>
                      {(termsQuery.data ?? []).map((term) => (
                        <option key={term.id} value={term.id}>
                          {formatAcademicTerm(term)}
                        </option>
                      ))}
                    </select>
                    <FieldError>
                      {form.formState.errors.academic_term_id?.message}
                    </FieldError>
                  </Field>
                  <Field
                    data-invalid={Boolean(form.formState.errors.subject_id)}
                  >
                    <FieldLabel htmlFor="section-subject">Subject</FieldLabel>
                    <select
                      id="section-subject"
                      {...form.register("subject_id", { valueAsNumber: true })}
                    >
                      <option value={0}>Select a subject</option>
                      {(subjectsQuery.data ?? [])
                        .filter((subject) => subject.status === "active")
                        .map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.code} — {subject.title}
                          </option>
                        ))}
                    </select>
                    <FieldError>
                      {form.formState.errors.subject_id?.message}
                    </FieldError>
                  </Field>
                  <Field
                    data-invalid={Boolean(form.formState.errors.section_code)}
                  >
                    <FieldLabel htmlFor="section-code">Section code</FieldLabel>
                    <input
                      id="section-code"
                      {...form.register("section_code")}
                    />
                    <FieldError>
                      {form.formState.errors.section_code?.message}
                    </FieldError>
                  </Field>
                  <Field
                    data-invalid={Boolean(form.formState.errors.schedule_days)}
                  >
                    <FieldLabel htmlFor="section-days">
                      Schedule days
                    </FieldLabel>
                    <input
                      id="section-days"
                      placeholder="MWF or TTh"
                      {...form.register("schedule_days")}
                    />
                    <FieldError>
                      {form.formState.errors.schedule_days?.message}
                    </FieldError>
                  </Field>
                  <Field
                    data-invalid={Boolean(form.formState.errors.starts_at_time)}
                  >
                    <FieldLabel htmlFor="section-start">Start time</FieldLabel>
                    <input
                      id="section-start"
                      placeholder="08:00:00"
                      {...form.register("starts_at_time")}
                    />
                    <FieldError>
                      {form.formState.errors.starts_at_time?.message}
                    </FieldError>
                  </Field>
                  <Field
                    data-invalid={Boolean(form.formState.errors.ends_at_time)}
                  >
                    <FieldLabel htmlFor="section-end">End time</FieldLabel>
                    <input
                      id="section-end"
                      placeholder="09:00:00"
                      {...form.register("ends_at_time")}
                    />
                    <FieldError>
                      {form.formState.errors.ends_at_time?.message}
                    </FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="section-room">Room</FieldLabel>
                    <input id="section-room" {...form.register("room")} />
                  </Field>
                  <Field data-invalid={Boolean(form.formState.errors.capacity)}>
                    <FieldLabel htmlFor="section-capacity">Capacity</FieldLabel>
                    <input
                      id="section-capacity"
                      type="number"
                      min={1}
                      {...form.register("capacity", { valueAsNumber: true })}
                    />
                    <FieldError>
                      {form.formState.errors.capacity?.message}
                    </FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="section-threshold">
                      Viability threshold
                    </FieldLabel>
                    <input
                      id="section-threshold"
                      type="number"
                      min={1}
                      value={viabilityThreshold ?? ""}
                      onChange={(event) =>
                        form.setValue(
                          "viability_threshold",
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="section-status">Status</FieldLabel>
                    <select id="section-status" {...form.register("status")}>
                      <option value="planned">Planned</option>
                      <option value="published">Published</option>
                      <option value="closed">Closed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </Field>
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Saving section" : "Save section"}
                  </Button>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
