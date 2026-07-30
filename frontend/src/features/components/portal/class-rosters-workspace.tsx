"use client"

import { useMemo, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldLabel } from "@/features/components/ui/field"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useClassRosterQuery } from "@/features/hooks/use-class-roster"
import { useSectionsQuery } from "@/features/hooks/use-reference-data"
import type { ClassRosterEntry } from "@/features/schemas/class-roster-schema"

const selectClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30"

function rosterBadgeVariant(
  status: ClassRosterEntry["status"],
): "default" | "secondary" | "outline" {
  if (status === "enrolled") return "default"
  if (status === "dropped") return "outline"
  return "secondary"
}

export function ClassRostersWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "faculty"
  const [sectionId, setSectionId] = useState<number | null>(null)

  const sectionsQuery = useSectionsQuery({ enabled: authorized })
  const facultyId = Number(session?.userId)
  const ownSections = useMemo(() => {
    if (!Number.isSafeInteger(facultyId) || facultyId <= 0) return []
    return (sectionsQuery.data ?? []).filter(
      (section) => section.professor_id === facultyId,
    )
  }, [sectionsQuery.data, facultyId])

  const rosterQuery = useClassRosterQuery(
    { section_id: sectionId ?? undefined, page: 1, per_page: 100 },
    { enabled: authorized && sectionId !== null },
  )

  if (!authorized) {
    return (
      <section aria-label="Class rosters workspace">
        <p>This workspace is not available for your role.</p>
      </section>
    )
  }

  return (
    <section aria-label="Class rosters workspace" className="grid gap-4">
      <div>
        <h2>Class rosters</h2>
        <p>Review the enrolled roster for each of your assigned sections.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Select a section</CardTitle>
        </CardHeader>
        <CardContent>
          {sectionsQuery.isLoading ? (
            <Skeleton className="h-8" />
          ) : ownSections.length === 0 ? (
            <p>No sections are currently assigned to your faculty account.</p>
          ) : (
            <Field>
              <FieldLabel htmlFor="roster-section">Section</FieldLabel>
              <select
                id="roster-section"
                className={selectClassName}
                value={sectionId ?? ""}
                onChange={(event) =>
                  setSectionId(
                    event.target.value ? Number(event.target.value) : null,
                  )
                }
              >
                <option value="">Choose a section</option>
                {ownSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    Section {section.section_code} ({section.status_label})
                  </option>
                ))}
              </select>
            </Field>
          )}
        </CardContent>
      </Card>
      {sectionId !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Roster</CardTitle>
          </CardHeader>
          <CardContent>
            {rosterQuery.isLoading ? (
              <Skeleton className="h-32" />
            ) : rosterQuery.isError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  The roster could not be loaded. Refresh the page and try
                  again.
                </AlertDescription>
              </Alert>
            ) : (rosterQuery.data?.data.length ?? 0) === 0 ? (
              <p>No students are enrolled in this section yet.</p>
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(rosterQuery.data?.data ?? []).map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {entry.student_number}
                          </TableCell>
                          <TableCell>{entry.subject_code}</TableCell>
                          <TableCell>
                            <Badge variant={rosterBadgeVariant(entry.status)}>
                              {entry.status_label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-3 md:hidden">
                  {(rosterQuery.data?.data ?? []).map((entry) => (
                    <Card
                      key={entry.id}
                      role="article"
                      aria-label={entry.student_number}
                    >
                      <CardHeader>
                        <CardTitle>{entry.student_number}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <dl className="grid grid-cols-2 gap-2 text-sm">
                          <dt>Subject</dt>
                          <dd>{entry.subject_code}</dd>
                        </dl>
                        <Badge
                          className="mt-3"
                          variant={rosterBadgeVariant(entry.status)}
                        >
                          {entry.status_label}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  )
}
