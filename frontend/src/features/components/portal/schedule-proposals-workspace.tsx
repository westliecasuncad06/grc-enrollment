"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/features/components/ui/field"
import {
  useScheduleProposalsQuery,
  scheduleProposalsQueryKey,
} from "@/features/hooks/use-scheduling"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import {
  scheduleProposalInputSchema,
  type ScheduleProposalInput,
} from "@/features/schemas/scheduling-schema"
import { createScheduleProposal } from "@/features/services/scheduling-service"
import {
  formatAcademicTerm,
  getActiveAcademicTerm,
} from "@/features/services/reference-data-service"

export function ScheduleProposalsWorkspace() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const termsQuery = useAcademicTermsQuery()
  const proposalsQuery = useScheduleProposalsQuery()
  const activeTerm = getActiveAcademicTerm(termsQuery.data)
  const [requestError, setRequestError] = useState("")
  const form = useForm<ScheduleProposalInput>({
    resolver: zodResolver(scheduleProposalInputSchema),
    defaultValues: { academic_term_id: 0 },
  })
  const mutation = useMutation({
    mutationFn: createScheduleProposal,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: scheduleProposalsQueryKey(session?.userId ?? null),
        exact: true,
      }),
  })
  useEffect(() => {
    if (activeTerm && form.getValues("academic_term_id") === 0)
      form.setValue("academic_term_id", activeTerm.id)
  }, [activeTerm, form])
  const save = async (input: ScheduleProposalInput) => {
    setRequestError("")
    try {
      await mutation.mutateAsync(input)
    } catch (error) {
      if (!applyApiFieldErrors(error, form.setError))
        setRequestError(
          "The draft proposal could not be created. Check the connection and try again.",
        )
    }
  }
  const combinedQuery = {
    isPending: termsQuery.isPending || proposalsQuery.isPending,
    isError: termsQuery.isError || proposalsQuery.isError,
    error: termsQuery.error ?? proposalsQuery.error,
    data:
      termsQuery.data && proposalsQuery.data
        ? { terms: termsQuery.data, proposals: proposalsQuery.data }
        : undefined,
    refetch: () => {
      void termsQuery.refetch()
      void proposalsQuery.refetch()
    },
  }
  return (
    <WorkspacePage
      title="Schedule proposals"
      description="Create a draft proposal for review. Dean and executive decisions are intentionally unavailable in this Program Chair workspace."
    >
      {requestError && (
        <Alert variant="destructive">
          <AlertDescription>{requestError}</AlertDescription>
        </Alert>
      )}
      <AsyncBoundary
        query={combinedQuery}
        loadingLabel="Loading schedule reference data…"
      >
        {({ terms, proposals }) => (
          <>
            <Card>
              <CardHeader>
                <CardTitle level={3}>Create draft proposal</CardTitle>
                <CardDescription>
                  Only one active proposal is allowed for each academic term.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  noValidate
                  onSubmit={(event) => void form.handleSubmit(save)(event)}
                >
                  <FieldGroup>
                    <Field
                      data-invalid={Boolean(
                        form.formState.errors.academic_term_id,
                      )}
                    >
                      <FieldLabel htmlFor="proposal-term">
                        Academic term
                      </FieldLabel>
                      <select
                        id="proposal-term"
                        {...form.register("academic_term_id", {
                          valueAsNumber: true,
                        })}
                      >
                        <option value={0}>Select an academic term</option>
                        {terms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {formatAcademicTerm(term)}
                          </option>
                        ))}
                      </select>
                      <FieldError>
                        {form.formState.errors.academic_term_id?.message}
                      </FieldError>
                    </Field>
                    <Button type="submit" disabled={mutation.isPending}>
                      {mutation.isPending
                        ? "Creating draft proposal"
                        : "Create draft proposal"}
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
            <section aria-label="Existing schedule proposals">
              <h3>Existing proposals</h3>
              {proposals.length === 0 ? (
                <p>No proposals have been created.</p>
              ) : (
                <ul className="grid gap-2 md:grid-cols-2">
                  {proposals.map((proposal) => (
                    <li key={proposal.id} className="rounded-md border p-3">
                      <p>
                        {terms.find(
                          (term) => term.id === proposal.academic_term_id,
                        )
                          ? formatAcademicTerm(
                              terms.find(
                                (term) => term.id === proposal.academic_term_id,
                              )!,
                            )
                          : "Academic term unavailable"}
                      </p>
                      <p>{proposal.status_label}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
