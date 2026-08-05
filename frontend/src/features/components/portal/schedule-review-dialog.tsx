"use client"

import { useMemo, useState } from "react"
import { ClipboardListIcon } from "lucide-react"

import type { UserRole } from "@/features/auth/roles"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/features/components/ui/empty"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/features/components/ui/tabs"
import { useScheduleReviewSectionsQuery } from "@/features/hooks/use-scheduling"
import { scheduleProposalPresentation } from "@/features/lib/schedule-status"
import type {
  ScheduleAction,
  ScheduleProposal,
  ScheduleReviewSection,
} from "@/features/schemas/scheduling-schema"
import { availableScheduleActions } from "@/features/services/scheduling-service"

interface ScheduleReviewDialogProps {
  actorRole: UserRole
  proposal: ScheduleProposal | null
  decisionPending: boolean
  onOpenChange: (open: boolean) => void
  onDecision: (proposal: ScheduleProposal, action: ScheduleAction) => void
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

const reviewActionLabels: Partial<Record<ScheduleAction, string>> = {
  dean_approve: "Approve schedule",
  dean_return: "Return with notes",
  executive_return: "Return with notes",
  publish: "Publish schedule",
  close: "Close proposal",
}

function isReturnAction(action: ScheduleAction) {
  return action === "dean_return" || action === "executive_return"
}

function valueOrNotAssigned(value: string | null) {
  const normalized = value?.trim()
  if (!normalized) return "Not assigned"

  return normalized
}

function formatMeeting(section: ScheduleReviewSection) {
  if (
    !section.schedule_days ||
    !section.starts_at_time ||
    !section.ends_at_time
  )
    return "Not assigned"

  return `${section.schedule_days} · ${section.starts_at_time.slice(0, 5)}–${section.ends_at_time.slice(0, 5)}`
}

function modalityLabel(modality: ScheduleReviewSection["modality"]) {
  if (!modality) return "Not assigned"

  return modality.replaceAll("_", " ").toUpperCase()
}

function ScheduleSubjectCard({ section }: { section: ScheduleReviewSection }) {
  return (
    <Card
      role="article"
      aria-label={`${section.subject_code} schedule review`}
      size="sm"
      className="h-full"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle level={3}>{section.subject_code}</CardTitle>
            <CardDescription>{section.subject_title}</CardDescription>
          </div>
          <Badge variant={section.modality ? "secondary" : "outline"}>
            {modalityLabel(section.modality)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Professor</dt>
            <dd className="font-medium">{valueOrNotAssigned(section.professor_name)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Units</dt>
            <dd className="font-medium">{section.units}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Schedule</dt>
            <dd className="font-medium">{formatMeeting(section)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Room</dt>
            <dd className="font-medium">{valueOrNotAssigned(section.room)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}

function ScheduleReviewLoading() {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading submitted schedule">
      <Skeleton className="h-8 w-72 max-w-full" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    </div>
  )
}

function ScheduleSectionTabs({
  proposalId,
  sections,
}: {
  proposalId: number
  sections: readonly ScheduleReviewSection[]
}) {
  const groupedSections = useMemo(() => {
    const groups = new Map<string, ScheduleReviewSection[]>()

    for (const section of sections)
      groups.set(section.section_code, [
        ...(groups.get(section.section_code) ?? []),
        section,
      ])

    return [...groups.entries()]
      .sort(([left], [right]) => collator.compare(left, right))
      .map(([sectionCode, subjects]) => ({ sectionCode, subjects }))
  }, [sections])
  const [activeSection, setActiveSection] = useState(
    groupedSections[0]?.sectionCode ?? "",
  )

  if (groupedSections.length === 0)
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardListIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No schedule rows submitted</EmptyTitle>
          <EmptyDescription>
            This proposal does not contain any subject schedules to review.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <p>Return to the review queue and confirm the submitted proposal.</p>
        </EmptyContent>
      </Empty>
    )

  return (
    <Tabs
      key={proposalId}
      value={activeSection}
      onValueChange={setActiveSection}
      className="min-w-0 gap-4"
    >
      <div className="overflow-x-auto pb-1">
        <TabsList aria-label="Submitted block sections" className="min-w-max">
          {groupedSections.map(({ sectionCode, subjects }) => (
            <TabsTrigger key={sectionCode} value={sectionCode}>
              {sectionCode}
              <Badge variant="outline" aria-hidden="true">
                {subjects.length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {groupedSections.map(({ sectionCode, subjects }) => (
        <TabsContent key={sectionCode} value={sectionCode}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-heading text-xl font-medium">{sectionCode}</h3>
            <p className="text-sm text-muted-foreground">
              {subjects.length} subject{subjects.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {subjects.map((section) => (
              <ScheduleSubjectCard key={section.id} section={section} />
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}

export function ScheduleReviewDialog({
  actorRole,
  proposal,
  decisionPending,
  onOpenChange,
  onDecision,
}: ScheduleReviewDialogProps) {
  const sectionsQuery = useScheduleReviewSectionsQuery(proposal?.id ?? null)
  const sections = sectionsQuery.data ?? []
  const sectionCount = new Set(sections.map((section) => section.section_code))
    .size
  const actions = proposal
    ? availableScheduleActions(actorRole, proposal)
    : []
  const presentation = proposal ? scheduleProposalPresentation(proposal) : null
  const priorReturn = proposal
    ? [...(proposal.decision_history ?? [])]
        .reverse()
        .find((decision) => decision.action === "dean_return" || decision.action === "executive_return")
    : undefined

  return (
    <Dialog open={proposal !== null} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[100dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none p-0 sm:max-h-[90dvh] sm:max-w-5xl sm:rounded-xl">
        <DialogHeader className="px-4 pt-4 pr-12 sm:px-6 sm:pt-6 sm:pr-14">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <DialogTitle>
                Review schedule · {proposal?.college_label ?? proposal?.college?.toUpperCase() ?? "Department"}
              </DialogTitle>
              <DialogDescription>
                {proposal?.academic_term_label ?? "Academic term"} · Submitted by {proposal?.submitted_by_name ?? "Program Chair"}
              </DialogDescription>
            </div>
            {proposal && presentation && (
              <Badge variant={presentation.badgeVariant}>{presentation.label}</Badge>
            )}
          </div>
          {!sectionsQuery.isPending && !sectionsQuery.isError && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline">
                {sectionCount} block section{sectionCount === 1 ? "" : "s"}
              </Badge>
              <Badge variant="outline">
                {sections.length} subject schedule{sections.length === 1 ? "" : "s"}
              </Badge>
            </div>
          )}
          {priorReturn && (
            <Alert className="mt-2">
              <AlertDescription>
                <span className="font-medium text-foreground">Previously returned</span> by {priorReturn.actor_name}
                {priorReturn.notes ? `: ${priorReturn.notes}` : "."}
              </AlertDescription>
            </Alert>
          )}
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6">
          {sectionsQuery.isPending ? (
            <ScheduleReviewLoading />
          ) : sectionsQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>The submitted schedule could not be loaded.</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void sectionsQuery.refetch()}
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : proposal ? (
            <ScheduleSectionTabs
              key={proposal.id}
              proposalId={proposal.id}
              sections={sections}
            />
          ) : null}
        </div>

        <DialogFooter
          showCloseButton
          className="m-0 rounded-none px-4 pb-4 [&_button]:w-full sm:px-6 sm:pb-6 sm:[&_button]:w-auto"
        >
          {proposal &&
            actions.map((action) => (
              <Button
                key={action}
                type="button"
                variant={isReturnAction(action) ? "outline" : "default"}
                disabled={decisionPending}
                onClick={() => onDecision(proposal, action)}
              >
                {reviewActionLabels[action] ?? "Continue"}
              </Button>
            ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
