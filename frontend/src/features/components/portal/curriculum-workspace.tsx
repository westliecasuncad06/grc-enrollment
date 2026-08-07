"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2Icon, XIcon } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"

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
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/features/components/ui/tabs"
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
  type CurriculumSubjectInput,
  type StoreCurriculumInput,
} from "@/features/schemas/curriculum-schema"
import type { Curriculum } from "@/features/schemas/reference-data-schema"
import {
  createCurriculum,
  replaceCurriculum,
  toCurriculumReplacement,
  transitionCurriculum,
} from "@/features/services/curriculum-service"
import { PrerequisiteEditor } from "@/features/components/portal/prerequisite-editor"
import { CurriculumView } from "@/features/components/portal/curriculum-view"

const fresh: StoreCurriculumInput = {
  program_id: 0,
  name: "",
  effective_school_year: "",
  subjects: [],
}
const years = [1, 2, 3, 4] as const
const semesters = ["1st", "2nd"] as const
/** Default minimum grade for an edge added from a placement row. */
const defaultMinimumGrade = "75"
/**
 * Quiet period before a placement edit is pushed to the server. Long enough
 * that a chair walking a row's cells produces one write instead of four.
 */
const autosaveDelayMs = 800

function yearLabel(year: number) {
  return `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`
}

