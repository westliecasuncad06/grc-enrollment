"use client"

import { Field, FieldLabel } from "@/features/components/ui/field"
import { Switch } from "@/features/components/ui/switch"

/**
 * The "Apply my preferences" toggle, shared by the regular-student section
 * table (`EnrollmentSectionTable`) and the irregular-student filter bar
 * (`EnrollmentSubjectFilterBar`) — same control, same accessible name, same
 * "rank, never gate" contract described at each call site. Only what gets
 * sorted differs: a flat block list for a regular student, a subject list
 * (by its own `preference_score`) for an irregular one.
 */
export function ApplyPreferencesSwitch({
  id,
  checked,
  onCheckedChange,
}: {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <FieldLabel htmlFor={id}>Apply my preferences</FieldLabel>
    </Field>
  )
}
