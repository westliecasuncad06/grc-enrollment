"use client"

import { Trash2Icon, XIcon } from "lucide-react"

import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
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
import type { CurriculumSubjectInput } from "@/features/schemas/curriculum-schema"
import type { Subject } from "@/features/schemas/reference-data-schema"

export interface CurriculumSubjectSpreadsheetProps {
  yearLevel: number
  subjects: readonly CurriculumSubjectInput[]
  subjectCatalog: readonly Subject[]
  defaultMinimumGrade: string
  isLocked: boolean
  onChange: (subjects: CurriculumSubjectInput[]) => void
  onAddRow: () => void
}

export function CurriculumSubjectSpreadsheet({
  yearLevel,
  subjects,
  subjectCatalog,
  defaultMinimumGrade,
  isLocked,
  onChange,
  onAddRow,
}: CurriculumSubjectSpreadsheetProps) {
  const rows = subjects
    .map((subject, index) => ({ subject, index }))
    .filter(({ subject }) => subject.year_level === yearLevel)
  const subjectFor = (id: number) =>
    subjectCatalog.find((subject) => subject.id === id)
  const codeFor = (id: number) => subjectFor(id)?.code ?? `Subject ${id}`
  const replaceRow = (index: number, update: Partial<CurriculumSubjectInput>) =>
    onChange(
      subjects.map((subject, row) =>
        row === index ? { ...subject, ...update } : subject,
      ),
    )
  const removeRow = (index: number) =>
    onChange(subjects.filter((_, row) => row !== index))
  const addPrerequisite = (index: number, prerequisiteSubjectId: number) => {
    const subject = subjects[index]
    replaceRow(index, {
      prerequisites: [
        ...subject.prerequisites,
        {
          prerequisite_subject_id: prerequisiteSubjectId,
          minimum_grade: defaultMinimumGrade,
        },
      ],
    })
  }
  const removePrerequisite = (index: number, prerequisiteSubjectId: number) => {
    const subject = subjects[index]
    replaceRow(index, {
      prerequisites: subject.prerequisites.filter(
        (edge) => edge.prerequisite_subject_id !== prerequisiteSubjectId,
      ),
    })
  }
  const yearName = `${yearLevel}${yearLevel === 1 ? "st" : yearLevel === 2 ? "nd" : yearLevel === 3 ? "rd" : "th"} Year`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={isLocked}
          onClick={onAddRow}
        >
          Add subject row
        </Button>
      </div>
      <Table aria-label={`${yearName} subjects`}>
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
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="h-20 text-center text-muted-foreground"
              >
                No subjects in this year level yet.
              </TableCell>
            </TableRow>
          )}
          {rows.map(({ subject, index }) => {
            const code = codeFor(subject.subject_id)
            const details = subjectFor(subject.subject_id)
            const candidates = subjects.filter(
              (candidate) =>
                candidate.subject_id !== subject.subject_id &&
                !subject.prerequisites.some(
                  (edge) =>
                    edge.prerequisite_subject_id === candidate.subject_id,
                ),
            )

            return (
              <TableRow key={subject.subject_id}>
                <TableCell>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{code}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${code} row`}
                      disabled={isLocked}
                      onClick={() => removeRow(index)}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal">
                  {details?.title ?? "—"}
                </TableCell>
                <TableCell>{details?.units ?? "—"}</TableCell>
                <TableCell>
                  <Select
                    value={subject.semester}
                    onValueChange={(semester) => {
                      if (semester === "1st" || semester === "2nd")
                        replaceRow(index, { semester })
                    }}
                    disabled={isLocked}
                  >
                    <SelectTrigger
                      aria-label={`Semester for ${code}`}
                      className="min-w-36"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="1st">1st Semester</SelectItem>
                        <SelectItem value="2nd">2nd Semester</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex min-w-52 flex-wrap items-center gap-1">
                    {subject.prerequisites.length === 0 && (
                      <span className="text-muted-foreground">None</span>
                    )}
                    {subject.prerequisites.map((edge) => (
                      <Badge
                        key={edge.prerequisite_subject_id}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {codeFor(edge.prerequisite_subject_id)} ·{" "}
                        {edge.minimum_grade}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove prerequisite ${codeFor(edge.prerequisite_subject_id)} from ${code}`}
                          disabled={isLocked}
                          onClick={() =>
                            removePrerequisite(
                              index,
                              edge.prerequisite_subject_id,
                            )
                          }
                        >
                          <XIcon aria-hidden="true" />
                        </Button>
                      </Badge>
                    ))}
                    <Select
                      value=""
                      onValueChange={(value) =>
                        addPrerequisite(index, Number(value))
                      }
                      disabled={isLocked || candidates.length === 0}
                    >
                      <SelectTrigger
                        aria-label={`Add prerequisite for ${code}`}
                        className="w-auto"
                      >
                        <SelectValue placeholder="Add" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {candidates.map((candidate) => (
                            <SelectItem
                              key={candidate.subject_id}
                              value={String(candidate.subject_id)}
                            >
                              {codeFor(candidate.subject_id)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
