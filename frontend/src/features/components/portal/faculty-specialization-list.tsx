"use client"

import { useState } from "react"
import { RefreshCw, Trash2 } from "lucide-react"

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
import { Checkbox } from "@/features/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Input } from "@/features/components/ui/input"
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
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
  subjectOptions?: readonly { value: string; label: string }[]
  onRemoveSpecialization: (row: FacultySpecialization) => void
  onBatchDeletePreferences?: (ids: number[]) => Promise<void>
  onReplacePreference?: (
    row: FacultyCurriculumSubjectPreference,
    newSubjectId: number,
  ) => Promise<void>
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
  subjectOptions,
  onRemoveSpecialization,
  onBatchDeletePreferences,
  onReplacePreference,
  removalKind,
  isRemoving,
  onDismissRemoval,
  onConfirmRemoval,
}: FacultySpecializationListProps) {
  const [search, setSearch] = useState("")
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false)
  const [replacingRow, setReplacingRow] =
    useState<FacultyCurriculumSubjectPreference | null>(null)
  const [replacementSubjectId, setReplacementSubjectId] = useState<number>(0)

  const handleConfirmBatchDelete = () => {
    if (!onBatchDeletePreferences) return
    const ids = Array.from(selectedIds)
    setSelectedIds(new Set())
    setIsBatchDeleteModalOpen(false)
    void onBatchDeletePreferences(ids)
  }

  const handleConfirmReplacement = () => {
    if (!replacingRow || !onReplacePreference || replacementSubjectId === 0) return
    const row = replacingRow
    const targetId = replacementSubjectId
    setReplacingRow(null)
    setReplacementSubjectId(0)
    void onReplacePreference(row, targetId)
  }

  const preferences = (preferencesQuery.data ?? []).filter((row) => {
    const subject = subjectsById.get(row.subject_id)
    const text = `${subject?.code ?? ""} ${subject?.title ?? ""}`.toLowerCase()

    return (
      row.curriculum_id === curriculumId &&
      row.semester === semester &&
      text.includes(search.toLowerCase())
    )
  })

  const allSelected =
    preferences.length > 0 &&
    preferences.every((p) => selectedIds.has(p.id))
  const someSelected =
    preferences.some((p) => selectedIds.has(p.id)) && !allSelected

  const toggleSelectAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds)
      preferences.forEach((p) => next.delete(p.id))
      setSelectedIds(next)
    } else {
      const next = new Set(selectedIds)
      preferences.forEach((p) => next.add(p.id))
      setSelectedIds(next)
    }
  }

  const toggleSelectRow = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Search saved subject preferences"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter saved subjects"
            className="max-w-xs"
          />
          <Button
            type="button"
            size="sm"
            variant={isEditMode ? "default" : "outline"}
            onClick={() => {
              setIsEditMode((prev) => !prev)
              setSelectedIds(new Set())
            }}
          >
            {isEditMode ? "Done" : "Edit"}
          </Button>
          {isEditMode && selectedIds.size > 0 && (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="flex items-center gap-1.5"
              onClick={() => setIsBatchDeleteModalOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Selected ({selectedIds.size})</span>
            </Button>
          )}
        </div>
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
                  {isEditMode && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          allSelected
                            ? true
                            : someSelected
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  <TableHead>Rank</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Proficiency</TableHead>
                  <TableHead>Source</TableHead>
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
                      {isEditMode && (
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selectedIds.has(row.id)}
                            onCheckedChange={() => toggleSelectRow(row.id)}
                            aria-label={`Select ${subject?.code ?? `Subject #${row.subject_id}`}`}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">#{row.rank}</TableCell>
                      <TableCell>
                        {isEditMode ? (
                          <button
                            type="button"
                            className="group flex items-center gap-2 text-left font-medium text-primary hover:underline"
                            onClick={() => {
                              setReplacingRow(row)
                              setReplacementSubjectId(0)
                            }}
                            title="Click to replace subject"
                          >
                            <span>
                              {subject
                                ? `${subject.code} — ${subject.title}`
                                : "Subject unavailable"}
                            </span>
                            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground opacity-70 group-hover:opacity-100" />
                          </button>
                        ) : subject ? (
                          `${subject.code} — ${subject.title}`
                        ) : (
                          "Subject unavailable"
                        )}
                      </TableCell>
                      <TableCell>
                        {specialization?.proficiency_label ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                          {sourceLabel(row.origin)}
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
                      <TableHead>Status</TableHead>
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
                            <TableCell>{row.status_label}</TableCell>
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
      <AlertDialog
        open={isBatchDeleteModalOpen}
        onOpenChange={(open) => !open && setIsBatchDeleteModalOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Subjects</AlertDialogTitle>
            <AlertDialogDescription>
              Sigurado ka bang gusto mong idelete ang mga napiling subject?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmBatchDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={replacingRow !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReplacingRow(null)
            setReplacementSubjectId(0)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace Subject Preference</DialogTitle>
            <DialogDescription>
              Select a new subject to replace{" "}
              {replacingRow
                ? (subjectsById.get(replacingRow.subject_id)?.code ??
                  "the current subject")
                : "the current subject"}{" "}
              at rank #{replacingRow?.rank}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <SearchableCombobox
              id="replacement-subject"
              label="Replacement Subject"
              options={(subjectOptions ?? []).filter(
                (opt) =>
                  !preferences.some(
                    (p) =>
                      p.id !== replacingRow?.id &&
                      String(p.subject_id) === opt.value,
                  ),
              )}
              value={replacementSubjectId ? String(replacementSubjectId) : ""}
              onValueChange={(val) => setReplacementSubjectId(Number(val) || 0)}
              placeholder="Search code or subject title"
              emptyMessage="No available curriculum subjects to replace with."
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReplacingRow(null)
                setReplacementSubjectId(0)
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={replacementSubjectId === 0}
              onClick={handleConfirmReplacement}
            >
              Confirm Replacement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
