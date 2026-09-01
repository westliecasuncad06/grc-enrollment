"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, DoorOpen } from "lucide-react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { RoomScheduleCalendar } from "@/features/components/portal/room-schedule-calendar"
import { WorkspaceField } from "@/features/components/portal/workspace-field"
import { Button } from "@/features/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
import { ToggleGroup, ToggleGroupItem } from "@/features/components/ui/toggle-group"
import { useRoomOptionsQuery } from "@/features/hooks/use-room-catalog"
import { useRoomOccupancyQuery } from "@/features/hooks/use-room-occupancy"
import {
  buildRoomWeek,
  findConflictingIds,
  slotClockTime,
  SLOT_COUNT,
} from "@/features/lib/room-calendar"
import { getLocalRoomOptions } from "@/features/services/room-catalog-service"

const dayOptions = [
  { value: "1", label: "Mon", letter: "M" },
  { value: "2", label: "Tue", letter: "T" },
  { value: "3", label: "Wed", letter: "W" },
  { value: "4", label: "Thu", letter: "Th" },
  { value: "5", label: "Fri", letter: "F" },
  { value: "6", label: "Sat", letter: "Sat" },
] as const

/**
 * A typical 3-unit subject meets 3 hours a week, split into two 1.5-hour
 * sessions (e.g. TUE/THU) rather than three separate days — so this picker
 * caps a single meeting pattern at two days, matching how the real
 * curriculum reference data is actually shaped.
 */
const MAX_MEETING_DAYS = 2

/**
 * The selected state for a toggle here — a light destructive tint with
 * destructive-colored text, the same formula `Badge`/`Button`'s own
 * `destructive` variant already uses (`bg-destructive/10 text-destructive`).
 * There is no `--destructive-foreground` token in this design system, so a
 * solid fill would render unreadable dark-on-dark.
 */
const selectedDestructiveClassName =
  "data-[state=on]:border-destructive data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive dark:data-[state=on]:bg-destructive/20"

export interface RoomScheduleAssignmentResult {
  room: string
  scheduleDays: string
  startsAtTime: string
  endsAtTime: string
  modality: "f2f" | "hyflex_a" | "hyflex_b"
}

interface RoomScheduleAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  termId: number
  initialRoom?: string | null
  /** Excluded from the room's occupancy so editing a section's own current booking never reads as a self-conflict. */
  excludeSectionId?: number
  onConfirm: (result: RoomScheduleAssignmentResult) => void
}

type Step = "room" | "calendar" | "form"

/**
 * Room → calendar → day/time/modality, in that order — the same
 * conflict-aware picking the Rooms workspace already offers, reused here so
 * assigning a room from the Schedule page is never a blind guess against
 * another subject's booking.
 */
