"use client"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { useInstitutionSummaryQuery } from "@/features/hooks/use-dashboard"

/** Snake-case status keys -> readable labels, no lookup table to keep in sync. */
function humanize(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function InstitutionDashboardWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "executive_director"
  const query = useInstitutionSummaryQuery(authorized)

  return (
    <WorkspacePage
      title="Institution dashboard"
      description="Institution-wide counts across every academic term. Every number is a row count — nothing here reflects an institutional policy value."
      unauthorized={!authorized}
      lastUpdated={query.dataUpdatedAt}
    >
      <AsyncBoundary
        query={query}
        loadingLabel="Loading the institution dashboard…"
      >
        {(summary) => (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle level={2}>Enrollment status, all terms</CardTitle>
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
                <CardTitle level={2}>Programs and sections</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <p>
                  {summary.active_programs} of {summary.total_programs} programs
                  active
                </p>
                <p>
                  {summary.published_sections} of {summary.total_sections}{" "}
                  sections published
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle level={2}>Students by program</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {Object.entries(summary.program_counts).map(([code, count]) => (
                  <Badge key={code} variant="secondary">
                    {code}: {count}
                  </Badge>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle level={2}>Year over year</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Enrollment count per school year, oldest first.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {summary.year_over_year.map((entry) => (
                  <Badge key={entry.school_year} variant="outline">
                    {entry.school_year}: {entry.enrollment_count}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
