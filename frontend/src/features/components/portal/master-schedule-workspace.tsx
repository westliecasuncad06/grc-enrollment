"use client"

import { useAuth } from "@/features/auth/use-auth"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Skeleton } from "@/features/components/ui/skeleton"
import { ScheduleDecisionControls } from "@/features/components/portal/schedule-decision-workspace"
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
  if (!authorized)
    return (
      <section aria-label="Master schedule workspace">
        <p>This workspace is not available for your role.</p>
      </section>
    )
  const loading =
    termsQuery.isLoading ||
    subjectsQuery.isLoading ||
    sectionsQuery.isLoading ||
    proposalsQuery.isLoading
  const failed =
    termsQuery.isError ||
    subjectsQuery.isError ||
    sectionsQuery.isError ||
    proposalsQuery.isError
  const retry = () =>
    void Promise.all([
      termsQuery.refetch(),
      subjectsQuery.refetch(),
      sectionsQuery.refetch(),
      proposalsQuery.refetch(),
    ])
  const published = (sectionsQuery.data ?? []).filter(
    (section) => section.status === "published",
  )
  return (
    <section aria-label="Master schedule workspace" className="grid gap-4">
      <div>
        <h2>Master schedule</h2>
        <p>
          Published sections are the authoritative schedule visible beyond
          planning.
        </p>
      </div>
      {loading ? (
        <Skeleton className="h-48" />
      ) : failed ? (
        <Alert variant="destructive">
          <AlertDescription>
            The master schedule could not be loaded.{" "}
            <button type="button" onClick={retry}>
              Retry master schedule data
            </button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Published sections</CardTitle>
            </CardHeader>
            <CardContent>
              {published.length === 0 ? (
                <p>No published sections are available.</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {published.map((section) => {
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
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Executive decisions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScheduleDecisionControls
                role="executive_director"
                proposals={proposalsQuery.data ?? []}
              />
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}
