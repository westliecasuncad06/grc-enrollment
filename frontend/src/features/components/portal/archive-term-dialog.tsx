"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Controller, useForm } from "react-hook-form"

import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Button } from "@/features/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/features/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import { useArchiveAndCreateNextTermMutation } from "@/features/hooks/use-reference-data"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import {
  archiveAndCreateNextInputSchema,
  type ArchiveAndCreateNextInput,
} from "@/features/schemas/academic-term-schema"
import type { AcademicTerm } from "@/features/schemas/reference-data-schema"
import { formatAcademicTerm } from "@/features/services/reference-data-service"

const fresh: ArchiveAndCreateNextInput = { school_year: "", semester: "1st" }

/**
 * The last step of a semester, not a standing form: the Registrar archives
 * the current term and names the next one in a single confirmation, so the
 * school year is always chosen with the retiring term in view and the
 * system never sits with no current term.
 */
export function ArchiveTermDialog({
  term,
  trigger,
}: {
  term: AcademicTerm
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [requestError, setRequestError] = useState("")
  const mutation = useArchiveAndCreateNextTermMutation()
  const form = useForm<ArchiveAndCreateNextInput>({
    resolver: zodResolver(archiveAndCreateNextInputSchema),
    defaultValues: fresh,
  })

  const submit = async (next: ArchiveAndCreateNextInput) => {
    setRequestError("")
    try {
      await mutation.mutateAsync({ academicTermId: term.id, next })
      form.reset(fresh)
      setOpen(false)
    } catch (error) {
      if (!applyApiFieldErrors(error, form.setError))
        setRequestError(
          "The term could not be archived. Check the school year and semester, then retry.",
        )
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          form.reset(fresh)
          setRequestError("")
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Archiving {formatAcademicTerm(term)}. What comes next?
          </DialogTitle>
          <DialogDescription>
            The record stays available for history — nothing is deleted.
            Name the next school year and semester to open it as a Draft
            term. You&apos;ll set the enrollment dates for the new term on
            the next screen.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => void form.handleSubmit(submit)(event)}
        >
          <FieldGroup>
            {requestError && (
              <Alert variant="destructive">
                <AlertDescription>{requestError}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={Boolean(form.formState.errors.school_year)}>
              <FieldLabel htmlFor="archive-next-school-year">
                Next school year
              </FieldLabel>
              <Input
                id="archive-next-school-year"
                placeholder="2027-2028"
                aria-invalid={Boolean(form.formState.errors.school_year)}
                {...form.register("school_year")}
              />
              <FieldError>
                {form.formState.errors.school_year?.message}
              </FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="archive-next-semester">
                Next semester
              </FieldLabel>
              <Controller
                control={form.control}
                name="semester"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      id="archive-next-semester"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1st">1st</SelectItem>
                      <SelectItem value="2nd">2nd</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldDescription>
                Enrollment opens once you set dates for this new term.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? "Archiving"
                : "Archive and open next term"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
