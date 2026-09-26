"use client"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { PublishedSectionsPanel } from "@/features/components/portal/published-sections-panel"
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
  useProgramsQuery,
  useSectionsQuery,
  useSubjectsQuery,
} from "@/features/hooks/use-reference-data"
import { useCurriculaQuery } from "@/features/hooks/use-curricula"
import { useScheduleProposalsQuery } from "@/features/hooks/use-scheduling"
import { useSectionPlansQuery } from "@/features/hooks/use-section-plans"
import { getActiveAcademicTerm } from "@/features/services/reference-data-service"

/**
 * The Registrar Head's read-only window onto the schedules Program Heads
 * submit. Approving and publishing stay with the Dean and the Executive
 * Director; the Registrar Head only needs to see what was planned so the
 * schedule can be checked against enrollment. Post-publication edits reach
 * the Registrar Head as change requests instead (see the schedule change
 * requests workspace).
 */
export function SubmittedSchedulesWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "registrar_head"
  const termsQuery = useAcademicTermsQuery({ enabled: authorized })
  const subjectsQuery = useSubjectsQuery({ enabled: authorized })
  const sectionsQuery = useSectionsQuery({ enabled: authorized })
  const proposalsQuery = useScheduleProposalsQuery({ enabled: authorized })
  const curriculaQuery = useCurriculaQuery()
  const programsQuery = useProgramsQuery({ enabled: authorized })
  const activeTerm = getActiveAcademicTerm(termsQuery.data)
  // College and year level live on the section plan a published section came
  // from; a slow plan fetch must not block the section list itself.
  const sectionPlansQuery = useSectionPlansQuery(
    activeTerm?.id ?? 0,
    authorized && activeTerm !== null,
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
  const submittedProposalsQuery = {
    isPending: proposalsQuery.isPending,
    isError: proposalsQuery.isError,
    error: proposalsQuery.error,
    // A plan a Program Head is still drafting is not "submitted" yet.
    data: (proposalsQuery.data ?? []).filter(
      (proposal) => proposal.is_submitted !== false,
    ),
    refetch: () => {
      void proposalsQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Submitted schedules"
      description="See the class schedules each Program Head has submitted and the sections that are already published. This view is read-only."
      unauthorized={!authorized}
      lastUpdated={sectionsQuery.dataUpdatedAt}
    >
      <Tabs defaultValue="submitted" className="gap-4">
        <TabsList aria-label="Submitted schedule views">
          <TabsTrigger value="submitted">Submitted plans</TabsTrigger>
          <TabsTrigger value="published">Published sections</TabsTrigger>
        </TabsList>

        <TabsContent value="submitted">
          <Card>
            <CardHeader>
              <CardTitle level={2}>Plans from Program Heads</CardTitle>
              <CardDescription>
                Every submitted department plan with its current status. Open
                one to see its sections.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AsyncBoundary
                query={submittedProposalsQuery}
                isEmpty={(proposals) => proposals.length === 0}
                emptyMessage="No Program Head has submitted a schedule yet."
                loadingLabel="Loading submitted schedules…"
              >
                {(proposals) => (
                  <ScheduleDecisionControls
                    actorRole="registrar_head"
                    proposals={proposals}
                    viewMode="history_only"
                    readOnly
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
                Finalized sections in the current master schedule.
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
