"use client"

import { useMemo, useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldLabel } from "@/features/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import { useClassRosterQuery } from "@/features/hooks/use-class-roster"
import { useSectionsQuery } from "@/features/hooks/use-reference-data"
import type { ClassRosterEntry } from "@/features/schemas/class-roster-schema"

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

  return (
    <WorkspacePage
      title="Class rosters"
      description="Review the enrolled roster for each of your assigned sections."
      unauthorized={!authorized}
      lastUpdated={rosterQuery.dataUpdatedAt}
    >
      <Card>
        <CardHeader>
          <CardTitle level={2}>Select a section</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={{ ...sectionsQuery, data: ownSections }}
            isEmpty={(sections) => sections.length === 0}
            emptyMessage="No sections are currently assigned to your faculty account."
            loadingLabel="Loading your assigned sections…"
          >
            {(sections) => (
              <Field>
                <FieldLabel htmlFor="roster-section">Section</FieldLabel>
                <Select
                  value={sectionId !== null ? String(sectionId) : ""}
                  onValueChange={(value) => setSectionId(Number(value))}
                >
                  <SelectTrigger id="roster-section" className="w-full">
                    <SelectValue placeholder="Choose a section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={String(section.id)}>
                        Section {section.section_code} ({section.status_label})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>
      {sectionId !== null && (
        <Card>
          <CardHeader>
            <CardTitle level={2}>Roster</CardTitle>
          </CardHeader>
          <CardContent>
            <AsyncBoundary
              query={{ ...rosterQuery, data: rosterQuery.data?.data }}
              isEmpty={(rows) => rows.length === 0}
              emptyMessage="No students are enrolled in this section yet."
              loadingLabel="Loading the class roster…"
            >
              {(rows) => (
                <DataTable
                  caption="Class roster"
                  rowKey={(entry) => entry.id}
                  rows={rows}
                  renderCard={(entry) => (
                    <Card role="article" aria-label={entry.student_number}>
                      <CardHeader>
                        <CardTitle level={3}>{entry.student_number}</CardTitle>
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
                  )}
                  columns={[
                    {
                      key: "student",
                      header: "Student",
                      render: (entry) => entry.student_number,
                    },
                    {
                      key: "subject",
                      header: "Subject",
                      render: (entry) => entry.subject_code,
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (entry) => (
                        <Badge variant={rosterBadgeVariant(entry.status)}>
                          {entry.status_label}
                        </Badge>
                      ),
                    },
                  ]}
                />
              )}
            </AsyncBoundary>
          </CardContent>
        </Card>
      )}
    </WorkspacePage>
  )
}
