"use client"

import { useAuth } from "@/features/auth/use-auth"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
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
import { useStuckEnrollmentsQuery } from "@/features/hooks/use-dashboard"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import {
  formatAcademicTerm,
  getActiveAcademicTerm,
} from "@/features/services/reference-data-service"

export function StuckStudentsWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "dean"
  const termsQuery = useAcademicTermsQuery({ enabled: authorized })
  const activeTerm = getActiveAcademicTerm(termsQuery.data)
  const stuckQuery = useStuckEnrollmentsQuery(
    activeTerm?.id,
    authorized && termsQuery.isSuccess,
  )
  const combinedQuery = {
    isPending: termsQuery.isPending || stuckQuery.isPending,
    isError: termsQuery.isError || stuckQuery.isError,
    error: termsQuery.error ?? stuckQuery.error,
    data: stuckQuery.data,
    refetch: () => {
      void termsQuery.refetch()
      void stuckQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Stuck students"
      description={
        activeTerm
          ? `Enrollments still moving toward "enrolled" for ${formatAcademicTerm(activeTerm)}, sorted by how long each has sat in its current status.`
          : 'Enrollments still moving toward "enrolled", sorted by dwell time.'
      }
      unauthorized={!authorized}
      lastUpdated={stuckQuery.dataUpdatedAt}
    >
      <AsyncBoundary
        query={combinedQuery}
        isEmpty={(response) => response.data.length === 0}
        emptyMessage="No enrollments are currently in progress toward enrolled for this term."
        loadingLabel="Loading stuck-student data…"
      >
        {(response) => (
          <>
            {!response.meta.threshold_configured && (
              <Alert>
                <AlertDescription>
                  No institutional threshold is configured for how many days
                  counts as "stuck" — this question has not yet been asked of
                  GRC, let alone answered. Every row below still shows its real
                  dwell time; none is flagged until a threshold is set.
                </AlertDescription>
              </Alert>
            )}
            <Card>
              <CardHeader>
                <CardTitle level={2}>In-progress enrollments</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  caption="Stuck students"
                  rowKey={(row) => row.enrollment_id}
                  rows={response.data}
                  columns={[
                    {
                      key: "student_number",
                      header: "Student",
                      render: (row) => row.student_number,
                    },
                    {
                      key: "status",
                      header: "Status",
                      render: (row) => (
                        <Badge variant="outline">{row.status_label}</Badge>
                      ),
                    },
                    {
                      key: "days_in_status",
                      header: "Days in status",
                      render: (row) => row.days_in_status,
                    },
                    {
                      key: "is_flagged",
                      header: "Flagged",
                      render: (row) =>
                        row.is_flagged ? (
                          <Badge variant="destructive">Past threshold</Badge>
                        ) : (
                          "—"
                        ),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
