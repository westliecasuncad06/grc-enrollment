"use client"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { EnrollmentFunnelChart } from "@/features/components/portal/enrollment-funnel-chart"
import { StuckEnrollmentStatusChart } from "@/features/components/portal/stuck-enrollment-status-chart"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  useEnrollmentSummaryQuery,
  useStuckEnrollmentsQuery,
} from "@/features/hooks/use-dashboard"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import {
  formatAcademicTerm,
  getActiveAcademicTerm,
} from "@/features/services/reference-data-service"

/** Snake-case status keys -> readable labels, no lookup table to keep in sync. */
function humanize(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const funnelStageLabels: Record<string, string> = {
  submitted: "Submitted",
  registrar_decided: "Registrar decided",
  payment_confirmed: "Payment confirmed",
  enrolled: "Enrolled",
}

const funnelStageOrder = [
  "submitted",
  "registrar_decided",
  "payment_confirmed",
  "enrolled",
]

export function EnrollmentDashboardWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "dean"
  const termsQuery = useAcademicTermsQuery({ enabled: authorized })
  const activeTerm = getActiveAcademicTerm(termsQuery.data)
  const summaryQuery = useEnrollmentSummaryQuery(
    activeTerm?.id,
    authorized && termsQuery.isSuccess,
  )
  const stuckQuery = useStuckEnrollmentsQuery(
    activeTerm?.id,
    authorized && termsQuery.isSuccess,
  )
  const combinedQuery = {
    isPending: termsQuery.isPending || summaryQuery.isPending || stuckQuery.isPending,
    isError: termsQuery.isError || summaryQuery.isError || stuckQuery.isError,
    error: termsQuery.error ?? summaryQuery.error ?? stuckQuery.error,
    data:
      summaryQuery.data && stuckQuery.data
        ? { summary: summaryQuery.data, stuck: stuckQuery.data }
        : undefined,
    refetch: () => {
      void termsQuery.refetch()
      void summaryQuery.refetch()
      void stuckQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Enrollment dashboard"
      description={
        activeTerm
          ? `Counts for ${formatAcademicTerm(activeTerm)}, the active term. Every number is a row count or a difference between existing timestamps — nothing here reflects an institutional policy value.`
          : "Counts for the active academic term."
      }
      unauthorized={!authorized}
      lastUpdated={summaryQuery.dataUpdatedAt}
    >
      <AsyncBoundary
        query={combinedQuery}
        loadingLabel="Loading the enrollment dashboard…"
      >
        {({ summary, stuck }) => (
          <div className="grid gap-4">
            <EnrollmentFunnelChart
              stages={funnelStageOrder.map((stage) => ({
                key: stage,
                label: funnelStageLabels[stage] ?? humanize(stage),
                count: summary.funnel_counts[stage] ?? 0,
              }))}
            />
            <StuckEnrollmentStatusChart
              rows={stuck.data}
              thresholdConfigured={stuck.meta.threshold_configured}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle level={2}>Enrollment status</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {Object.entries(summary.status_counts).map(
                    ([status, count]) => (
                      <Badge key={status} variant="outline">
                        {humanize(status)}: {count}
                      </Badge>
                    ),
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle level={2}>Section fill</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <p>
                    {summary.published_sections} of {summary.total_sections}{" "}
                    sections published
                  </p>
                  <p>
                    {summary.total_enrolled_seats} of {summary.total_capacity}{" "}
                    published seats filled
                  </p>
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle level={2}>Grade submission</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {Object.entries(summary.grade_status_counts).map(
                    ([status, count]) => (
                      <Badge key={status} variant="outline">
                        {humanize(status)}: {count}
                      </Badge>
                    ),
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
