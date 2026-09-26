"use client"

import { useState } from "react"
import { CheckCircle2, Lightbulb } from "lucide-react"

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
import { Field, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { SearchableCombobox } from "@/features/components/ui/searchable-combobox"
import { Textarea } from "@/features/components/ui/textarea"
import { useSubjectsQuery } from "@/features/hooks/use-reference-data"
import {
  useTransfereeCreditActionMutation,
  useTransfereeCreditSuggestionsQuery,
  useUpdateTransfereeCreditMutation,
} from "@/features/hooks/use-transferee-credits"
import { isApiClientError } from "@/features/services/api-client"
import type { TransfereeCredit } from "@/features/schemas/transferee-credit-schema"

/** The API's own sentence for a rejected step when it gave one, else `fallback`. */
function apiMessage(error: unknown, fallback: string): string {
  if (isApiClientError(error)) {
    const first = Object.values(error.fieldErrors ?? {})[0]?.[0]
    if (first) return first
  }
  return fallback
}

function scoreLabel(score: number): string {
  return `${Math.round(score * 100)}% match`
}

/**
 * The Program Chair's review of one credit request: see what the student
 * asked for, pick the subject of their curriculum it counts as (from the
 * system's suggestions, or by choosing one), then endorse it to the Registrar
 * or decline it with a reason (ADR 0026). The suggestions are advice, not a
 * decision: nothing is mapped until the Chair chooses. Mounted only while
 * reviewing, keyed by the credit, so it always starts from that credit.
 */
export function CreditReviewDialog({
  credit,
  onClose,
}: {
  credit: TransfereeCredit
  onClose: () => void
}) {
  const [subjectId, setSubjectId] = useState(
    credit.subject_id === null ? "" : String(credit.subject_id),
  )
  const [units, setUnits] = useState(String(credit.credited_units))
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [savedNote, setSavedNote] = useState("")

  const suggestionsQuery = useTransfereeCreditSuggestionsQuery(credit.id)
  const subjectsQuery = useSubjectsQuery()
  const updateMutation = useUpdateTransfereeCreditMutation()
  const actionMutation = useTransfereeCreditActionMutation()

  const suggestions = suggestionsQuery.data ?? []
  const busy = updateMutation.isPending || actionMutation.isPending

  const subjectOptions = (subjectsQuery.data ?? [])
    .filter((subject) => subject.status === "active")
    .map((subject) => ({
      value: String(subject.id),
      label: `${subject.code} — ${subject.title}`,
    }))

  const parsedUnits = Number(units)
  const unitsValid =
    Number.isFinite(parsedUnits) && parsedUnits > 0 && parsedUnits <= 99.9
  const chosenSubjectId = subjectId === "" ? null : Number(subjectId)
  const canEndorse = chosenSubjectId !== null && unitsValid && !busy

  const saveMapping = async () => {
    if (chosenSubjectId === null || !unitsValid) return
    setError("")
    setSavedNote("")
    try {
      await updateMutation.mutateAsync({
        id: credit.id,
        input: { subject_id: chosenSubjectId, credited_units: parsedUnits },
      })
      setSavedNote(
        "Mapping saved. Endorse it when you are ready for the Registrar.",
      )
    } catch (saveError) {
      setError(
        apiMessage(saveError, "The mapping could not be saved. Try again."),
      )
    }
  }

  const endorse = async () => {
    if (!canEndorse || chosenSubjectId === null) return
    setError("")
    try {
      await actionMutation.mutateAsync({
        id: credit.id,
        input: {
          action: "endorse",
          subject_id: chosenSubjectId,
          credited_units: parsedUnits,
        },
      })
      onClose()
    } catch (endorseError) {
      setError(
        apiMessage(
          endorseError,
          "The credit could not be endorsed. Check the connection and try again.",
        ),
      )
    }
  }

  const decline = async () => {
    if (!reason.trim()) return
    setError("")
    try {
      await actionMutation.mutateAsync({
        id: credit.id,
        input: { action: "decline", reason: reason.trim() },
      })
      onClose()
    } catch (declineError) {
      setError(
        apiMessage(
          declineError,
          "The request could not be declined. Check the connection and try again.",
        ),
      )
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review credit request</DialogTitle>
          <DialogDescription>
            Map {credit.source_subject_title} from {credit.source_institution}{" "}
            to a subject in {credit.student_name || credit.student_number}
            &apos;s curriculum, then endorse it to the Registrar.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-2 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Student</dt>
            <dd className="font-medium">
              {credit.student_name
                ? `${credit.student_name} (${credit.student_number})`
                : credit.student_number}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Previous school</dt>
            <dd className="font-medium">{credit.source_institution}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Previous subject</dt>
            <dd className="font-medium">
              {credit.source_subject_code
                ? `${credit.source_subject_code} — ${credit.source_subject_title}`
                : credit.source_subject_title}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Taken · units · grade
            </dt>
            <dd className="font-medium">
              {[credit.source_school_year, credit.source_semester]
                .filter(Boolean)
                .join(" ") || "Not stated"}
              {` · ${credit.credited_units} units`}
              {credit.source_grade ? ` · ${credit.source_grade}` : ""}
            </dd>
          </div>
        </dl>

        <section
          aria-labelledby={`suggestions-${credit.id}`}
          className="grid gap-2"
        >
          <h3
            id={`suggestions-${credit.id}`}
            className="flex items-center gap-1.5 text-sm font-semibold"
          >
            <Lightbulb className="size-4 text-amber-600" aria-hidden="true" />
            Suggested subjects
          </h3>
          {suggestionsQuery.isPending && (
            <p className="text-sm text-muted-foreground">
              Looking for matching subjects in the student&apos;s curriculum…
            </p>
          )}
          {suggestionsQuery.isError && (
            <p className="text-sm text-muted-foreground">
              Suggestions are unavailable right now. Choose a subject below.
            </p>
          )}
          {suggestionsQuery.isSuccess && suggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No close match was found in this student&apos;s curriculum. Choose
              a subject manually below.
            </p>
          )}
          {suggestions.length > 0 && (
            <ul className="grid gap-2" aria-label="Suggested subjects">
              {suggestions.map((suggestion) => {
                const selected = subjectId === String(suggestion.subject_id)

                return (
                  <li
                    key={suggestion.subject_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                  >
                    <div className="grid gap-0.5">
                      <span className="font-medium">
                        {suggestion.subject_code} — {suggestion.subject_title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {suggestion.units} units · Year {suggestion.year_level}{" "}
                        · {suggestion.semester} · {scoreLabel(suggestion.score)}
                        {suggestion.reasons.length > 0
                          ? ` · ${suggestion.reasons.join(", ")}`
                          : ""}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      aria-pressed={selected}
                      disabled={busy}
                      onClick={() => {
                        setSubjectId(String(suggestion.subject_id))
                        setSavedNote("")
                      }}
                    >
                      {selected ? (
                        <>
                          <CheckCircle2
                            className="mr-1 size-4"
                            aria-hidden="true"
                          />
                          Chosen
                        </>
                      ) : (
                        `Use ${suggestion.subject_code}`
                      )}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <SearchableCombobox
            id="credit-subject"
            label="Credit as (choose a subject manually)"
            options={subjectOptions}
            value={subjectId}
            onValueChange={(value) => {
              setSubjectId(value)
              setSavedNote("")
            }}
            placeholder="Search by subject code or title"
            emptyMessage="No subject matches."
            disabled={busy}
          />
          <Field data-invalid={!unitsValid}>
            <FieldLabel htmlFor="credit-review-units">
              Credited units
            </FieldLabel>
            <Input
              id="credit-review-units"
              inputMode="decimal"
              value={units}
              aria-invalid={!unitsValid}
              onChange={(event) => setUnits(event.target.value)}
              disabled={busy}
            />
          </Field>
        </div>

        {declining && (
          <Field>
            <FieldLabel htmlFor="credit-decline-reason">
              Reason for declining
            </FieldLabel>
            <Textarea
              id="credit-decline-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
            {!reason.trim() && (
              <p className="text-xs text-muted-foreground">
                The student is told this reason.
              </p>
            )}
          </Field>
        )}

        {savedNote && (
          <Alert>
            <AlertDescription>{savedNote}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
          {declining ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setDeclining(false)}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy || !reason.trim()}
                onClick={() => void decline()}
              >
                {actionMutation.isPending ? "Declining…" : "Confirm decline"}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setDeclining(true)
                  setError("")
                }}
              >
                Decline request
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!canEndorse}
                onClick={() => void saveMapping()}
              >
                {updateMutation.isPending ? "Saving…" : "Save mapping"}
              </Button>
              <Button
                type="button"
                disabled={!canEndorse}
                onClick={() => void endorse()}
              >
                {actionMutation.isPending
                  ? "Endorsing…"
                  : "Endorse to Registrar"}
              </Button>
            </>
          )}
        </DialogFooter>
        {chosenSubjectId === null && !declining && (
          <p className="text-xs text-muted-foreground">
            Choose a subject to enable Save mapping and Endorse.
          </p>
        )}
        <Badge variant="outline" className="w-fit">
          {credit.requested_by_student
            ? "Requested by the student"
            : "Recorded by a Program Head"}
        </Badge>
      </DialogContent>
    </Dialog>
  )
}
