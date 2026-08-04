"use client"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { ScheduleDecisionControls } from "@/features/components/portal/schedule-decision-workspace"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/features/components/ui/tabs"
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
      title="Enrollment planning review"
      description="Review submitted department plans, return them with notes when changes are needed, and publish approved schedules."
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
      <Tabs defaultValue="review" className="gap-4">
        <TabsList aria-label="Executive enrollment review views">
          <TabsTrigger value="review">For review</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle level={2}>Schedules for review</CardTitle>
              <CardDescription>
                Department plans waiting for an Executive Director decision.
              </CardDescription>
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
        </TabsContent>

        <TabsContent value="published">
          <Card>
            <CardHeader>
              <CardTitle level={2}>Published sections</CardTitle>
              <CardDescription>
                Finalized sections available in the current master schedule.
              </CardDescription>
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
                        <li key={section.id}>
                          <Card size="sm" className="h-full">
                            <CardHeader>
                              <CardTitle level={3}>
                                {subject
                                  ? `${subject.code} · ${subject.title}`
                                  : `Section #${section.id}`}
                              </CardTitle>
                              <CardDescription>
                                {term
                                  ? formatAcademicTerm(term)
                                  : "Academic term unavailable"}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                                <div>
                                  <dt className="text-muted-foreground">Section</dt>
                                  <dd className="font-medium">{section.section_code}</dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground">Meeting</dt>
                                  <dd className="font-medium">{section.schedule_days ?? "Not assigned"}</dd>
                                </div>
                                <div className="col-span-2">
                                  <dt className="text-muted-foreground">Room</dt>
                                  <dd className="font-medium">{section.room ?? "Not assigned"}</dd>
                                </div>
                              </dl>
                            </CardContent>
                          </Card>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </AsyncBoundary>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </WorkspacePage>
  )
}
