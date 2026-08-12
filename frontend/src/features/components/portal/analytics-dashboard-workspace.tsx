"use client"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { EnrollmentYearOverYearChart } from "@/features/components/portal/enrollment-year-over-year-chart"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
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
import { useProgramChairAnalyticsSummaryQuery } from "@/features/hooks/use-dashboard"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import { useLatestScheduleGenerationRunQuery } from "@/features/hooks/use-schedule-generation"
import { buildPrescriptiveRecommendations } from "@/features/lib/prescriptive-recommendations"
import { getActiveAcademicTerm } from "@/features/services/reference-data-service"
import type { ProgramChairAnalyticsSummary } from "@/features/schemas/dashboard-schema"
import type { ScheduleGenerationRun } from "@/features/schemas/schedule-generation-schema"

/** Snake-case status keys -> readable labels, no lookup table to keep in sync. */
function humanize(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function DescriptiveTab({
  summary,
}: {
  summary: ProgramChairAnalyticsSummary
}) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle level={2}>Enrollment status</CardTitle>
          <p className="text-sm text-muted-foreground">
            Counts for {summary.college.toUpperCase()}, the current term.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(summary.enrollment_status_counts).map(
            ([status, count]) => (
              <Badge key={status} variant="outline">
                {humanize(status)}: {count}
              </Badge>
            ),
          )}
        </CardContent>
      </Card>
      <EnrollmentYearOverYearChart points={summary.year_over_year} />
    </div>
  )
}

function DiagnosticTab({ summary }: { summary: ProgramChairAnalyticsSummary }) {
  const gradeStatuses = [
    ...new Set(summary.retention_breakdown.map((row) => row.grade_status)),
  ]
  const enrollmentStatuses = [
    ...new Set(summary.retention_breakdown.map((row) => row.enrollment_status)),
  ]
  const countFor = (gradeStatus: string, enrollmentStatus: string) =>
    summary.retention_breakdown.find(
      (row) =>
        row.grade_status === gradeStatus &&
        row.enrollment_status === enrollmentStatus,
    )?.count ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Grade status by enrollment status</CardTitle>
        <p className="text-sm text-muted-foreground">
          A lifecycle crosstab of the two statuses recorded today — not a
          pass/fail retention rate. Rows are grade status, columns are
          enrollment status.
        </p>
      </CardHeader>
      <CardContent>
        {gradeStatuses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No retention data is available yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grade status</TableHead>
                  {enrollmentStatuses.map((enrollmentStatus) => (
                    <TableHead key={enrollmentStatus}>
                      {humanize(enrollmentStatus)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {gradeStatuses.map((gradeStatus) => (
                  <TableRow key={gradeStatus}>
                    <TableCell className="font-medium">
                      {humanize(gradeStatus)}
                    </TableCell>
                    {enrollmentStatuses.map((enrollmentStatus) => (
                      <TableCell key={`${gradeStatus}-${enrollmentStatus}`}>
                        {countFor(gradeStatus, enrollmentStatus)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PredictiveTab({
  run,
  loading,
}: {
  run: ScheduleGenerationRun | null
  loading: boolean
}) {
  const forecasts = run?.forecasts ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Section demand forecast</CardTitle>
        <p className="text-sm text-muted-foreground">
          Read-only view of the latest Demand Forecast run. Edit forecasts from
          Schedule &amp; Faculty Loading.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Predicted students</TableHead>
                <TableHead>Sections needed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecasts.length ? (
                forecasts.map((forecast) => (
                  <TableRow
                    key={`${forecast.subject_id}-${forecast.year_level}`}
                  >
                    <TableCell>
                      <p className="font-medium">{forecast.subject_code}</p>
                      <p className="text-xs text-muted-foreground">
                        {forecast.subject_title}
                      </p>
                    </TableCell>
                    <TableCell>{forecast.year_level ?? "—"}</TableCell>
                    <TableCell>
                      {forecast.predicted_demand.toFixed(0)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {forecast.suggested_section_count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-9 text-center text-muted-foreground"
                  >
                    {loading
                      ? "Loading the latest forecast…"
                      : "No forecast rows are available yet. Generate a Demand Forecast from Enrollment."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function PrescriptiveTab({ run }: { run: ScheduleGenerationRun | null }) {
  const recommendations = run ? buildPrescriptiveRecommendations(run) : []

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle level={2}>Recommended actions</CardTitle>
          <Badge variant="outline">Rule-based, not a new model</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Simple rules applied to the existing Demand Forecast numbers above —
          no additional prediction model is involved.
        </p>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Generate a Demand Forecast to see recommended actions.
          </p>
        ) : (
          <ul className="grid gap-2">
            {recommendations.map((recommendation) => (
              <li
                key={recommendation}
                className="rounded-lg border bg-muted/20 p-3 text-sm"
              >
                {recommendation}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function AnalyticsDashboardWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "program_chair"
  const termsQuery = useAcademicTermsQuery({ enabled: authorized })
  const currentTerm = getActiveAcademicTerm(termsQuery.data)
  const termId = currentTerm?.id ?? 0
  const summaryQuery = useProgramChairAnalyticsSummaryQuery(
    currentTerm?.id,
    authorized && termsQuery.isSuccess && currentTerm !== null,
  )
  const runQuery = useLatestScheduleGenerationRunQuery(termId)
  const combinedQuery = {
    isPending: termsQuery.isPending || summaryQuery.isPending,
    isError: termsQuery.isError || summaryQuery.isError,
    error: termsQuery.error ?? summaryQuery.error,
    data: summaryQuery.data,
    refetch: () => {
      void termsQuery.refetch()
      void summaryQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Analytics"
      description="Descriptive, diagnostic, predictive, and prescriptive views built from your college's existing enrollment and forecast data."
      unauthorized={!authorized}
      lastUpdated={summaryQuery.dataUpdatedAt}
    >
      <AsyncBoundary query={combinedQuery} loadingLabel="Loading analytics…">
        {(summary) => (
          <Tabs defaultValue="descriptive">
            <TabsList>
              <TabsTrigger value="descriptive">Descriptive</TabsTrigger>
              <TabsTrigger value="diagnostic">Diagnostic</TabsTrigger>
              <TabsTrigger value="predictive">Predictive</TabsTrigger>
              <TabsTrigger value="prescriptive">Prescriptive</TabsTrigger>
            </TabsList>
            <TabsContent value="descriptive">
              <DescriptiveTab summary={summary} />
            </TabsContent>
            <TabsContent value="diagnostic">
              <DiagnosticTab summary={summary} />
            </TabsContent>
            <TabsContent value="predictive">
              <PredictiveTab
                run={runQuery.data ?? null}
                loading={runQuery.isPending}
              />
            </TabsContent>
            <TabsContent value="prescriptive">
              <PrescriptiveTab run={runQuery.data ?? null} />
            </TabsContent>
          </Tabs>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
