"use client"

import { Building2, CalendarClock, DoorOpen, ShieldCheck } from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/features/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useAcademicTermsQuery, useSectionsQuery } from "@/features/hooks/use-reference-data"
import { useRoomOptionsQuery } from "@/features/hooks/use-room-catalog"
import { getActiveAcademicTerm } from "@/features/services/reference-data-service"
import { getLocalRoomOptions } from "@/features/services/room-catalog-service"

const modalityLabel: Record<"hyflex_a" | "hyflex_b" | "f2f", string> = {
  hyflex_a: "HyFlex A",
  hyflex_b: "HyFlex B",
  f2f: "F2F",
}

export function RoomsOperationsWorkspace() {
  const { session } = useAuth()
  const termsQuery = useAcademicTermsQuery()
  const roomsQuery = useRoomOptionsQuery()
  const sectionsQuery = useSectionsQuery()
  const activeTerm = getActiveAcademicTerm(termsQuery.data)
  const roomOptions = roomsQuery.data ?? getLocalRoomOptions(session?.college)
  const scheduledSections = (sectionsQuery.data ?? []).filter(
    (section) =>
      section.academic_term_id === activeTerm?.id &&
      section.room !== null &&
      section.schedule_days !== null,
  )
  const occupancyByRoom = new Map<string, number>()
  for (const section of scheduledSections) {
    if (section.room) {
      occupancyByRoom.set(section.room, (occupancyByRoom.get(section.room) ?? 0) + 1)
    }
  }
  const query = {
    isPending: termsQuery.isPending || roomsQuery.isPending || sectionsQuery.isPending,
    isError: termsQuery.isError || roomsQuery.isError || sectionsQuery.isError,
    error: termsQuery.error ?? roomsQuery.error ?? sectionsQuery.error,
    data: true as const,
    refetch: () => {
      void termsQuery.refetch()
      void roomsQuery.refetch()
      void sectionsQuery.refetch()
    },
  }

  return (
    <WorkspacePage
      title="Rooms operations"
      description={
        session?.role === "registrar_head"
          ? "System-wide room inventory and scheduled use. Registrar Head manages inventory; assignments remain college-owned."
          : "Your college's room availability and scheduled physical-week use before you assign a section."
      }
      unauthorized={session?.role !== "program_chair" && session?.role !== "registrar_head"}
      lastUpdated={Math.max(roomsQuery.dataUpdatedAt, sectionsQuery.dataUpdatedAt)}
    >
      <AsyncBoundary query={query} loadingLabel="Loading room availability…">
        {() => (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle level={2} className="text-sm font-medium">Available room records</CardTitle>
                  <DoorOpen className="size-4 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{roomOptions.length}</CardContent>
              </Card>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle level={2} className="text-sm font-medium">Scheduled classes</CardTitle>
                  <CalendarClock className="size-4 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{scheduledSections.length}</CardContent>
              </Card>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle level={2} className="text-sm font-medium">Assignment control</CardTitle>
                  {session?.role === "registrar_head" ? <ShieldCheck className="size-4 text-primary" aria-hidden="true" /> : <Building2 className="size-4 text-primary" aria-hidden="true" />}
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {session?.role === "registrar_head" ? "Inventory owner" : "College assignment view"}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle level={2}>Room availability board</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Scheduled classes</TableHead><TableHead>Current view</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {roomOptions.map((room) => {
                      const scheduledCount = occupancyByRoom.get(room.name) ?? 0
                      return <TableRow key={room.id}><TableCell className="font-medium">{room.name}</TableCell><TableCell>{scheduledCount}</TableCell><TableCell><Badge variant={scheduledCount === 0 ? "secondary" : "outline"}>{scheduledCount === 0 ? "No scheduled use" : "Review time slots"}</Badge></TableCell></TableRow>
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle level={2}>Scheduled room use</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {scheduledSections.length === 0 ? <p className="text-sm text-muted-foreground">No room assignments are scheduled for the active term yet.</p> : scheduledSections.map((section) => (
                  <div key={section.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                    <span className="font-medium">{section.section_code} · Subject #{section.subject_id}</span>
                    <span>{section.room} · {section.schedule_days} {section.starts_at_time?.slice(0, 5)}–{section.ends_at_time?.slice(0, 5)}</span>
                    {section.modality && <Badge variant="outline">{modalityLabel[section.modality as keyof typeof modalityLabel] ?? "Needs reassignment"}</Badge>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
