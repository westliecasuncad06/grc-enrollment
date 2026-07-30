"use client"

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
import {
  useAcademicTermsQuery,
  useSectionsQuery,
  useSubjectsQuery,
} from "@/features/hooks/use-reference-data"
import { getFacultyTeachingSchedule } from "@/features/services/faculty-service"

export function TeachingScheduleWorkspace() {
  const { session } = useAuth()
  const termsQuery = useAcademicTermsQuery()
  const subjectsQuery = useSubjectsQuery()
  const sectionsQuery = useSectionsQuery()
  const facultyId = Number(session?.userId)
  const assignedSections =
    Number.isSafeInteger(facultyId) && facultyId > 0
      ? (sectionsQuery.data ?? []).filter(
          (section) => section.professor_id === facultyId,
        )
      : []
  const rows = getFacultyTeachingSchedule(
    assignedSections,
    subjectsQuery.data ?? [],
    termsQuery.data ?? [],
  )
  const combinedQuery = {
    isPending:
      termsQuery.isPending ||
      subjectsQuery.isPending ||
      sectionsQuery.isPending,
    isError:
      termsQuery.isError || subjectsQuery.isError || sectionsQuery.isError,
    error: termsQuery.error ?? subjectsQuery.error ?? sectionsQuery.error,
    data: rows,
    refetch: () => {
      void termsQuery.refetch()
      void subjectsQuery.refetch()
      void sectionsQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Teaching schedule"
      description="This schedule contains sections assigned to your faculty account."
    >
      <AsyncBoundary
        query={combinedQuery}
        isEmpty={(schedule) => schedule.length === 0}
        emptyMessage="No teaching schedule is available for your account."
        loadingLabel="Loading your teaching schedule…"
      >
        {(schedule) => (
          <DataTable
            caption="Teaching schedule"
            rowKey={(row) => row.sectionId}
            rows={schedule}
            renderCard={(row) => (
              <Card
                role="article"
                aria-label={`${row.subjectCode} ${row.subjectTitle}`}
              >
                <CardHeader>
                  <CardTitle level={3}>
                    {row.subjectCode} · {row.subjectTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt>Term</dt>
                    <dd>{row.termLabel}</dd>
                    <dt>Days</dt>
                    <dd>{row.days}</dd>
                    <dt>Time</dt>
                    <dd>{row.time}</dd>
                    <dt>Room</dt>
                    <dd>{row.room}</dd>
                  </dl>
                  <Badge className="mt-3">{row.statusLabel}</Badge>
                </CardContent>
              </Card>
            )}
            columns={[
              {
                key: "subject",
                header: "Subject",
                render: (row) => `${row.subjectCode} · ${row.subjectTitle}`,
              },
              { key: "term", header: "Term", render: (row) => row.termLabel },
              { key: "days", header: "Days", render: (row) => row.days },
              { key: "time", header: "Time", render: (row) => row.time },
              { key: "room", header: "Room", render: (row) => row.room },
              {
                key: "status",
                header: "Status",
                render: (row) => <Badge>{row.statusLabel}</Badge>,
              },
            ]}
          />
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
