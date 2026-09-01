"use client"

import { useMemo, useState } from "react"
import { CalendarDays, ListIcon } from "lucide-react"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/features/components/ui/toggle-group"
import { formatTimeRange12, modalityLabel } from "@/features/lib/room-calendar"
import {
  SectionScheduleCalendar,
  type SectionScheduleItem,
} from "@/features/components/portal/section-schedule-calendar"

interface SectionScheduleCalendarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  items: readonly SectionScheduleItem[]
  onSelectSubject?: (item: SectionScheduleItem) => void
  disabled?: boolean
  /** Optional action button rendered in the footer (e.g. Choose Section button for students) */
  footerAction?: React.ReactNode
}

export function SectionScheduleCalendarDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  items,
  onSelectSubject,
  disabled = false,
  footerAction,
}: SectionScheduleCalendarDialogProps) {
  const [view, setView] = useState<"calendar" | "table">("calendar")

  const totalUnits = useMemo(
    () => items.reduce((sum, item) => sum + (item.units ?? 0), 0),
    [items],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-6xl overflow-y-auto sm:max-w-6xl">
        <DialogHeader className="gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
            <Badge variant="secondary">{items.length} {items.length === 1 ? "subject" : "subjects"}</Badge>
            {totalUnits > 0 && <Badge variant="outline">{totalUnits} units</Badge>}
          </div>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(val) => {
                if (val === "calendar" || val === "table") setView(val)
              }}
              variant="outline"
              size="sm"
              aria-label="Schedule layout view"
            >
              <ToggleGroupItem value="calendar" aria-label="Calendar view">
                <CalendarDays data-icon="inline-start" aria-hidden="true" />
                Calendar
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Table view">
                <ListIcon data-icon="inline-start" aria-hidden="true" />
                Table
              </ToggleGroupItem>
            </ToggleGroup>

            <span className="text-xs text-muted-foreground">
              {view === "calendar"
                ? "Click any class card to inspect or adjust schedule."
                : "Weekly class list in tabular format."}
            </span>
          </div>

          {view === "calendar" ? (
            <SectionScheduleCalendar
              items={items}
              onSelectSubject={onSelectSubject}
              disabled={disabled}
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Day(s)</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Modality</TableHead>
                    {onSelectSubject && <TableHead className="text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold">{item.subject_code}</TableCell>
                      <TableCell>{item.subject_title ?? "—"}</TableCell>
                      <TableCell>{item.units ?? "—"}</TableCell>
                      <TableCell>{item.schedule_days ?? "—"}</TableCell>
                      <TableCell>
                        {item.starts_at_time && item.ends_at_time
                          ? formatTimeRange12(item.starts_at_time, item.ends_at_time)
                          : "—"}
                      </TableCell>
                      <TableCell>{item.room ?? "—"}</TableCell>
                      <TableCell>{item.professor_name ?? "Unassigned"}</TableCell>
                      <TableCell>
                        {item.modality ? modalityLabel[item.modality] ?? item.modality : "—"}
                      </TableCell>
                      {onSelectSubject && (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={disabled}
                            onClick={() => onSelectSubject(item)}
                          >
                            Assign schedule
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                        No subjects found for this section.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {footerAction}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

