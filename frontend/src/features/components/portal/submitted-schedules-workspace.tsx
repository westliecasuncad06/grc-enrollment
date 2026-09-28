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
import type { ScheduleProposal } from "@/features/schemas/scheduling-schema"

interface HistoryEntry {
  key: string
  termLabel: string
  collegeLabel: string
  actionLabel: string
  actorName: string
  decidedAt: string
  notes: string | null
}

/** Every Dean/Executive Director decision across every submitted plan, newest first \u2014 the log a
 * per-proposal "decision history" panel cannot show on its own, since it only covers one proposal. */
function flattenHistory(
  proposals: readonly ScheduleProposal[],
): HistoryEntry[] {
  return proposals
    .flatMap((proposal) =>
      (proposal.decision_history ?? []).map((entry, index) => ({
        key: `${proposal.id}-${index}`,
        termLabel:
          proposal.academic_term_label ?? `Term #${proposal.academic_term_id}`,
        collegeLabel: proposal.college_label ?? "\u2014",
        actionLabel: entry.action_label,
        actorName: entry.actor_name,
        decidedAt: entry.decided_at,
        notes: entry.notes,
      })),
    )
    .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))
}

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
          <TabsTrigger value="history">History</TabsTrigger>
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

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle level={2}>Decision history</CardTitle>
              <CardDescription>
                Every Dean and Executive Director decision across every
                submitted plan, newest first \u2014 across every school year and
                semester, not only the current one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AsyncBoundary
                query={submittedProposalsQuery}
                isEmpty={(proposals) => flattenHistory(proposals).length === 0}
                emptyMessage="No decision has been recorded yet."
                loadingLabel="Loading decision history\u2026"
              >
                {(proposals) => {
                  const history = flattenHistory(proposals)

                  return (
                    <div className="overflow-x-auto">
                      <Table
                        data-stack-mobile
                        aria-label="Schedule decision history"
                      >
                        <TableHeader>
                          <TableRow>
                            <TableHead>Term</TableHead>
                            <TableHead>College</TableHead>
                            <TableHead>Decision</TableHead>
                            <TableHead>By</TableHead>
                            <TableHead>When</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {history.map((entry) => (
                            <TableRow key={entry.key}>
                              <TableCell data-label="Term">
                                {entry.termLabel}
                              </TableCell>
                              <TableCell data-label="College">
                                {entry.collegeLabel}
                              </TableCell>
                              <TableCell data-label="Decision">
                                {entry.actionLabel}
                              </TableCell>
                              <TableCell data-label="By">
                                {entry.actorName}
                              </TableCell>
                              <TableCell data-label="When">
                                {new Date(entry.decidedAt).toLocaleString()}
                              </TableCell>
                              <TableCell data-label="Notes">
                                {entry.notes ?? "\u2014"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                }}
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
