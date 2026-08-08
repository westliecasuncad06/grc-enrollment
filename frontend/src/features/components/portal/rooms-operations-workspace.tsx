"use client"

import { useState } from "react"
import {
  Building2,
  CalendarClock,
  DoorOpen,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/features/components/ui/card"
import { Input } from "@/features/components/ui/input"
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

const scheduleDays = ["M", "T", "W", "Th", "F", "Sat"] as const

type AvailabilityFilter = "all" | "available" | "scheduled"
type ModalityFilter = "all" | keyof typeof modalityLabel
type DayFilter = "all" | (typeof scheduleDays)[number]

const initialFilters = {
  search: "",
  availability: "all" as AvailabilityFilter,
  modality: "all" as ModalityFilter,
  day: "all" as DayFilter,
}

export function RoomsOperationsWorkspace() {
  const { session } = useAuth()
  const termsQuery = useAcademicTermsQuery()
  const roomsQuery = useRoomOptionsQuery()
  const sectionsQuery = useSectionsQuery()
  const activeTerm = getActiveAcademicTerm(termsQuery.data)
  const roomOptions = roomsQuery.data ?? getLocalRoomOptions(session?.college)
  const [filters, setFilters] = useState(initialFilters)
  const scheduledSections = (sectionsQuery.data ?? []).filter(
    (section) =>
      section.academic_term_id === activeTerm?.id &&
      section.room !== null &&
      section.schedule_days !== null,
  )
  const hasActiveFilters =
    filters.search !== "" ||
    filters.availability !== "all" ||
    filters.modality !== "all" ||
    filters.day !== "all"
  const matchingSections = (roomName: string) =>
    scheduledSections.filter(
      (section) =>
        section.room === roomName &&
        (filters.modality === "all" || section.modality === filters.modality) &&
        (filters.day === "all" || section.schedule_days?.includes(filters.day)),
    )
  const roomRows = roomOptions
    .filter((room) =>
      room.name.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()),
    )
    .map((room) => ({ room, scheduled: matchingSections(room.name) }))
    .filter(({ scheduled }) => {
      if (filters.availability === "scheduled") return scheduled.length > 0
      if (filters.availability === "available") return scheduled.length === 0

      return true
    })
  const filteredScheduledSections = roomRows.flatMap(({ scheduled }) => scheduled)
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
            <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/8 via-card to-card">
              <CardHeader className="border-b bg-background/55 pb-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="grid gap-1">
                    <div className="flex items-center gap-2 text-primary">
                      <SlidersHorizontal className="size-4" aria-hidden="true" />
                      <span className="text-xs font-semibold tracking-[0.16em] uppercase">Live room filters</span>
                    </div>
                    <CardTitle level={2}>Find the right room before assigning a class</CardTitle>
                  </div>
                  <Badge variant="secondary">{roomRows.length} of {roomOptions.length} rooms shown</Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 pt-5 lg:grid-cols-[minmax(0,1.35fr)_repeat(3,minmax(0,0.72fr))_auto] lg:items-end">
                <label className="grid gap-2 text-sm font-medium" htmlFor="room-search">
                  Search rooms
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input id="room-search" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="e.g. Lab, 3A, EdTech" className="pl-9" />
                  </div>
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="room-availability">
                  Availability
                  <select id="room-availability" value={filters.availability} onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value as AvailabilityFilter }))} className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                    <option value="all">All rooms</option>
                    <option value="available">Available</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="room-modality">
                  Modality
                  <select id="room-modality" value={filters.modality} onChange={(event) => setFilters((current) => ({ ...current, modality: event.target.value as ModalityFilter }))} className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                    <option value="all">All modalities</option>
                    <option value="f2f">F2F</option>
                    <option value="hyflex_a">HyFlex A</option>
                    <option value="hyflex_b">HyFlex B</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="room-day">
                  Schedule day
                  <select id="room-day" value={filters.day} onChange={(event) => setFilters((current) => ({ ...current, day: event.target.value as DayFilter }))} className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                    <option value="all">All days</option>
                    {scheduleDays.map((day) => <option key={day} value={day}>{day}</option>)}
                  </select>
                </label>
                <div className="flex min-h-9 items-end">
                  {hasActiveFilters && <Button type="button" variant="ghost" size="sm" className="w-full lg:w-auto" onClick={() => setFilters(initialFilters)}><X data-icon="inline-start" aria-hidden="true" />Clear filters</Button>}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle level={2} className="text-sm font-medium">Available room records</CardTitle>
                  <DoorOpen className="size-4 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{roomRows.length}</CardContent>
              </Card>
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle level={2} className="text-sm font-medium">Scheduled classes</CardTitle>
                  <CalendarClock className="size-4 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{filteredScheduledSections.length}</CardContent>
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
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <div className="grid gap-1"><CardTitle level={2}>Room availability board</CardTitle><p className="text-sm text-muted-foreground">Availability is based on the active term and your current filters.</p></div>
                <Badge variant="outline">{roomRows.filter(({ scheduled }) => scheduled.length === 0).length} available</Badge>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Room</TableHead><TableHead>Scheduled classes</TableHead><TableHead>Next use</TableHead><TableHead>Current view</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {roomRows.map(({ room, scheduled }) => {
                      const nextUse = scheduled[0]
                      return <TableRow key={room.id}><TableCell className="font-medium">{room.name}</TableCell><TableCell>{scheduled.length}</TableCell><TableCell className="text-muted-foreground">{nextUse ? `${nextUse.schedule_days} · ${nextUse.starts_at_time?.slice(0, 5)}–${nextUse.ends_at_time?.slice(0, 5)}` : "No scheduled use"}</TableCell><TableCell><Badge variant={scheduled.length === 0 ? "secondary" : "outline"}>{scheduled.length === 0 ? "Available" : "Review time slots"}</Badge></TableCell></TableRow>
                    })}
                  </TableBody>
                </Table>
                {roomRows.length === 0 && <div className="grid place-items-center gap-2 border-t py-10 text-center"><p className="font-medium">No rooms match these filters.</p><p className="text-sm text-muted-foreground">Try another search term or clear the active filters.</p><Button type="button" variant="outline" size="sm" onClick={() => setFilters(initialFilters)}>Clear filters</Button></div>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle level={2}>Scheduled room use</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                {filteredScheduledSections.length === 0 ? <p className="text-sm text-muted-foreground">No scheduled room use matches the current filters.</p> : filteredScheduledSections.map((section) => (
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