export function RoomScheduleAssignmentDialog({
  open,
  onOpenChange,
  termId,
  initialRoom,
  excludeSectionId,
  onConfirm,
}: RoomScheduleAssignmentDialogProps) {
  const { session } = useAuth()
  const [step, setStep] = useState<Step>(initialRoom ? "calendar" : "room")
  const [room, setRoom] = useState<string | null>(initialRoom ?? null)
  const [formDraft, setFormDraft] = useState({
    days: [] as string[],
    startsAt: "",
    endsAt: "",
    modality: "f2f" as "f2f" | "hyflex_a" | "hyflex_b",
  })

  useEffect(() => {
    if (open) {
      if (initialRoom) {
        setRoom(initialRoom)
        setStep("calendar")
      } else {
        setRoom(null)
        setStep("room")
      }
      setFormDraft({ days: [], startsAt: "", endsAt: "", modality: "f2f" })
    }
  }, [open, initialRoom])

  const roomsQuery = useRoomOptionsQuery()
  const roomOptions = roomsQuery.data ?? getLocalRoomOptions(session?.college)
  const roomComboOptions = useMemo(
    () => roomOptions.map((option) => ({ value: option.name, label: option.name })),
    [roomOptions],
  )

  const occupancyQuery = useRoomOccupancyQuery(room, termId)
  const visibleEntries = useMemo(
    () => (occupancyQuery.data ?? []).filter((entry) => entry.section_id !== excludeSectionId),
    [occupancyQuery.data, excludeSectionId],
  )
  const week = useMemo(() => buildRoomWeek(visibleEntries), [visibleEntries])
  const conflictingSectionIds = useMemo(
    () => findConflictingIds(visibleEntries, (entry) => entry.section_id),
    [visibleEntries],
  )

  const reset = () => {
    setFormDraft({ days: [], startsAt: "", endsAt: "", modality: "f2f" })
  }
  const close = () => {
    reset()
    onOpenChange(false)
  }

  const pickRoom = (name: string) => {
    setRoom(name)
    setStep("calendar")
  }

  const selectSlot = (day: number, startSlot: number) => {
    const endSlot = Math.min(startSlot + 3, SLOT_COUNT)
    setFormDraft({
      days: [String(day)],
      startsAt: slotClockTime(startSlot),
      endsAt: slotClockTime(endSlot),
      modality: "f2f",
    })
    setStep("form")
  }

  const canSave =
    room !== null && formDraft.days.length > 0 && formDraft.startsAt !== "" && formDraft.endsAt !== ""

  const save = () => {
    if (!canSave || room === null) return
    const scheduleDays = dayOptions
      .filter((option) => formDraft.days.includes(option.value))
      .map((option) => option.letter)
      .join("")
    onConfirm({
      room,
      scheduleDays,
      startsAtTime: formDraft.startsAt,
      endsAtTime: formDraft.endsAt,
      modality: formDraft.modality,
    })
    close()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <DialogContent className="max-h-[92dvh] w-[96vw] max-w-7xl overflow-y-auto sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>
            {step === "room" && "Pick a room"}
            {step === "calendar" && `${room} — pick an open slot`}
            {step === "form" && `Confirm the schedule in ${room}`}
          </DialogTitle>
          <DialogDescription>
            {step === "room" && "Choose the room this section will meet in."}
            {step === "calendar" &&
              "Every booking in this room is shown, including other colleges' — click an open cell to use it."}
            {step === "form" &&
              `Up to ${MAX_MEETING_DAYS} meeting days — most 3-unit subjects split into two 1.5-hour sessions rather than three single-hour ones.`}
          </DialogDescription>
        </DialogHeader>

        {step === "room" && (
          <AsyncBoundary
            query={{
              isPending: roomsQuery.isPending,
              isError: roomsQuery.isError,
              error: roomsQuery.error,
              data: true as const,
              refetch: () => void roomsQuery.refetch(),
            }}
            loadingLabel="Loading rooms…"
          >
            {() => (
              <div className="grid gap-4">
                <Field>
                  <FieldLabel htmlFor="room-assignment-picker-search">Room</FieldLabel>
                  <SearchableCombobox
                    id="room-assignment-picker-search"
                    label="Room"
                    options={roomComboOptions}
                    value=""
                    onValueChange={(value) => {
                      if (value) pickRoom(value)
                    }}
                    placeholder="Search room, e.g. LAB 1, 3A"
                    emptyMessage="No room matches."
                  />
                </Field>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {roomOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => pickRoom(option.name)}
                      className="flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none"
                    >
                      <DoorOpen className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      {option.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </AsyncBoundary>
        )}

        {step === "calendar" && room !== null && (
          <AsyncBoundary
            query={{
              isPending: occupancyQuery.isPending,
              isError: occupancyQuery.isError,
              error: occupancyQuery.error,
              data: true as const,
              refetch: () => void occupancyQuery.refetch(),
            }}
            loadingLabel="Loading this room's schedule…"
          >
            {() => (
              <div className="grid gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => setStep("room")}
                >
                  <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                  Change room
                </Button>
                <RoomScheduleCalendar
                  week={week}
                  onSelectSlot={selectSlot}
                  conflictingSectionIds={conflictingSectionIds}
                />
              </div>
            )}
          </AsyncBoundary>
        )}

        {step === "form" && room !== null && (
          <FieldGroup className="grid gap-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setStep("calendar")}
            >
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Back to calendar
            </Button>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Day(s) — up to {MAX_MEETING_DAYS}</p>
              <ToggleGroup
                type="multiple"
                value={formDraft.days}
                onValueChange={(value) =>
                  setFormDraft((current) => ({ ...current, days: value.slice(0, MAX_MEETING_DAYS) }))
                }
                variant="outline"
                size="sm"
                aria-label={`Schedule days, up to ${MAX_MEETING_DAYS}`}
              >
                {dayOptions.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={option.label}
                    className={selectedDestructiveClassName}
                    disabled={
                      formDraft.days.length >= MAX_MEETING_DAYS && !formDraft.days.includes(option.value)
                    }
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <WorkspaceField label="Start time">
                <Input
                  type="time"
                  value={formDraft.startsAt}
                  onChange={(event) => setFormDraft({ ...formDraft, startsAt: event.target.value })}
                />
              </WorkspaceField>
              <WorkspaceField label="End time">
                <Input
                  type="time"
                  value={formDraft.endsAt}
                  onChange={(event) => setFormDraft({ ...formDraft, endsAt: event.target.value })}
                />
              </WorkspaceField>
            </div>
            <WorkspaceField label="Modality">
              <select
                value={formDraft.modality}
                onChange={(event) =>
                  setFormDraft({ ...formDraft, modality: event.target.value as typeof formDraft.modality })
                }
                className="h-9 rounded-md border bg-background px-2"
              >
                <option value="f2f">F2F</option>
                <option value="hyflex_a">HyFlex A</option>
                <option value="hyflex_b">HyFlex B</option>
              </select>
            </WorkspaceField>
            <WorkspaceField label="Room">
              <Input value={room} readOnly />
            </WorkspaceField>
          </FieldGroup>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          {step === "form" && (
            <Button type="button" onClick={save} disabled={!canSave}>
              Save schedule
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
