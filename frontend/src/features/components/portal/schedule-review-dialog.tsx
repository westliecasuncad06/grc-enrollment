"use client"

import { useMemo, useState } from "react"
import { ClipboardListIcon } from "lucide-react"

import type { UserRole } from "@/features/auth/roles"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useScheduleReviewSectionsQuery } from "@/features/hooks/use-scheduling"
import { scheduleProposalPresentation } from "@/features/lib/schedule-status"
import { programCodeFromSection } from "@/features/lib/section-program-code"
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

function ScheduleSubjectsTable({
  subjects,
}: {
  subjects: readonly ScheduleReviewSection[]
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>Modality</TableHead>
            <TableHead>Professor</TableHead>
            <TableHead>Units</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Room</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subjects.map((section) => (
            <TableRow key={section.id}>
              <TableCell>
                <div className="font-medium">{section.subject_code}</div>
                <div className="text-muted-foreground">{section.subject_title}</div>
              </TableCell>
              <TableCell>
                <Badge variant={section.modality ? "secondary" : "outline"}>
                  {modalityLabel(section.modality)}
                </Badge>
              </TableCell>
              <TableCell>{valueOrNotAssigned(section.professor_name)}</TableCell>
              <TableCell>{section.units}</TableCell>
              <TableCell>{formatMeeting(section)}</TableCell>
              <TableCell>{valueOrNotAssigned(section.room)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function ScheduleReviewLoading() {
  return (
    <div className="grid gap-3" role="status" aria-label="Loading submitted schedule">
      <Skeleton className="h-8 w-72 max-w-full" />
      <div className="grid gap-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
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
  const groupedPrograms = useMemo(() => {
    const bySection = new Map<string, ScheduleReviewSection[]>()

    for (const section of sections)
      bySection.set(section.section_code, [
        ...(bySection.get(section.section_code) ?? []),
        section,
      ])

    const sectionGroups = [...bySection.entries()]
      .sort(([left], [right]) => collator.compare(left, right))
      .map(([sectionCode, subjects]) => ({ sectionCode, subjects }))

    const byProgram = new Map<string, typeof sectionGroups>()
    for (const group of sectionGroups)
      byProgram.set(programCodeFromSection(group.sectionCode), [
        ...(byProgram.get(programCodeFromSection(group.sectionCode)) ?? []),
        group,
      ])

    return [...byProgram.entries()]
      .sort(([left], [right]) => collator.compare(left, right))
      .map(([program, sectionGroups]) => ({ program, sectionGroups }))
  }, [sections])
  const [activeProgram, setActiveProgram] = useState(
    groupedPrograms[0]?.program ?? "",
  )
  const [activeSection, setActiveSection] = useState(
    groupedPrograms[0]?.sectionGroups[0]?.sectionCode ?? "",
  )

  if (groupedPrograms.length === 0)
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
      value={activeProgram}
      onValueChange={(program) => {
        setActiveProgram(program)
        setActiveSection(
          groupedPrograms.find((group) => group.program === program)
            ?.sectionGroups[0]?.sectionCode ?? "",
        )
      }}
      className="min-w-0 gap-4"
    >
      <div className="overflow-x-auto pb-1">
        <TabsList aria-label="Programs" className="min-w-max">
          {groupedPrograms.map(({ program, sectionGroups }) => (
            <TabsTrigger key={program} value={program}>
              {program}
              <Badge variant="outline" aria-hidden="true">
                {sectionGroups.length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {groupedPrograms.map(({ program, sectionGroups }) => (
        <TabsContent key={program} value={program}>
          <Tabs value={activeSection} onValueChange={setActiveSection} className="min-w-0 gap-4">
            <div className="overflow-x-auto pb-1">
              <TabsList aria-label={`${program} block sections`} className="min-w-max">
                {sectionGroups.map(({ sectionCode, subjects }) => (
                  <TabsTrigger key={sectionCode} value={sectionCode}>
                    {sectionCode}
                    <Badge variant="outline" aria-hidden="true">
                      {subjects.length}
                    </Badge>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {sectionGroups.map(({ sectionCode, subjects }) => (
              <TabsContent key={sectionCode} value={sectionCode}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-heading text-xl font-medium">{sectionCode}</h3>
                  <p className="text-sm text-muted-foreground">
                    {subjects.length} subject{subjects.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ScheduleSubjectsTable subjects={subjects} />
              </TabsContent>
            ))}
          </Tabs>
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
      <DialogContent className="grid max-h-[100dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none p-0 sm:max-h-[90dvh] sm:max-w-6xl sm:rounded-xl">
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
