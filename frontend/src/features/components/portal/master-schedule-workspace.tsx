"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

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
  useCurriculaQuery,
  useProgramsQuery,
  useSectionsQuery,
  useSubjectsQuery,
} from "@/features/hooks/use-reference-data"
import { useScheduleProposalsQuery } from "@/features/hooks/use-scheduling"
import { useSectionPlansQuery } from "@/features/hooks/use-section-plans"
import { getActiveAcademicTerm } from "@/features/services/reference-data-service"

const PublishedSectionsPanel = dynamic(
  () =>
    import("@/features/components/portal/published-sections-panel").then(
      (module) => module.PublishedSectionsPanel,
    ),
  { loading: () => <p role="status">Loading published sections…</p> },
)

export function MasterScheduleWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "executive_director"
  const [activeTab, setActiveTab] = useState("review")
  const historyEnabled = authorized && activeTab === "history"
  const termsQuery = useAcademicTermsQuery({ enabled: historyEnabled })
  const subjectsQuery = useSubjectsQuery({ enabled: historyEnabled })
  const sectionsQuery = useSectionsQuery({ enabled: historyEnabled })
  const proposalsQuery = useScheduleProposalsQuery({ enabled: authorized })
  const curriculaQuery = useCurriculaQuery({ enabled: historyEnabled })
  const programsQuery = useProgramsQuery({ enabled: historyEnabled })
  const activeTerm = getActiveAcademicTerm(termsQuery.data)
  // College and year level live on the section plan a published section was
  // generated from, not on the section itself — joined below by
  // `section_plan_id`. This deliberately isn't folded into `sectionsListQuery`:
  // it only powers the College/Year filter buttons, so a slow or failed plan
  // fetch should never block the published-sections list from rendering.
  const sectionPlansQuery = useSectionPlansQuery(
    activeTerm?.id ?? 0,
    historyEnabled && activeTerm !== null,
  )
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
        <TabsList aria-label="Executive enrollment review views">
          <TabsTrigger value="review">For review</TabsTrigger>
          <TabsTrigger value="history">Decision History</TabsTrigger>
        </TabsList>

        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle level={2}>Schedules for review</CardTitle>
              <CardDescription>
                Department plans waiting for an Executive Director decision or revision.
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
                    viewMode="review_only"
                  />
                )}
              </AsyncBoundary>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle level={2}>Schedule decision history</CardTitle>
              <CardDescription>
                Status and review history for submitted department schedules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AsyncBoundary
                query={proposalsQuery}
                loadingLabel="Loading schedule decision history…"
              >
                {(proposals) => (
                  <ScheduleDecisionControls
                    actorRole="executive_director"
                    proposals={proposals}
                    viewMode="history_only"
                  />
                )}
              </AsyncBoundary>
            </CardContent>
          </Card>

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
                  <PublishedSectionsPanel
                    sections={sections}
                    subjects={subjectsQuery.data ?? []}
                    sectionPlans={sectionPlansQuery.data ?? []}
                    curricula={curriculaQuery.data ?? []}
                    programs={programsQuery.data ?? []}
                  />
                )}
              </AsyncBoundary>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </WorkspacePage>
  )
}
