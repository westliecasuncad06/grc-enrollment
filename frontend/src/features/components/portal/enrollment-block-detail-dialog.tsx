"use client"

import { DataTable } from "@/features/components/portal/data-table"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Button } from "@/features/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import type { EnrollmentBlock } from "@/features/schemas/enrollment-block-schema"

const MODALITY_LABEL: Record<string, string> = {
  online: "Online",
  hyflex_a: "HyFlex A",
  hyflex_b: "HyFlex B",
  f2f: "Face-to-face",
}

/**
 * The full weekly schedule for one section — opened from
 * `EnrollmentSectionTable`'s "View" action. Moved out of the old
 * `EnrollmentBlockChoice` card into a modal, since the table row no longer
 * has room for it.
 *
 * This only *stages* a choice: "Choose this section" hands the block code
 * back to the caller via `onChoose` and the dialog closes, but nothing is
 * submitted here — `EnrollmentWorkspace` still routes every submission
 * through its own existing confirm-submission `AlertDialog`.
 */
export function EnrollmentBlockDetailDialog({
  block,
  onOpenChange,
  onChoose,
  disabled = false,
}: {
  block: EnrollmentBlock | null
  onOpenChange: (open: boolean) => void
  onChoose: (blockCode: string) => void
  disabled?: boolean
}) {
  const isSelectable = block !== null && block.is_selectable && !disabled

  return (
    <Dialog open={block !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        {block && (
          <>
            <DialogHeader>
              <DialogTitle>Section {block.block_code}</DialogTitle>
              <DialogDescription>
                {block.subjects.length} subject
                {block.subjects.length === 1 ? "" : "s"} · {block.total_units}{" "}
                units · {block.seats_remaining} seat
                {block.seats_remaining === 1 ? "" : "s"} left
              </DialogDescription>
            </DialogHeader>
            {!block.is_selectable && (
              <Alert variant="destructive">
                <AlertDescription>
                  <ul className="grid gap-1">
                    {block.reasons.map((reason) => (
                      <li key={reason.code}>{reason.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            <DataTable
              caption={`${block.block_code} weekly schedule`}
              rowKey={(subject) => subject.section_id}
              rows={block.subjects}
              columns={[
                {
                  key: "subject",
                  header: "Subject",
                  render: (subject) => `${subject.code} — ${subject.title}`,
                },
                {
                  key: "units",
                  header: "Units",
                  render: (subject) => subject.units,
                },
                {
                  key: "schedule",
                  header: "Day · Time",
                  render: (subject) =>
                    subject.schedule_days
                      ? `${subject.schedule_days} ${subject.starts_at_time ?? ""}–${subject.ends_at_time ?? ""}`
                      : "Not yet scheduled",
                },
                {
                  key: "room",
                  header: "Room",
                  render: (subject) => subject.room ?? "—",
                },
                {
                  key: "professor",
                  header: "Professor",
                  render: (subject) =>
                    subject.professor_name ?? "To be announced",
                },
                {
                  key: "modality",
                  header: "Modality",
                  render: (subject) =>
                    subject.modality ? MODALITY_LABEL[subject.modality] : "—",
                },
              ]}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!isSelectable}
                onClick={() => onChoose(block.block_code)}
              >
                Choose this section
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
