"use client"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { ScheduleDecisionControls } from "@/features/components/portal/schedule-decision-workspace"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
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
import { useScheduleProposalsQuery } from "@/features/hooks/use-scheduling"
import { formatAcademicTerm } from "@/features/services/reference-data-service"

export function MasterScheduleWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "executive_director"
  const termsQuery = useAcademicTermsQuery({ enabled: authorized })
  const subjectsQuery = useSubjectsQuery({ enabled: authorized })
  const sectionsQuery = useSectionsQuery({ enabled: authorized })
  const proposalsQuery = useScheduleProposalsQuery({ enabled: authorized })
  const published = (sectionsQuery.data ?? []).filter(
    (section) => section.status === "published",
  )
  const combinedQuery = {
    isPending:
      termsQuery.isPending ||
      subjectsQuery.isPending ||
      sectionsQuery.isPending ||
      proposalsQuery.isPending,
    isError:
      termsQuery.isError ||
      subjectsQuery.isError ||
      sectionsQuery.isError ||
      proposalsQuery.isError,
    error:
      termsQuery.error ??
      subjectsQuery.error ??
      sectionsQuery.error ??
      proposalsQuery.error,
    data: published,
    refetch: () => {
      void termsQuery.refetch()
      void subjectsQuery.refetch()
      void sectionsQuery.refetch()
      void proposalsQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Master schedule"
      description="Published sections are the authoritative schedule visible beyond planning."
      unauthorized={!authorized}
      lastUpdated={sectionsQuery.dataUpdatedAt}
    >
      <AsyncBoundary
        query={combinedQuery}
        isEmpty={(sections) => sections.length === 0}
        emptyMessage="No published sections are available."
        loadingLabel="Loading the master schedule…"
      >
        {(sections) => (
          <>
            <Card>
              <CardHeader>
                <CardTitle level={2}>Published sections</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3 md:grid-cols-2">
                  {sections.map((section) => {
                    const subject = (subjectsQuery.data ?? []).find(
                      (item) => item.id === section.subject_id,
                    )
                    const term = (termsQuery.data ?? []).find(
                      (item) => item.id === section.academic_term_id,
                    )
                    return (
                      <li key={section.id} className="rounded-md border p-3">
                        <p className="font-medium">
                          {subject
                            ? `${subject.code} · ${subject.title}`
                            : `Section #${section.id}`}
                        </p>
                        <p>
                          {term
                            ? formatAcademicTerm(term)
                            : "Academic term unavailable"}
                        </p>
                        <p>
                          {section.section_code} ·{" "}
                          {section.schedule_days ?? "Meeting time pending"} ·{" "}
                          {section.room ?? "Room pending"}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle level={2}>Executive decisions</CardTitle>
              </CardHeader>
              <CardContent>
                <ScheduleDecisionControls
                  actorRole="executive_director"
                  proposals={proposalsQuery.data ?? []}
                />
              </CardContent>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
