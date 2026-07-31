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
  const sectionsListQuery = {
    isPending:
      termsQuery.isPending ||
      subjectsQuery.isPending ||
      sectionsQuery.isPending,
    isError:
      termsQuery.isError || subjectsQuery.isError || sectionsQuery.isError,
    error: termsQuery.error ?? subjectsQuery.error ?? sectionsQuery.error,
    data: published,
    refetch: () => {
      void termsQuery.refetch()
      void subjectsQuery.refetch()
      void sectionsQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Master schedule"
      description="Published sections are the authoritative schedule visible beyond planning."
      unauthorized={!authorized}
      lastUpdated={sectionsQuery.dataUpdatedAt}
    >
      {/*
       * Two independent boundaries, deliberately not one combined boundary:
       * an empty published-sections list must never hide the decision
       * controls, since approving the very first proposal is exactly what
       * publishes the very first section. A prior version gated both cards
       * on `published.length === 0`, which locked the Executive Director
       * out of approving anything until a section already existed.
       */}
      <Card>
        <CardHeader>
          <CardTitle level={2}>Published sections</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={sectionsListQuery}
            isEmpty={(sections) => sections.length === 0}
            emptyMessage="No published sections are available."
            loadingLabel="Loading the master schedule…"
          >
            {(sections) => (
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
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle level={2}>Executive decisions</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={proposalsQuery}
            loadingLabel="Loading schedule proposals…"
          >
            {(proposals) => (
              <ScheduleDecisionControls
                actorRole="executive_director"
                proposals={proposals}
              />
            )}
          </AsyncBoundary>
        </CardContent>
      </Card>
    </WorkspacePage>
  )
}
