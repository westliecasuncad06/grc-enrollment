"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"

import { useAuth } from "@/features/auth/use-auth"
import { FacultySubjectPreferenceForm } from "@/features/components/portal/faculty-subject-preference-form"
import { FacultySpecializationList } from "@/features/components/portal/faculty-specialization-list"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  facultyCurriculumSubjectPreferencesQueryKey,
  facultySpecializationsQueryKey,
  useFacultyCurriculumSubjectPreferencesQuery,
  useFacultyPreferenceCatalogQuery,
  useFacultySpecializationsQuery,
} from "@/features/hooks/use-faculty-input"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import {
  facultyCurriculumSubjectPreferenceInputSchema,
  type FacultyCurriculumSubjectPreference,
  type FacultyCurriculumSubjectPreferenceInput,
  type FacultySpecialization,
} from "@/features/schemas/faculty-schema"
import {
  createFacultyCurriculumSubjectPreference,
  createFacultySpecialization,
  deleteFacultyCurriculumSubjectPreference,
  deleteFacultySpecialization,
  updateFacultyCurriculumSubjectPreference,
} from "@/features/services/faculty-service"

const emptyPreference: FacultyCurriculumSubjectPreferenceInput = {
  curriculum_id: 0,
  semester: "1st",
  subject_id: 0,
}

type Removal =
  | { kind: "preference"; row: FacultyCurriculumSubjectPreference }
  | { kind: "specialization"; row: FacultySpecialization }

export function FacultySubjectPreferencePanel() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const catalogQuery = useFacultyPreferenceCatalogQuery()
  const preferencesQuery = useFacultyCurriculumSubjectPreferencesQuery()
  const specializationsQuery = useFacultySpecializationsQuery()
  const [editing, setEditing] =
    useState<FacultyCurriculumSubjectPreference | null>(null)
  const [removal, setRemoval] = useState<Removal | null>(null)
  const [proficiency, setProficiency] = useState<"primary" | "secondary">(
    "secondary",
  )
  const [requestError, setRequestError] = useState("")
  const form = useForm<FacultyCurriculumSubjectPreferenceInput>({
    resolver: zodResolver(facultyCurriculumSubjectPreferenceInputSchema),
    defaultValues: emptyPreference,
  })
  const selectedCurriculumId = useWatch({
    control: form.control,
    name: "curriculum_id",
  })
  const selectedSemester = useWatch({ control: form.control, name: "semester" })

  useEffect(() => {
    if (selectedCurriculumId === 0 && catalogQuery.data?.[0]) {
      form.setValue("curriculum_id", catalogQuery.data[0].curriculum_id)
    }
  }, [catalogQuery.data, form, selectedCurriculumId])

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
  const specializationsBySubject = useMemo(
    () =>
      new Map(
        (specializationsQuery.data ?? []).map((row) => [row.subject_id, row]),
      ),
    [specializationsQuery.data],
  )
  const invalidatePreferences = () =>
    queryClient.invalidateQueries({
      queryKey: facultyCurriculumSubjectPreferencesQueryKey(
        session?.userId ?? null,
      ),
      exact: true,
    })
  const invalidateSpecializations = () =>
    queryClient.invalidateQueries({
      queryKey: facultySpecializationsQueryKey(session?.userId ?? null),
      exact: true,
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
  const specializationMutation = useMutation({
    mutationFn: createFacultySpecialization,
    onSuccess: invalidateSpecializations,
  })
  const removalMutation = useMutation({
    mutationFn: (target: Removal) =>
      target.kind === "preference"
        ? deleteFacultyCurriculumSubjectPreference(target.row.id)
        : deleteFacultySpecialization(target.row.id),
    onSuccess: async (_result, target) => {
      await (target.kind === "preference"
        ? invalidatePreferences()
        : invalidateSpecializations())
      setRemoval(null)
    },
    onError: () =>
      setRequestError(
        "The saved faculty input could not be removed. Try again.",
      ),
  })
  const isSaving =
    preferenceMutation.isPending ||
    specializationMutation.isPending ||
    removalMutation.isPending

  const save = async (input: FacultyCurriculumSubjectPreferenceInput) => {
    setRequestError("")
    try {
      await preferenceMutation.mutateAsync({ id: editing?.id, input })
    } catch (error) {
      if (!applyApiFieldErrors(error, form.setError))
        setRequestError(
          "Subject preference could not be saved. Check the connection and try again.",
        )
      return
    }

    // The preference write succeeded regardless of what happens next, so its
    // success path (form reset, exit edit mode) always runs. The
    // specialization write below is independent: its failure must not be
    // reported as the preference save failing, and it must not route field
    // errors into a form that has already been reset.
    setEditing(null)
    form.reset({
      curriculum_id: input.curriculum_id,
      semester: input.semester,
      subject_id: 0,
    })

    if (!specializationsBySubject.has(input.subject_id)) {
      try {
        await specializationMutation.mutateAsync({
          subject_id: input.subject_id,
          proficiency,
        })
      } catch {
        setRequestError(
          "Preference saved, but the proficiency could not be recorded. Try setting it again.",
        )
      }
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle level={2}>Subject preferences</CardTitle>
          <CardDescription>
            Choose a curriculum and semester, then rank subjects you are
            prepared to teach.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {(catalogQuery.isError ||
            preferencesQuery.isError ||
            specializationsQuery.isError ||
            requestError) && (
            <Alert variant="destructive">
              <AlertDescription>
                {requestError ||
                  "Subject preferences could not be loaded. Refresh and try again."}
              </AlertDescription>
            </Alert>
          )}
          <FacultySubjectPreferenceForm
            form={form}
            catalog={catalogQuery.data ?? []}
            selectedCurriculum={selectedCurriculum}
            selectedSemester={selectedSemester}
            subjectOptions={subjectOptions}
            isCatalogLoading={catalogQuery.isLoading}
            isSaving={isSaving}
            editing={editing}
            proficiency={proficiency}
            onProficiencyChange={setProficiency}
            onCancelEdit={() => {
              setEditing(null)
              form.reset({
                curriculum_id: selectedCurriculumId,
                semester: selectedSemester,
                subject_id: 0,
              })
            }}
            onSave={save}
          />
          <FacultySpecializationList
            preferencesQuery={preferencesQuery}
            specializationsQuery={specializationsQuery}
            curriculumId={selectedCurriculumId}
            semester={selectedSemester}
            contextLabel={
              selectedCurriculum
                ? `${selectedCurriculum.version_label === "new" ? "New" : "Old"} · ${selectedSemester} semester`
                : "Choose a curriculum"
            }
            subjectsById={subjectsById}
            specializationsBySubject={specializationsBySubject}
            onEditPreference={(row) => {
              setEditing(row)
              form.reset({
                curriculum_id: row.curriculum_id,
                semester: row.semester,
                subject_id: row.subject_id,
                rank: row.rank,
              })
            }}
            onRemovePreference={(row) =>
              setRemoval({ kind: "preference", row })
            }
            onRemoveSpecialization={(row) =>
              setRemoval({ kind: "specialization", row })
            }
            removalKind={removal?.kind ?? null}
            isRemoving={removalMutation.isPending}
            onDismissRemoval={() => setRemoval(null)}
            onConfirmRemoval={() =>
              removal && void removalMutation.mutateAsync(removal)
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
