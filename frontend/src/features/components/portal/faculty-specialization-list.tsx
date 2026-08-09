"use client"

import { useState } from "react"

import { AsyncBoundary } from "@/features/components/portal/async-boundary"
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
import { Input } from "@/features/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import {
  useFacultyCurriculumSubjectPreferencesQuery,
  useFacultySpecializationsQuery,
} from "@/features/hooks/use-faculty-input"
import type {
  FacultyCurriculumSubjectPreference,
  FacultySpecialization,
} from "@/features/schemas/faculty-schema"

interface SubjectLabel {
  code: string
  title: string
}

interface FacultySpecializationListProps {
  preferencesQuery: ReturnType<
    typeof useFacultyCurriculumSubjectPreferencesQuery
  >
  specializationsQuery: ReturnType<typeof useFacultySpecializationsQuery>
  curriculumId: number
  semester: "1st" | "2nd"
  contextLabel: string
  subjectsById: ReadonlyMap<number, SubjectLabel>
  specializationsBySubject: ReadonlyMap<number, FacultySpecialization>
  onEditPreference: (row: FacultyCurriculumSubjectPreference) => void
  onRemovePreference: (row: FacultyCurriculumSubjectPreference) => void
  onRemoveSpecialization: (row: FacultySpecialization) => void
  removalKind: "preference" | "specialization" | null
  isRemoving: boolean
  onDismissRemoval: () => void
  onConfirmRemoval: () => void
}

function sourceLabel(source: "declared" | "workbook_seeded" | "seeded") {
  return source === "workbook_seeded" || source === "seeded"
    ? "Seeded"
    : "Declared"
}

export function FacultySpecializationList({
  preferencesQuery,
  specializationsQuery,
  curriculumId,
  semester,
  contextLabel,
  subjectsById,
  specializationsBySubject,
  onEditPreference,
  onRemovePreference,
  onRemoveSpecialization,
  removalKind,
  isRemoving,
  onDismissRemoval,
  onConfirmRemoval,
}: FacultySpecializationListProps) {
  const [search, setSearch] = useState("")
  const preferences = (preferencesQuery.data ?? []).filter((row) => {
    const subject = subjectsById.get(row.subject_id)
    const text = `${subject?.code ?? ""} ${subject?.title ?? ""}`.toLowerCase()

    return (
      row.curriculum_id === curriculumId &&
      row.semester === semester &&
      text.includes(search.toLowerCase())
    )
  })

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          aria-label="Search saved subject preferences"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter saved subjects"
        />
        <p className="self-center text-sm text-muted-foreground">
          {contextLabel}
        </p>
      </div>
      <AsyncBoundary
        query={preferencesQuery}
        isEmpty={() => preferences.length === 0}
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
                  <TableHead>Proficiency</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preferences.map((row) => {
                  const subject = subjectsById.get(row.subject_id)
                  const specialization = specializationsBySubject.get(
                    row.subject_id,
                  )

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">#{row.rank}</TableCell>
                      <TableCell>
                        {subject
                          ? `${subject.code} — ${subject.title}`
                          : "Subject unavailable"}
                      </TableCell>
                      <TableCell>
                        {specialization?.proficiency_label ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                          {sourceLabel(row.origin)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          aria-label="Edit subject preference"
                          onClick={() => onEditPreference(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="ml-2"
                          aria-label="Remove subject preference"
                          onClick={() => onRemovePreference(row)}
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
      <Card>
        <CardHeader>
          <CardTitle level={3}>Declared specializations</CardTitle>
          <CardDescription>
            Specializations are advisory signals used when schedule
            recommendations rank qualified faculty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={specializationsQuery}
            isEmpty={(rows) =>
              rows.filter((row) => row.source === "declared").length === 0
            }
            emptyMessage="No declared specializations yet."
            loadingLabel="Loading your declared specializations…"
          >
            {(rows) => (
              <div className="overflow-x-auto rounded-md border">
                <Table aria-label="Declared specializations">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Proficiency</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows
                      .filter((row) => row.source === "declared")
                      .map((row) => {
                        const subject = subjectsById.get(row.subject_id)

                        return (
                          <TableRow key={row.id}>
                            <TableCell>
                              {subject
                                ? `${subject.code} — ${subject.title}`
                                : `Subject #${row.subject_id}`}
                            </TableCell>
                            <TableCell>{row.proficiency_label}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                aria-label="Remove specialization"
                                onClick={() => onRemoveSpecialization(row)}
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
      <AlertDialog
        open={removalKind !== null}
        onOpenChange={(open) => !open && onDismissRemoval()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove{" "}
              {removalKind === "specialization"
                ? "specialization"
                : "subject preference"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the saved faculty input. Historical workbook evidence
              remains unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>
              Keep item
            </AlertDialogCancel>
            <AlertDialogAction disabled={isRemoving} onClick={onConfirmRemoval}>
              Confirm removal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