export function CurriculumWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const programsQuery = useProgramsQuery()
  const subjectsQuery = useSubjectsQuery()
  const curriculaQuery = useCurriculaQuery()
  const [selectedId, setSelectedIdState] = useState(0)
  // Mirrored in a ref so an in-flight save can tell, on resolution, whether the
  // chair has since switched to a different curriculum.
  const selectedIdRef = useRef(0)
  const setSelectedId = useCallback((id: number) => {
    selectedIdRef.current = id
    setSelectedIdState(id)
  }, [])
  const [discardTarget, setDiscardTarget] = useState<number | "new" | null>(
    null,
  )
  const [placementSubjectId, setPlacementSubjectId] = useState(0)
  const [activeYear, setActiveYear] = useState("1")
  const [graphOpen, setGraphOpen] = useState(false)
  const [requestError, setRequestError] = useState("")
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const form = useForm<StoreCurriculumInput>({
    resolver: zodResolver(storeCurriculumInputSchema),
    defaultValues: fresh,
  })
  const formSubjects = useWatch({ control: form.control, name: "subjects" })
  const watchedValues = useWatch({ control: form.control })
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
  const { mutateAsync, isPending } = mutation
  // The placement graph as last loaded or last written. The autosave effect
  // compares against it so that reloading a curriculum — or editing only the
  // header fields the discard dialog still guards — never triggers a write.
  const persistedPlacements = useRef(JSON.stringify(fresh.subjects))
  const applyValues = useCallback(
    (values: StoreCurriculumInput) => {
      persistedPlacements.current = JSON.stringify(values.subjects)
      form.reset(values)
    },
    [form],
  )
  const transitionMutation = useMutation({
    mutationFn: (action: "submit") =>
      transitionCurriculum(selectedId, { action }),
    onSuccess: (updated) => {
      // The transition response already carries the authoritative post-write
      // status, so write it straight into the cache instead of invalidating —
      // an invalidate-triggered refetch could otherwise race this update and
      // briefly (or, against a slow read replica, not-so-briefly) show the
      // pre-submit status again.
      queryClient.setQueryData<Curriculum[]>(
        curriculaQueryKey(userId),
        (old) =>
          (old ?? []).map((item) => (item.id === updated.id ? updated : item)),
      )
      applyValues({
        program_id: updated.program_id,
        name: updated.name,
        effective_school_year: updated.effective_school_year,
        subjects: updated.subjects.map(
          ({ subject_id, year_level, semester, is_required, prerequisites }) => ({
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
      setSubmitDialogOpen(false)
    },
  })
  const save = useCallback(
    async (input: StoreCurriculumInput) => {
      setRequestError("")
      // Both captured before the request so the response can be discarded if
      // the chair moved on while it was in flight. Resetting the form to this
      // stale snapshot would silently overwrite whatever they typed meanwhile
      // *and* clear `isDirty`, so even the discard dialog would stop warning.
      const requestedFor = selectedIdRef.current
      const valuesAtRequest = JSON.stringify(form.getValues())
      try {
        const saved = await mutateAsync(input)
        if (selectedIdRef.current !== requestedFor) return
        setSelectedId(saved.id)
        // Live edits made during the request stay put; the next autosave cycle
        // carries them, since they also moved the placement signature.
        if (JSON.stringify(form.getValues()) === valuesAtRequest)
          applyValues(input)
      } catch (error) {
        if (selectedIdRef.current !== requestedFor) return
        if (!applyApiFieldErrors(error, form.setError))
          setRequestError(
            "Curriculum could not be saved. Check the connection or conflicting changes, then retry.",
          )
      }
    },
    [applyValues, form, mutateAsync, setSelectedId],
  )
  const edit = (id: number) => {
    const curriculum = (curriculaQuery.data ?? []).find(
      (item) => item.id === id,
    )
    setSelectedId(id)
    if (curriculum)
      applyValues({
        program_id: curriculum.program_id,
        name: curriculum.name,
        effective_school_year: curriculum.effective_school_year,
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
  const selectedCurriculum = (curriculaQuery.data ?? []).find(
    (item) => item.id === selectedId,
  )
  // Undefined only while the curriculum list hasn't loaded (or hasn't caught
  // up with a just-created id) yet — treat that as unlocked rather than
  // locking the editor on data that hasn't arrived.
  const isLocked = Boolean(
    selectedCurriculum && selectedCurriculum.status !== "draft",
  )
  const requestEdit = (id: number) => {
    if (id === selectedId) return
    if (id === 0) return startNew()
    if (form.formState.isDirty) return setDiscardTarget(id)
    edit(id)
  }
  const startNew = () => {
    if (selectedId > 0 || form.formState.isDirty) return setDiscardTarget("new")
    setSelectedId(0)
    applyValues(fresh)
  }
  const setPlacements = (placements: CurriculumSubjectInput[]) =>
    form.setValue("subjects", placements, {
      shouldDirty: true,
      shouldValidate: true,
    })
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
    setPlacements([
      ...form.getValues("subjects"),
      {
        subject_id: placementSubjectId,
        year_level: Number(activeYear),
        semester: semesters[0],
        is_required: true,
        prerequisites: [],
      },
    ])
    setPlacementSubjectId(0)
  }
  const updatePlacement = (
    index: number,
    update: Partial<CurriculumSubjectInput>,
  ) =>
    setPlacements(
      form
        .getValues("subjects")
        .map((placement, row) =>
          row === index ? { ...placement, ...update } : placement,
        ),
    )
  const removePlacement = (index: number) =>
    setPlacements(form.getValues("subjects").filter((_, row) => row !== index))
  const addPrerequisite = (index: number, prerequisiteSubjectId: number) => {
    const placement = form.getValues("subjects")[index]
    updatePlacement(index, {
      prerequisites: [
        ...placement.prerequisites,
        {
          prerequisite_subject_id: prerequisiteSubjectId,
          minimum_grade: defaultMinimumGrade,
        },
      ],
    })
  }
  const removePrerequisite = (index: number, prerequisiteSubjectId: number) => {
    const placement = form.getValues("subjects")[index]
    updatePlacement(index, {
      prerequisites: placement.prerequisites.filter(
        (edge) => edge.prerequisite_subject_id !== prerequisiteSubjectId,
      ),
    })
  }

  const placementSignature = JSON.stringify(formSubjects)
  const isDirty = form.formState.isDirty
  // A brand-new curriculum has nothing to PATCH and no complete payload to
  // POST until its header fields are filled in, so autosave stays quiet until
  // the whole form is a valid create/replace request.
  const autosaveReady =
    storeCurriculumInputSchema.safeParse(watchedValues).success
  useEffect(() => {
    if (!isDirty || isPending || isLocked) return
    if (autosaveReady && persistedPlacements.current === placementSignature)
      return
    const timer = setTimeout(() => {
      // Nothing can be written until the whole form is a valid request. Run
      // validation instead of writing, so the fields blocking the autosave are
      // actually highlighted rather than silently swallowing every edit — this
      // screen has no submit button to run it for us.
      if (!autosaveReady) return void form.trigger()
      persistedPlacements.current = placementSignature
      void save(form.getValues())
    }, autosaveDelayMs)
    return () => clearTimeout(timer)
  }, [
    autosaveReady,
    form,
    isDirty,
    isLocked,
    isPending,
    placementSignature,
    save,
  ])

  const catalog = subjectsQuery.data ?? []
  const catalogOptions = catalog.map((subject) => ({
    value: String(subject.id),
    label: subject.code,
  }))
  const subjectFor = (id: number) =>
    catalog.find((subject) => subject.id === id)
  const codeFor = (id: number) => subjectFor(id)?.code ?? `Subject ${id}`
  const placementsForYear = (year: number) =>
    formSubjects
      .map((placement, index) => ({ placement, index }))
      .filter(({ placement }) => placement.year_level === year)
  const saveState = isPending
    ? "Saving…"
    : isDirty && !autosaveReady
      ? "Not saved — fix the highlighted fields"
      : mutation.isSuccess
        ? "Saved"
        : "Edits save automatically"
  const referenceDataQuery = {
    isPending:
      programsQuery.isPending ||
      subjectsQuery.isPending ||
      curriculaQuery.isPending,
    isError:
      programsQuery.isError || subjectsQuery.isError || curriculaQuery.isError,
    error: programsQuery.error ?? subjectsQuery.error ?? curriculaQuery.error,
    data: true as const,
    refetch: () => {
      void programsQuery.refetch()
      void subjectsQuery.refetch()
      void curriculaQuery.refetch()
    },
  }
  return (
    <WorkspacePage
      title="Curriculum editor"
      description="Maintain complete program curriculum mappings and prerequisite rules."
      lastUpdated={curriculaQuery.dataUpdatedAt}
    >
      {requestError && (
        <Alert variant="destructive">
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}
      <AsyncBoundary
        query={referenceDataQuery}
        loadingLabel="Loading curriculum data…"
      >
        {() => (
          <Tabs defaultValue="manage" className="grid gap-4">
            <TabsList aria-label="Curriculum editor mode">
              <TabsTrigger value="manage">Manage</TabsTrigger>
              <TabsTrigger value="view">View</TabsTrigger>
            </TabsList>
            <TabsContent value="manage" className="grid gap-4">
              <div className="flex gap-2">
                <Field>
                  <FieldLabel htmlFor="curriculum-select">
                    Curriculum
                  </FieldLabel>
                  <Select
                    value={String(selectedId)}
                    onValueChange={(value) => requestEdit(Number(value))}
                  >
                    <SelectTrigger id="curriculum-select" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">New curriculum</SelectItem>
                      {(curriculaQuery.data ?? []).map((curriculum) => (
                        <SelectItem
                          key={curriculum.id}
                          value={String(curriculum.id)}
                        >
                          {curriculum.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Button type="button" variant="outline" onClick={startNew}>
                    New curriculum
                  </Button>
                </div>
              </div>
              <FieldGroup>
                <Field data-invalid={Boolean(form.formState.errors.program_id)}>
                  <FieldLabel htmlFor="curriculum-program">Program</FieldLabel>
                  <Controller
                    control={form.control}
                    name="program_id"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) => field.onChange(Number(value))}
                        disabled={selectedId > 0 || isLocked}
                      >
                        <SelectTrigger
                          id="curriculum-program"
                          className="w-full"
                          aria-invalid={Boolean(
                            form.formState.errors.program_id,
                          )}
                        >
                          <SelectValue placeholder="Select a program" />
                        </SelectTrigger>
                        <SelectContent>
                          {(programsQuery.data ?? []).map((program) => (
                            <SelectItem
                              key={program.id}
                              value={String(program.id)}
                            >
                              {program.code} — {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError>
                    {form.formState.errors.program_id?.message}
                  </FieldError>
                </Field>
                <Field data-invalid={Boolean(form.formState.errors.name)}>
                  <FieldLabel htmlFor="curriculum-name">
                    Curriculum name
                  </FieldLabel>
                  <Input
                    id="curriculum-name"
                    aria-invalid={Boolean(form.formState.errors.name)}
                    disabled={isLocked}
                    {...form.register("name")}
                  />
                  <FieldError>{form.formState.errors.name?.message}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="effective-school-year">
                    Effective school year
                  </FieldLabel>
                  <Input
                    id="effective-school-year"
                    disabled={isLocked}
                    {...form.register("effective_school_year")}
                  />
                  <FieldError>
                    {form.formState.errors.effective_school_year?.message}
                  </FieldError>
                </Field>
                {selectedCurriculum && (
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <div>
                      <Badge variant={isLocked ? "secondary" : "outline"}>
                        {selectedCurriculum.status_label}
                      </Badge>
                    </div>
                  </Field>
                )}
                {selectedCurriculum?.last_decision_reason &&
                  selectedCurriculum.status === "draft" && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        Returned: {selectedCurriculum.last_decision_reason}
                      </AlertDescription>
                    </Alert>
                  )}
                <section
                  aria-label="Curriculum subject placements"
                  className="grid gap-3"
                >
                  <Tabs value={activeYear} onValueChange={setActiveYear}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <TabsList
                        aria-label="Curriculum year level"
                        className="w-full sm:w-fit"
                      >
                        {years.map((year) => (
                          <TabsTrigger key={year} value={String(year)}>
                            {yearLabel(year)}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          aria-live="polite"
                          className="text-sm text-muted-foreground"
                        >
                          {saveState}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isLocked}
                          onClick={() => setGraphOpen(true)}
                        >
                          Prerequisite graph
                        </Button>
                      </div>
                    </div>
                    {years.map((year) => (
                      <TabsContent
                        key={year}
                        value={String(year)}
                        className="grid gap-3"
                      >
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                          <Field>
                            <FieldLabel htmlFor="subject-to-place">
                              Subject to place
                            </FieldLabel>
                            <Select
                              value={
                                placementSubjectId > 0
                                  ? String(placementSubjectId)
                                  : ""
                              }
                              onValueChange={(value) =>
                                setPlacementSubjectId(Number(value))
                              }
                              disabled={isLocked}
                            >
                              <SelectTrigger
                                id="subject-to-place"
                                className="w-full"
                              >
                                <SelectValue placeholder="Select a subject" />
                              </SelectTrigger>
                              <SelectContent>
                                {catalog.map((subject) => (
                                  <SelectItem
                                    key={subject.id}
                                    value={String(subject.id)}
                                  >
                                    {subject.code} — {subject.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={isLocked}
                            onClick={addPlacement}
                          >
                            Add subject placement
                          </Button>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Subject Code</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Units</TableHead>
                              <TableHead>Semester</TableHead>
                              <TableHead>Prerequisite</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {placementsForYear(year).map(
                              ({ placement, index }) => {
                                const code = codeFor(placement.subject_id)
                                const candidates = formSubjects.filter(
                                  (other) =>
                                    other.subject_id !== placement.subject_id &&
                                    !placement.prerequisites.some(
                                      (edge) =>
                                        edge.prerequisite_subject_id ===
                                        other.subject_id,
                                    ),
                                )
                                return (
                                  <TableRow key={placement.subject_id}>
                                    <TableCell>
                                      <div className="flex items-center gap-1">
                                        <SearchableCombobox
                                          id={`placement-${placement.subject_id}-subject`}
                                          label={`Subject code for ${code}`}
                                          options={catalogOptions}
                                          value={String(placement.subject_id)}
                                          onValueChange={(value) => {
                                            if (value)
                                              updatePlacement(index, {
                                                subject_id: Number(value),
                                              })
                                          }}
                                          placeholder="Search subject code"
                                          emptyMessage="No matching subject."
                                          disabled={isLocked}
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          aria-label={`Remove ${code} placement`}
                                          disabled={isLocked}
                                          onClick={() => removePlacement(index)}
                                        >
                                          <Trash2Icon />
                                        </Button>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {subjectFor(placement.subject_id)
                                        ?.title ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                      {subjectFor(placement.subject_id)
                                        ?.units ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={placement.semester}
                                        onValueChange={(value) =>
                                          updatePlacement(index, {
                                            semester: value,
                                          })
                                        }
                                        disabled={isLocked}
                                      >
                                        <SelectTrigger
                                          id={`placement-${placement.subject_id}-semester`}
                                          aria-label={`Semester for ${code}`}
                                          className="w-full"
                                        >
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {[
                                            ...semesters,
                                            ...(semesters.some(
                                              (semester) =>
                                                semester === placement.semester,
                                            )
                                              ? []
                                              : [placement.semester]),
                                          ].map((semester) => (
                                            <SelectItem
                                              key={semester}
                                              value={semester}
                                            >
                                              {semester}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell className="whitespace-normal">
                                      <div className="flex flex-wrap items-center gap-1">
                                        {placement.prerequisites.length ===
                                          0 && (
                                          <span className="text-muted-foreground">
                                            None
                                          </span>
                                        )}
                                        {placement.prerequisites.map((edge) => (
                                          <Badge
                                            key={edge.prerequisite_subject_id}
                                            variant="secondary"
                                            className="gap-1 pr-1"
                                          >
                                            {codeFor(
                                              edge.prerequisite_subject_id,
                                            )}
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              className="size-5 p-0"
                                              aria-label={`Remove prerequisite ${codeFor(edge.prerequisite_subject_id)} from ${code}`}
                                              disabled={isLocked}
                                              onClick={() =>
                                                removePrerequisite(
                                                  index,
                                                  edge.prerequisite_subject_id,
                                                )
                                              }
                                            >
                                              <XIcon />
                                            </Button>
                                          </Badge>
                                        ))}
                                        <Select
                                          value=""
                                          onValueChange={(value) =>
                                            addPrerequisite(
                                              index,
                                              Number(value),
                                            )
                                          }
                                        >
                                          <SelectTrigger
                                            id={`placement-${placement.subject_id}-prerequisite`}
                                            aria-label={`Add prerequisite for ${code}`}
                                            className="w-auto"
                                            disabled={
                                              candidates.length === 0 ||
                                              isLocked
                                            }
                                          >
                                            <SelectValue placeholder="Add" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {candidates.map((candidate) => (
                                              <SelectItem
                                                key={candidate.subject_id}
                                                value={String(
                                                  candidate.subject_id,
                                                )}
                                              >
                                                {codeFor(candidate.subject_id)}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )
                              },
                            )}
                          </TableBody>
                        </Table>
                      </TabsContent>
                    ))}
                  </Tabs>
                  <FieldError>
                    {form.formState.errors.subjects?.message}
                  </FieldError>
                </section>
              </FieldGroup>
              {selectedCurriculum?.status === "draft" &&
                formSubjects.length > 0 && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => setSubmitDialogOpen(true)}
                    >
                      Submit for Dean Review
                    </Button>
                  </div>
                )}
              <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Review before submitting</DialogTitle>
                    <DialogDescription>
                      Every subject below will be sent to the Dean for
                      review. You will not be able to edit this curriculum
                      again until it is approved or returned.
                    </DialogDescription>
                  </DialogHeader>
                  {programsQuery.data && (
                    <CurriculumView
                      programs={programsQuery.data.filter(
                        (program) => program.id === watchedValues.program_id,
                      )}
                      // CurriculumView only ever renders curricula whose status
                      // is "active" — this preview stands in a draft about to
                      // be submitted, so its status is overridden purely for
                      // this read-only render; nothing here is persisted.
                      curricula={
                        selectedCurriculum
                          ? [{ ...selectedCurriculum, status: "active" as const }]
                          : []
                      }
                    />
                  )}
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSubmitDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={transitionMutation.isPending}
                      onClick={() => transitionMutation.mutate("submit")}
                    >
                      Confirm & Submit
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>
            <TabsContent value="view">
              <CurriculumView
                programs={programsQuery.data ?? []}
                curricula={curriculaQuery.data ?? []}
              />
            </TabsContent>
          </Tabs>
        )}
      </AsyncBoundary>
      <Dialog open={graphOpen} onOpenChange={setGraphOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prerequisite graph</DialogTitle>
            <DialogDescription>
              Every prerequisite edge in this curriculum. Rows added from a year
              tab use a minimum grade of {defaultMinimumGrade}; change it here.
            </DialogDescription>
          </DialogHeader>
          <PrerequisiteEditor
            subjects={formSubjects}
            subjectCatalog={catalog}
            graphError={form.formState.errors.subjects?.message}
            onChange={setPlacements}
          />
        </DialogContent>
      </Dialog>
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
                  applyValues(fresh)
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
    </WorkspacePage>
  )
}
