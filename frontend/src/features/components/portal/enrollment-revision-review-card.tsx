"use client"

import { useState } from "react"

import { EnrollmentRevisionHistory } from "@/features/components/portal/enrollment-revision-history"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/features/components/ui/alert-dialog"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/features/components/ui/field"
import { Textarea } from "@/features/components/ui/textarea"
import { useUpdateEnrollmentMutation } from "@/features/hooks/use-enrollment"
import type { Enrollment } from "@/features/schemas/enrollment-schema"
import { isApiClientError } from "@/features/services/api-client"

/**
 * The student's answer to the Program Chair's changes to their subjects
 * (ADR 0040). Shown while the enrollment is `pending_student_review`: the
 * Chair's reason and what changed, then two choices. Accepting sends the
 * enrollment straight to the Registrar. Not accepting needs a reason and sends
 * it back to the Program Chair, who sees that reason.
 */
export function EnrollmentRevisionReviewCard({
  enrollment,
}: {
  enrollment: Enrollment
}) {
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const mutation = useUpdateEnrollmentMutation()

  if (enrollment.status !== "pending_student_review") return null

  const reasonMissing = reason.trim() === ""

  async function answer(
    action: "student_accept_revision" | "student_decline_revision",
  ) {
    setError("")
    try {
      await mutation.mutateAsync({
        id: enrollment.id,
        action,
        reason: action === "student_decline_revision" ? reason.trim() : undefined,
      })
      setDeclining(false)
      setReason("")
    } catch (caught) {
      setError(
        isApiClientError(caught) && caught.message
          ? caught.message
          : "Your answer could not be saved. Check the connection and try again.",
      )
    }
  }

  return (
    <>
      <Card
        role="region"
        aria-label="Review your Program Chair's changes"
        className="border-amber-500/50"
      >
        <CardHeader>
          <CardTitle level={2}>Your Program Chair changed your subjects</CardTitle>
          <CardDescription>
            Read why, then accept the changes or tell your Program Chair why you
            cannot. If you accept, your enrollment goes straight to the
            Registrar for approval. Your schedule below already shows the
            changed subjects.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <EnrollmentRevisionHistory
            revisions={enrollment.revisions}
            audience="student"
          />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={() => void answer("student_accept_revision")}
            >
              {mutation.isPending && !declining
                ? "Accepting…"
                : "Accept the changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => {
                setError("")
                setDeclining(true)
              }}
            >
              I do not accept
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={declining}
        onOpenChange={(next) => {
          if (!mutation.isPending) setDeclining(next)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Why can you not accept the changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your enrollment goes back to your Program Chair together with your
              reason, so they can change it again or talk to you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field data-invalid={reasonMissing && reason !== ""}>
            <FieldLabel htmlFor="student-decline-reason">Your reason</FieldLabel>
            <Textarea
              id="student-decline-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. CS102 meets on Tuesdays and I work on Tuesdays."
              disabled={mutation.isPending}
              maxLength={2000}
              required
            />
            {reasonMissing && reason !== "" && (
              <FieldError>A reason is required.</FieldError>
            )}
          </Field>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Back</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={mutation.isPending || reasonMissing}
              onClick={() => void answer("student_decline_revision")}
            >
              {mutation.isPending ? "Sending…" : "Send to my Program Chair"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
