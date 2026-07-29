"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"

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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/features/components/ui/field"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  useCurriculaQuery,
  curriculaQueryKey,
} from "@/features/hooks/use-curricula"
import {
  useProgramsQuery,
  useSubjectsQuery,
} from "@/features/hooks/use-reference-data"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import {
  storeCurriculumInputSchema,
  type StoreCurriculumInput,
} from "@/features/schemas/curriculum-schema"
import {
  createCurriculum,
  replaceCurriculum,
  toCurriculumReplacement,
} from "@/features/services/curriculum-service"
import { PrerequisiteEditor } from "@/features/components/portal/prerequisite-editor"

const fresh: StoreCurriculumInput = {
  program_id: 0,
  name: "",
  effective_school_year: "",
  status: "draft",
  subjects: [],
}

export function CurriculumWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const programsQuery = useProgramsQuery()
  const subjectsQuery = useSubjectsQuery()
  const curriculaQuery = useCurriculaQuery()
  const [selectedId, setSelectedId] = useState(0)
  const [discardTarget, setDiscardTarget] = useState<number | "new" | null>(
    null,
  )
  const [placementSubjectId, setPlacementSubjectId] = useState(0)
  const [requestError, setRequestError] = useState("")
  const form = useForm<StoreCurriculumInput>({
    resolver: zodResolver(storeCurriculumInputSchema),
    defaultValues: fresh,
  })
  const formSubjects = useWatch({ control: form.control, name: "subjects" })
  const userId = session?.userId ?? null
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: curriculaQueryKey(userId),
      exact: true,
    })
  const mutation = useMutation({
    mutationFn: (input: StoreCurriculumInput) =>
      selectedId > 0
        ? replaceCurriculum(selectedId, toCurriculumReplacement(input))
        : createCurriculum(input),
    onSuccess: invalidate,
  })
  const edit = (id: number) => {
    const curriculum = (curriculaQuery.data ?? []).find(
      (item) => item.id === id,
    )
    setSelectedId(id)
    if (curriculum)
      form.reset({
        program_id: curriculum.program_id,
        name: curriculum.name,
        effective_school_year: curriculum.effective_school_year,
        status: curriculum.status,
        subjects: curriculum.subjects.map(
          ({
            subject_id,
            year_level,
            semester,
            is_required,
            prerequisites,
          }) => ({
            subject_id,
            year_level,
            semester,
            is_required,
            prerequisites: prerequisites.map(
              ({ prerequisite_subject_id, minimum_grade }) => ({
                prerequisite_subject_id,
                minimum_grade,
              }),
            ),
          }),
        ),
      })
  }
  const requestEdit = (id: number) => {
    if (id === selectedId) return
    if (id === 0) return startNew()
    if (form.formState.isDirty) return setDiscardTarget(id)
    edit(id)
  }
  const startNew = () => {
    if (selectedId > 0 || form.formState.isDirty) return setDiscardTarget("new")
    setSelectedId(0)
    form.reset(fresh)
  }
  const save = async (input: StoreCurriculumInput) => {
    setRequestError("")
    try {
      const saved = await mutation.mutateAsync(input)
      setSelectedId(saved.id)
      form.reset(input)
    } catch (error) {
      if (!applyApiFieldErrors(error, form.setError))
        setRequestError(
          "Curriculum could not be saved. Check the connection or conflicting changes, then retry.",
        )
    }
  }
  const addPlacement = () => {
    if (placementSubjectId <= 0)
      return form.setError("subjects", {
        message: "Select a subject to place.",
      })
    if (
      form
        .getValues("subjects")
        .some((placement) => placement.subject_id === placementSubjectId)
    )
      return form.setError("subjects", {
        message: "This subject is already placed in this curriculum.",
      })
    form.setValue(
      "subjects",
      [
        ...form.getValues("subjects"),
        {
          subject_id: placementSubjectId,
          year_level: 1,
          semester: "1st",
          is_required: true,
          prerequisites: [],
        },
      ],
      { shouldDirty: true, shouldValidate: true },
    )
    setPlacementSubjectId(0)
  }
  const updatePlacement = (
    index: number,
    update: Partial<(typeof formSubjects)[number]>,
  ) =>
    form.setValue(
      "subjects",
      form
        .getValues("subjects")
        .map((placement, row) =>
          row === index ? { ...placement, ...update } : placement,
        ),
      { shouldDirty: true, shouldValidate: true },
    )
  const isLoading =
    programsQuery.isLoading ||
    subjectsQuery.isLoading ||
    curriculaQuery.isLoading
  return (
    <section aria-label="Curriculum workspace" className="grid gap-4">
      <div>
        <h2>Curriculum editor</h2>
        <p>
          Maintain complete program curriculum mappings and prerequisite rules.
        </p>
      </div>
      {(requestError ||
        programsQuery.isError ||
        subjectsQuery.isError ||
        curriculaQuery.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {requestError ||
              "Curriculum data could not be loaded. Refresh and retry."}
          </AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          <div className="flex gap-2">
            <Field>
              <FieldLabel htmlFor="curriculum-select">Curriculum</FieldLabel>
              <select
                id="curriculum-select"
                value={selectedId}
                onChange={(event) => requestEdit(Number(event.target.value))}
              >
                <option value={0}>New curriculum</option>
                {(curriculaQuery.data ?? []).map((curriculum) => (
                  <option key={curriculum.id} value={curriculum.id}>
                    {curriculum.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={startNew}>
                New curriculum
              </Button>
            </div>
          </div>
          <form
            noValidate
            onSubmit={(event) => void form.handleSubmit(save)(event)}
          >
            <FieldGroup>
              <Field data-invalid={Boolean(form.formState.errors.program_id)}>
                <FieldLabel htmlFor="curriculum-program">Program</FieldLabel>
                <select
                  id="curriculum-program"
                  disabled={selectedId > 0}
                  {...form.register("program_id", { valueAsNumber: true })}
                >
                  <option value={0}>Select a program</option>
                  {(programsQuery.data ?? []).map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.code} — {program.name}
                    </option>
                  ))}
                </select>
                <FieldError>
                  {form.formState.errors.program_id?.message}
                </FieldError>
              </Field>
              <Field data-invalid={Boolean(form.formState.errors.name)}>
                <FieldLabel htmlFor="curriculum-name">
                  Curriculum name
                </FieldLabel>
                <input id="curriculum-name" {...form.register("name")} />
                <FieldError>{form.formState.errors.name?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="effective-school-year">
                  Effective school year
                </FieldLabel>
                <input
                  id="effective-school-year"
                  {...form.register("effective_school_year")}
                />
                <FieldError>
                  {form.formState.errors.effective_school_year?.message}
                </FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="curriculum-status">Status</FieldLabel>
                <select id="curriculum-status" {...form.register("status")}>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
              <section aria-label="Curriculum subject placements">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <h3>Subject placements</h3>
                  <Field>
                    <FieldLabel htmlFor="subject-to-place">
                      Subject to place
                    </FieldLabel>
                    <select
                      id="subject-to-place"
                      value={placementSubjectId}
                      onChange={(event) =>
                        setPlacementSubjectId(Number(event.target.value))
                      }
                    >
                      <option value={0}>Select a subject</option>
                      {(subjectsQuery.data ?? []).map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.code} — {subject.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addPlacement}
                  >
                    Add subject placement
                  </Button>
                </div>
                <ul>
                  {formSubjects.map((placement, index) => (
                    <li
                      key={placement.subject_id}
                      className="grid gap-2 md:grid-cols-5"
                    >
                      <span>
                        {(subjectsQuery.data ?? []).find(
                          (subject) => subject.id === placement.subject_id,
                        )?.code ?? placement.subject_id}
                      </span>
                      <Field>
                        <FieldLabel
                          htmlFor={`placement-${placement.subject_id}-year`}
                        >
                          Placement {placement.subject_id} year level
                        </FieldLabel>
                        <select
                          id={`placement-${placement.subject_id}-year`}
                          value={placement.year_level}
                          onChange={(event) =>
                            updatePlacement(index, {
                              year_level: Number(event.target.value),
                            })
                          }
                        >
                          {[1, 2, 3, 4].map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field>
                        <FieldLabel
                          htmlFor={`placement-${placement.subject_id}-semester`}
                        >
                          Placement {placement.subject_id} semester
                        </FieldLabel>
                        <select
                          id={`placement-${placement.subject_id}-semester`}
                          value={placement.semester}
                          onChange={(event) =>
                            updatePlacement(index, {
                              semester: event.target.value,
                            })
                          }
                        >
                          {["1st", "2nd", "3rd"].map((semester) => (
                            <option key={semester} value={semester}>
                              {semester}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field>
                        <FieldLabel
                          htmlFor={`placement-${placement.subject_id}-required`}
                        >
                          Placement {placement.subject_id} is required
                        </FieldLabel>
                        <input
                          id={`placement-${placement.subject_id}-required`}
                          type="checkbox"
                          checked={placement.is_required}
                          onChange={(event) =>
                            updatePlacement(index, {
                              is_required: event.target.checked,
                            })
                          }
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          form.setValue(
                            "subjects",
                            form
                              .getValues("subjects")
                              .filter((_, row) => row !== index),
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                      >
                        Remove placement
                      </Button>
                    </li>
                  ))}
                </ul>
                <FieldError>
                  {form.formState.errors.subjects?.message}
                </FieldError>
              </section>
              <PrerequisiteEditor
                subjects={formSubjects}
                subjectCatalog={subjectsQuery.data ?? []}
                graphError={form.formState.errors.subjects?.message}
                onChange={(subjects) =>
                  form.setValue("subjects", subjects, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving curriculum" : "Save curriculum"}
              </Button>
            </FieldGroup>
          </form>
        </>
      )}
      <AlertDialog
        open={discardTarget !== null}
        onOpenChange={(open) => !open && setDiscardTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Discard unsaved curriculum changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              Continue without saving your current edits?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (discardTarget === "new") {
                  setSelectedId(0)
                  form.reset(fresh)
                } else if (typeof discardTarget === "number") {
                  edit(discardTarget)
                }
                setDiscardTarget(null)
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
