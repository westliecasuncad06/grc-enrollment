"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, MailWarning, Search, UserRoundPlus } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { AdmissionIntakeRequirements } from "@/features/components/portal/admission-intake-requirements"
import { AdmissionRequirementsChecklist } from "@/features/components/portal/admission-requirements-checklist"
import { InvitationStatusBadge } from "@/features/components/portal/invitation-status-badge"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import {
  DataTable,
  type DataTableColumn,
} from "@/features/components/portal/data-table"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Checkbox } from "@/features/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/features/components/ui/tabs"
import { Textarea } from "@/features/components/ui/textarea"
import { useAdmissionRequirementSelectionQuery } from "@/features/hooks/use-admission-requirements"
import { useDraftForm } from "@/features/hooks/use-draft-form"
import { usePersistedState } from "@/features/hooks/use-persisted-state"
import {
  useDecideProfileChangeRequestMutation,
  useProfileChangeRequestsQuery,
  useNextStudentNumberQuery,
  useProvisionStudentMutation,
  useResendAccountSetupInvitationMutation,
  useResendQueueLinkMutation,
  useStudentDirectoryQuery,
  useUpdateStudentProfileMutation,
} from "@/features/hooks/use-student-records"
import { useProgramsQuery } from "@/features/hooks/use-reference-data"
import { isApiClientError } from "@/features/services/api-client"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import { focusFirstInvalidField } from "@/features/lib/focus-first-invalid"
import { formatYearLevel } from "@/features/lib/format-year-level"
import {
  provisionStudentSchema,
  studentTypeCanHaveExistingNumber,
  updateStudentProfileSchema,
  type ProfileChangeRequest,
  type StudentProfile,
} from "@/features/schemas/admission-schema"

const YEAR_LEVEL_OPTIONS = [1, 2, 3, 4] as const
type CreateValues = z.infer<typeof provisionStudentSchema>

/**
 * Sends a freshman's "view the live queue" link again — the old link stops
 * working. Each button owns its own request, so a row in the directory only
 * shows "Resending…" for itself.
 */
function ResendQueueLinkButton({
  profile,
  label = "Resend queue link",
  size,
  variant = "outline",
  onResent,
}: {
  profile: StudentProfile
  label?: string
  size?: "sm"
  variant?: "outline" | "secondary"
  onResent?: (updated: StudentProfile) => void
}) {
  const resend = useResendQueueLinkMutation()

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={resend.isPending}
      onClick={() =>
        void resend
          .mutateAsync(profile.id)
          .then((updated) => {
            onResent?.(updated)
            toast.success(`Queue link resent to ${updated.email}.`)
          })
          .catch(() => {
            toast.error("Failed to resend the queue link.")
          })
      }
    >
      {resend.isPending ? "Resending…" : label}
    </Button>
  )
}

/** The freshman's queue number and whether the emailed link reached them. */
function QueueTicketSummary({ profile }: { profile: StudentProfile }) {
  if (profile.queue_ticket_number === null) return null

  return (
    <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Queue number
      </p>
      <p className="text-3xl font-bold tracking-wide">
        {profile.queue_ticket_number}
      </p>
      <p className="text-sm text-muted-foreground">
        {profile.queue_link_delivery_status === "failed"
          ? "The email could not be sent. Tell the student this number, then resend the link."
          : `The live queue link was emailed to ${profile.email}.`}
      </p>
    </div>
  )
}

function CreateAccountPanel() {
  // The React Compiler skipped this component on its own while it called `useForm` directly (it
  // also calls `watch`, which cannot be memoized safely). `useDraftForm` hides `useForm` from
  // the compiler, so the opt-out has to be spelled out: compiled, the memoized `register()` props
  // keep their old ref callbacks, and after a reset the text boxes keep what was typed.
  "use no memo"

  const programsQuery = useProgramsQuery()
  const mutation = useProvisionStudentMutation()
  const resend = useResendAccountSetupInvitationMutation()
  const [created, setCreated] = useState<StudentProfile | null>(null)
  // What Admission has typed survives a tab switch, leaving the page and an accidental reload:
  // a long form that is lost halfway is the thing staff complain about.
  const { form, draft } = useDraftForm<CreateValues>({
    formKey: "admission.create-account.v1",
    resolver: zodResolver(provisionStudentSchema),
    defaultValues: {
      first_name: "",
      middle_initial: "",
      last_name: "",
      suffix: "",
      email: "",
      address: "",
      has_existing_student_number: false,
      program_id: 0,
      year_level: 1,
      financial_status: null,
      requirement_type_ids: [],
    },
  })
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = form
  const formRef = useRef<HTMLFormElement>(null)
  const studentType = watch("student_type")
  const checkedIds = watch("requirement_type_ids")
  const hasExistingNumber = watch("has_existing_student_number")
  const canHaveExistingNumber = studentTypeCanHaveExistingNumber(studentType)
  // The number the new account will get, shown before saving (only while a new number is asked for).
  const nextNumberQuery = useNextStudentNumberQuery(!hasExistingNumber)
  // A failure on the server (or reaching it), as opposed to the server rejecting what was typed.
  const serverFault =
    isApiClientError(mutation.error) &&
    (mutation.error.kind === "connection" ||
      (mutation.error.status ?? 0) >= 500)
      ? mutation.error
      : null
  const requirementsQuery = useAdmissionRequirementSelectionQuery(
    studentType ?? null,
  )
  const applicableIds = useMemo(
    () =>
      (requirementsQuery.data?.categories ?? []).flatMap((group) =>
        group.items.map((item) => item.requirement_type_id),
      ),
    [requirementsQuery.data],
  )

  // A different student type lists different requirements: drop ticks that no longer apply.
  useEffect(() => {
    if (!requirementsQuery.isSuccess) return
    const current = checkedIds ?? []
    const stillApplicable = current.filter((id) => applicableIds.includes(id))
    if (stillApplicable.length !== current.length) {
      setValue("requirement_type_ids", stillApplicable)
    }
  }, [applicableIds, checkedIds, requirementsQuery.isSuccess, setValue])

  // A Freshman gets a new number: drop the option, and any number typed for it, as soon as the
  // type changes to one that cannot have one (2026-10-04: a Transferee may enter theirs).
  useEffect(() => {
    if (hasExistingNumber && !canHaveExistingNumber) {
      setValue("has_existing_student_number", false)
      setValue("student_number", undefined)
      clearErrors(["student_number", "has_existing_student_number"])
    }
  }, [canHaveExistingNumber, clearErrors, hasExistingNumber, setValue])

  const submit = async (values: CreateValues) => {
    try {
      const profile = await mutation.mutateAsync(values)
      setCreated(profile)
      if (profile.queue_ticket_number !== null) {
        // A freshman: a queue number and a live-queue link, not the account setup email.
        if (profile.queue_link_delivery_status === "failed") {
          toast.warning(
            `Student saved and queue number ${profile.queue_ticket_number} issued, but the email could not be sent. Tell the student the number, or resend the link.`,
          )
        } else {
          toast.success(
            `Student saved. Queue number ${profile.queue_ticket_number} was emailed to ${profile.email}.`,
          )
        }
      } else {
        toast.success(
          `Account created and setup email sent to ${profile.email}.`,
        )
      }
      reset({
        ...values,
        first_name: "",
        middle_initial: "",
        last_name: "",
        suffix: "",
        email: "",
        address: "",
        has_existing_student_number: false,
        student_number: undefined,
        // Each account gets a deliberate choice: the category and type are not carried over.
        enrollment_category: undefined,
        student_type: undefined,
        requirement_type_ids: [],
      })
      // The account exists now: nothing typed is worth keeping. What the form still holds (the
      // program and year, carried over to the next student) is its new starting point.
      draft.clear()
      draft.rebase()
    } catch (error) {
      applyApiFieldErrors(error, setError)
      // Take Admission to the field the server did not accept.
      focusFirstInvalidField(formRef.current)
      // A freshman has no account until they pay (ADR 0043): what Admission saves is the student
      // and a queue number, so that is what failed.
      toast.error(
        values.student_type === "freshman"
          ? "Failed to save the student."
          : "Failed to create the account.",
      )
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <Card>
          <CardHeader>
            <CardTitle level={2}>Create a student account</CardTitle>
            <CardDescription>
              Create one account only after Admission has received the
              requirements. The curriculum is selected automatically from the
              program and entry year.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              ref={formRef}
              noValidate
              onSubmit={(event) =>
                void handleSubmit(submit, () =>
                  // A field is wrong: go to the first one instead of leaving the message out of sight.
                  focusFirstInvalidField(formRef.current),
                )(event)
              }
            >
              <FieldGroup className="grid gap-4 md:grid-cols-2">
                <Field data-invalid={Boolean(errors.first_name)}>
                  <FieldLabel htmlFor="record-first-name">
                    First name
                  </FieldLabel>
                  <Input id="record-first-name" {...register("first_name")} />
                  <FieldError>{errors.first_name?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.last_name)}>
                  <FieldLabel htmlFor="record-last-name">Last name</FieldLabel>
                  <Input id="record-last-name" {...register("last_name")} />
                  <FieldError>{errors.last_name?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.middle_initial)}>
                  <FieldLabel htmlFor="record-middle-initial">
                    Middle initial
                  </FieldLabel>
                  <Input
                    id="record-middle-initial"
                    maxLength={10}
                    {...register("middle_initial")}
                  />
                  <FieldDescription>Optional.</FieldDescription>
                  <FieldError>{errors.middle_initial?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.suffix)}>
                  <FieldLabel htmlFor="record-suffix">Suffix</FieldLabel>
                  <Input
                    id="record-suffix"
                    placeholder="Jr., Sr., III…"
                    maxLength={20}
                    {...register("suffix")}
                  />
                  <FieldDescription>Optional.</FieldDescription>
                  <FieldError>{errors.suffix?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.email)}>
                  <FieldLabel htmlFor="record-email">Email address</FieldLabel>
                  <Input
                    id="record-email"
                    type="email"
                    {...register("email")}
                  />
                  <FieldError>{errors.email?.message}</FieldError>
                </Field>
                <Field
                  className="md:col-span-2"
                  data-invalid={Boolean(errors.address)}
                >
                  <FieldLabel htmlFor="record-address">
                    Complete address
                  </FieldLabel>
                  <Textarea
                    id="record-address"
                    rows={3}
                    {...register("address")}
                  />
                  <FieldDescription>
                    Use the printable address for future COR records.
                  </FieldDescription>
                  <FieldError>{errors.address?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.student_number)}>
                  <FieldLabel htmlFor="record-number">
                    {hasExistingNumber
                      ? "Existing student number"
                      : "Student number"}
                  </FieldLabel>
                  {hasExistingNumber ? (
                    <Input
                      key="typed-number"
                      id="record-number"
                      autoComplete="off"
                      placeholder="YYYY-MM-NNNNN"
                      aria-invalid={Boolean(errors.student_number)}
                      {...register("student_number")}
                    />
                  ) : (
                    // A separate element from the typed one: React must not reuse the registered
                    // input as a controlled, read-only field (that broke the number sent on save).
                    <Input
                      key="previewed-number"
                      id="record-number"
                      readOnly
                      value={nextNumberQuery.data ?? ""}
                      placeholder={
                        nextNumberQuery.isPending
                          ? "Loading the next number…"
                          : "Assigned automatically"
                      }
                    />
                  )}
                  <FieldDescription>
                    {hasExistingNumber
                      ? "Enter it exactly as it appears on the student's records (YYYY-MM-NNNNN)."
                      : "The next number in order (Year-Month-Sequence). It is confirmed when the account is saved."}
                  </FieldDescription>
                  <FieldError>{errors.student_number?.message}</FieldError>
                  <div className="flex items-start gap-2 pt-1">
                    <Controller
                      control={control}
                      name="has_existing_student_number"
                      render={({ field }) => (
                        <Checkbox
                          id="record-has-number"
                          checked={field.value}
                          disabled={!canHaveExistingNumber}
                          onCheckedChange={(value) => {
                            const checked = value === true
                            field.onChange(checked)
                            if (!checked) {
                              setValue("student_number", undefined)
                              clearErrors("student_number")
                            }
                          }}
                        />
                      )}
                    />
                    <FieldLabel
                      htmlFor="record-has-number"
                      className="font-normal"
                    >
                      Student already has a student number
                    </FieldLabel>
                  </div>
                  <FieldDescription>
                    Only for a Transferee, a Returnee or an Existing Student. A
                    Freshman gets a new number.
                  </FieldDescription>
                  <FieldError>
                    {errors.has_existing_student_number?.message}
                  </FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.program_id)}>
                  <FieldLabel htmlFor="record-program">Program</FieldLabel>
                  <Controller
                    control={control}
                    name="program_id"
                    render={({ field }) => (
                      <Select
                        value={field.value ? String(field.value) : ""}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <SelectTrigger id="record-program" className="w-full">
                          <SelectValue placeholder="Select a program" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* A program that is switched off (BS Criminology) cannot take new students. */}
                          {(programsQuery.data ?? [])
                            .filter((program) => program.status === "active")
                            .map((program) => (
                              <SelectItem
                                key={program.id}
                                value={String(program.id)}
                              >
                                {program.code} — {program.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError>{errors.program_id?.message}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="record-year-level">
                    Year level
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="year_level"
                    render={({ field }) => (
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) => field.onChange(Number(v))}
                      >
                        <SelectTrigger
                          id="record-year-level"
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {YEAR_LEVEL_OPTIONS.map((year) => (
                            <SelectItem key={year} value={String(year)}>
                              {formatYearLevel(year)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field data-invalid={Boolean(errors.enrollment_category)}>
                  <FieldLabel htmlFor="record-category">
                    Enrollment category
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="enrollment_category"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="record-category"
                          className="w-full"
                          aria-invalid={Boolean(errors.enrollment_category)}
                        >
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="irregular">Irregular</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError>{errors.enrollment_category?.message}</FieldError>
                </Field>
                <Field data-invalid={Boolean(errors.student_type)}>
                  <FieldLabel htmlFor="record-student-type">
                    Student type
                  </FieldLabel>
                  <Controller
                    control={control}
                    name="student_type"
                    render={({ field }) => (
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger
                          id="record-student-type"
                          className="w-full"
                          aria-invalid={Boolean(errors.student_type)}
                        >
                          <SelectValue placeholder="Select a student type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="freshman">Freshman</SelectItem>
                          <SelectItem value="transferee">Transferee</SelectItem>
                          <SelectItem value="returnee">Returnee</SelectItem>
                          <SelectItem value="existing_student">
                            Existing Student
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <FieldError>{errors.student_type?.message}</FieldError>
                </Field>
                <Field
                  className="md:col-span-2"
                  data-invalid={Boolean(errors.requirement_type_ids)}
                >
                  <AdmissionIntakeRequirements
                    state={
                      !studentType
                        ? "idle"
                        : requirementsQuery.isError
                          ? "error"
                          : requirementsQuery.isSuccess
                            ? "ready"
                            : "loading"
                    }
                    selection={requirementsQuery.data}
                    checkedIds={checkedIds ?? []}
                    onChange={(ids) =>
                      setValue("requirement_type_ids", ids, {
                        shouldDirty: true,
                      })
                    }
                    disabled={mutation.isPending}
                  />
                  <FieldError>
                    {errors.requirement_type_ids?.message}
                  </FieldError>
                </Field>
                {mutation.isError && (
                  <Alert className="md:col-span-2" variant="destructive">
                    <AlertTitle>
                      {studentType === "freshman"
                        ? "Student not saved"
                        : "Account not created"}
                    </AlertTitle>
                    <AlertDescription>
                      {serverFault ? (
                        // A fault on the server is not something to "review the form" for: show what
                        // the server said (on a developer's machine it names the fix, such as a
                        // migration that has not been run) and the request number to look it up by.
                        <>
                          {serverFault.message}
                          {serverFault.requestId
                            ? ` (Request ${serverFault.requestId})`
                            : ""}{" "}
                          {studentType === "freshman"
                            ? "No student record or queue number was created, so the same details can be sent again."
                            : "No account was created, so the same details can be sent again."}
                        </>
                      ) : studentType === "freshman" ? (
                        "Review the form details and try again. No student record or queue number was created, so nothing is left to clean up."
                      ) : (
                        "Review the form details and try again. No duplicate account was created."
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                  <Button
                    type="submit"
                    disabled={mutation.isPending || programsQuery.isPending}
                  >
                    <UserRoundPlus aria-hidden="true" />
                    {mutation.isPending
                      ? "Saving…"
                      : studentType === "freshman"
                        ? "Save student and issue queue number"
                        : "Create account and email setup"}
                  </Button>
                  {draft.hasContent && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={mutation.isPending}
                        onClick={() => {
                          draft.discard()
                          clearErrors()
                        }}
                      >
                        Clear form
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Your unsaved details are kept in this browser until you
                        create the account or sign out.
                      </p>
                    </>
                  )}
                </div>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle level={2}>Account setup delivery</CardTitle>
            <CardDescription>
              No temporary password is displayed. A freshman gets a queue number
              first and the one-time setup code after paying the Cashier; any
              other student receives the code by email now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {created ? (
              <>
                <div className="flex items-center gap-2">
                  {created.invitation_delivery_status === "failed" ||
                  created.queue_link_delivery_status === "failed" ? (
                    <MailWarning
                      aria-hidden="true"
                      className="text-destructive"
                    />
                  ) : (
                    <CheckCircle2 aria-hidden="true" className="text-success" />
                  )}
                  <strong>{created.name}</strong>
                </div>
                <p className="text-sm text-muted-foreground">
                  {created.student_number}
                </p>
                <InvitationStatusBadge profile={created} />
                <QueueTicketSummary profile={created} />
                {created.account_setup_status === "awaiting_payment" &&
                  created.queue_ticket_number !== null && (
                    <ResendQueueLinkButton
                      profile={created}
                      onResent={setCreated}
                    />
                  )}
                {created.account_setup_status === "pending" && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={resend.isPending}
                    onClick={() =>
                      void resend
                        .mutateAsync(created.id)
                        .then((updated) => {
                          setCreated(updated)
                          toast.success(
                            `Setup email resent to ${updated.email}`,
                          )
                        })
                        .catch(() => {
                          toast.error("Failed to resend setup email.")
                        })
                    }
                  >
                    {resend.isPending ? "Resending…" : "Resend setup email"}
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                The latest account&apos;s invitation and activation state will
                appear here.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      {created && (
        <Card>
          <CardHeader>
            <CardTitle level={2}>Admission requirements</CardTitle>
            <CardDescription>
              Check off {created.name}&apos;s documents as they come in. This is
              the same list shown in the student&apos;s own Admission page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdmissionRequirementsChecklist
              key={created.id}
              studentId={created.id}
              editable
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const editSchema = updateStudentProfileSchema
type EditValues = z.infer<typeof editSchema>

function StudentRecordDialog({
  profile,
  onClose,
}: {
  profile: StudentProfile | null
  onClose: () => void
}) {
  const programsQuery = useProgramsQuery()
  const update = useUpdateStudentProfileMutation()
  const resend = useResendAccountSetupInvitationMutation()
  const { control, handleSubmit, register, reset } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
  })

  useEffect(() => {
    if (!profile) return
    reset({
      first_name: profile.first_name,
      middle_initial: profile.middle_initial ?? "",
      last_name: profile.last_name,
      suffix: profile.suffix ?? "",
      email: profile.email,
      address: profile.address ?? "",
      ...(profile.academic_setup_editable
        ? {
            student_number: profile.student_number,
            program_id: profile.program_id,
            year_level: profile.year_level,
            enrollment_category: profile.enrollment_category ?? undefined,
            student_type: profile.student_type ?? undefined,
            admission_status: profile.admission_status,
          }
        : {}),
      reason: "",
      identity_verified_in_person: false as true,
    })
  }, [profile, reset])

  const submit = async (values: EditValues) => {
    if (!profile) return
    await update.mutateAsync({ id: profile.id, input: values })
    onClose()
  }

  return (
    <Dialog open={profile !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{profile?.name ?? "Student record"}</DialogTitle>
          <DialogDescription>
            Review the official profile and record verified corrections.
            Academic setup fields lock after the first enrollment.
          </DialogDescription>
        </DialogHeader>
        {profile && (
          <form
            className="space-y-4"
            onSubmit={(event) => void handleSubmit(submit)(event)}
          >
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{profile.student_number}</Badge>
              <Badge variant="secondary">{profile.program_code}</Badge>
              <InvitationStatusBadge profile={profile} />
            </div>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="edit-first-name">First name</FieldLabel>
                <Input id="edit-first-name" {...register("first_name")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-last-name">Last name</FieldLabel>
                <Input id="edit-last-name" {...register("last_name")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-middle-initial">
                  Middle initial
                </FieldLabel>
                <Input
                  id="edit-middle-initial"
                  maxLength={10}
                  {...register("middle_initial")}
                />
                <FieldDescription>Optional.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-suffix">Suffix</FieldLabel>
                <Input
                  id="edit-suffix"
                  placeholder="Jr., Sr., III…"
                  maxLength={20}
                  {...register("suffix")}
                />
                <FieldDescription>Optional.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-email">Email</FieldLabel>
                <Input id="edit-email" type="email" {...register("email")} />
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="edit-address">Complete address</FieldLabel>
                <Textarea id="edit-address" {...register("address")} />
              </Field>
              {profile.academic_setup_editable ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="edit-number">
                      Student number
                    </FieldLabel>
                    <Input
                      id="edit-number"
                      readOnly
                      {...register("student_number")}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-program">Program</FieldLabel>
                    <Controller
                      control={control}
                      name="program_id"
                      render={({ field }) => (
                        <Select
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(value) =>
                            field.onChange(Number(value))
                          }
                        >
                          <SelectTrigger id="edit-program" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(programsQuery.data ?? []).map((program) => (
                              <SelectItem
                                key={program.id}
                                value={String(program.id)}
                              >
                                {program.code} — {program.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-level">Year level</FieldLabel>
                    <Input
                      id="edit-level"
                      type="number"
                      min={1}
                      max={4}
                      {...register("year_level", { valueAsNumber: true })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-category">
                      Enrollment category
                    </FieldLabel>
                    <Controller
                      control={control}
                      name="enrollment_category"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="edit-category" className="w-full">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="irregular">Irregular</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-student-type">
                      Student type
                    </FieldLabel>
                    <Controller
                      control={control}
                      name="student_type"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="edit-student-type"
                            className="w-full"
                          >
                            <SelectValue placeholder="Select a student type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="freshman">Freshman</SelectItem>
                            <SelectItem value="transferee">
                              Transferee
                            </SelectItem>
                            <SelectItem value="returnee">Returnee</SelectItem>
                            <SelectItem value="existing_student">
                              Existing Student
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-admission">
                      Admission status
                    </FieldLabel>
                    <Controller
                      control={control}
                      name="admission_status"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="edit-admission" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="admitted">Admitted</SelectItem>
                            <SelectItem value="enrolled">Enrolled</SelectItem>
                            <SelectItem value="graduated">Graduated</SelectItem>
                            <SelectItem value="withdrawn">Withdrawn</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                </>
              ) : (
                <Alert className="md:col-span-2">
                  <AlertDescription>
                    Student number, program, year level, and admission status
                    are locked because this student already has an enrollment.
                    Entry year, enrollment category, and student type are always
                    set automatically and are never directly editable.
                  </AlertDescription>
                </Alert>
              )}
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="edit-reason">
                  Reason for correction
                </FieldLabel>
                <Textarea id="edit-reason" {...register("reason")} />
              </Field>
              <Field className="md:col-span-2">
                <div className="flex items-center gap-3 rounded-md border p-4">
                  <Controller
                    control={control}
                    name="identity_verified_in_person"
                    render={({ field }) => (
                      <Checkbox
                        id="edit-verified"
                        checked={field.value}
                        onCheckedChange={(value) =>
                          field.onChange(value === true)
                        }
                      />
                    )}
                  />
                  <FieldLabel htmlFor="edit-verified">
                    Identity verified in person at Admission
                  </FieldLabel>
                </div>
              </Field>
            </FieldGroup>
            {update.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  The correction could not be saved. Check the values and try
                  again.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save verified correction"}
              </Button>
              {profile.account_setup_status === "pending" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={resend.isPending}
                  onClick={() =>
                    void resend
                      .mutateAsync(profile.id)
                      .then((updated) => {
                        toast.success(`Setup email resent to ${updated.email}`)
                      })
                      .catch(() => {
                        toast.error("Failed to resend setup email.")
                      })
                  }
                >
                  {resend.isPending ? "Resending…" : "Resend setup email"}
                </Button>
              )}
              {profile.account_setup_status === "awaiting_payment" &&
                profile.queue_ticket_number !== null && (
                  <ResendQueueLinkButton profile={profile} />
                )}
            </div>
          </form>
        )}
        {profile && (
          <section
            aria-labelledby="admission-requirements-heading"
            className="grid gap-3 border-t pt-4"
          >
            <h3 id="admission-requirements-heading" className="font-semibold">
              Admission requirements
            </h3>
            <AdmissionRequirementsChecklist
              key={profile.id}
              studentId={profile.id}
              editable
            />
          </section>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StudentDirectoryPanel() {
  // Both the box and the search that was run: coming back shows the same list for the same words.
  const [draftSearch, setDraftSearch] = usePersistedState<string>(
    "admission.directory.search-box.v1",
    "",
  )
  const [search, setSearch] = usePersistedState<string>(
    "admission.directory.search.v1",
    "",
  )
  const [selected, setSelected] = useState<StudentProfile | null>(null)
  const [resendingId, setResendingId] = useState<number | null>(null)
  const query = useStudentDirectoryQuery({ search, page: 1, per_page: 50 })
  const resend = useResendAccountSetupInvitationMutation()

  const columns: DataTableColumn<StudentProfile>[] = [
    {
      key: "student",
      header: "Student",
      render: (profile) => (
        <div>
          <button
            type="button"
            className="text-left font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setSelected(profile)}
          >
            {profile.name}
          </button>
          <div className="whitespace-normal text-xs text-muted-foreground">
            {profile.student_number} · {profile.email}
          </div>
        </div>
      ),
    },
    {
      key: "program",
      header: "Program",
      render: (profile) => profile.program_code,
    },
    {
      key: "type",
      header: "Type",
      render: (profile) => profile.student_type_label ?? "—",
    },
    {
      key: "account",
      header: "Account",
      render: (profile) => <InvitationStatusBadge profile={profile} />,
    },
    {
      key: "action",
      header: "Action",
      render: (profile) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setSelected(profile)}
          >
            View / edit
          </Button>
          {profile.account_setup_status === "pending" && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={resendingId === profile.id || resend.isPending}
              onClick={async () => {
                setResendingId(profile.id)
                try {
                  const updated = await resend.mutateAsync(profile.id)
                  toast.success(`Setup email resent to ${updated.email}`)
                } catch {
                  toast.error("Failed to resend setup email.")
                } finally {
                  setResendingId(null)
                }
              }}
            >
              {resendingId === profile.id ? "Resending…" : "Resend email"}
            </Button>
          )}
          {profile.account_setup_status === "awaiting_payment" &&
            profile.queue_ticket_number !== null && (
              <ResendQueueLinkButton
                profile={profile}
                label="Resend link"
                size="sm"
                variant="secondary"
              />
            )}
        </div>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Student directory</CardTitle>
        <CardDescription>
          Search by full name, student number, or email address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex max-w-2xl gap-2"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            setSearch(draftSearch.trim())
          }}
        >
          <Input
            aria-label="Search student records"
            value={draftSearch}
            onChange={(event) => setDraftSearch(event.target.value)}
            placeholder="Name, student number, or email"
          />
          <Button type="submit">
            <Search aria-hidden="true" />
            Search
          </Button>
        </form>
        <AsyncBoundary
          query={query}
          emptyMessage="No student records matched this search."
        >
          {(page) => (
            <DataTable
              caption="Student directory"
              columns={columns}
              rows={page.data}
              rowKey={(profile) => profile.id}
            />
          )}
        </AsyncBoundary>
        <StudentRecordDialog
          profile={selected}
          onClose={() => setSelected(null)}
        />
      </CardContent>
    </Card>
  )
}

function ChangeRequestDialog({
  request,
  onClose,
}: {
  request: ProfileChangeRequest | null
  onClose: () => void
}) {
  const decide = useDecideProfileChangeRequestMutation()
  const [verified, setVerified] = useState(false)
  const [notes, setNotes] = useState("")

  const makeDecision = async (action: "approve" | "reject") => {
    if (!request || !verified) return
    await decide.mutateAsync({
      id: request.id,
      input: {
        action,
        identity_verified_in_person: true,
        ...(action === "reject" ? { notes } : notes ? { notes } : {}),
      },
    })
    onClose()
  }

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review student information change</DialogTitle>
          <DialogDescription>
            Compare official and proposed values before recording an in-person
            decision.
          </DialogDescription>
        </DialogHeader>
        {request && (
          <div className="space-y-4">
            <div>
              <strong>{request.student_name}</strong>
              <p className="text-sm text-muted-foreground">
                {request.student_number}
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Official</TableHead>
                  <TableHead>Proposed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(["name", "email", "address"] as const).map((field) => (
                  <TableRow key={field}>
                    <TableCell className="capitalize">{field}</TableCell>
                    <TableCell className="whitespace-normal">
                      {request.official[field] ?? "Not provided"}
                    </TableCell>
                    <TableCell className="whitespace-normal font-medium">
                      {request.requested[field]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="rounded-md bg-muted p-3 text-sm">
              <strong>Student reason:</strong> {request.reason}
            </div>
            <Field>
              <FieldLabel htmlFor="decision-notes">Decision notes</FieldLabel>
              <Textarea
                id="decision-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <FieldDescription>Required when rejecting.</FieldDescription>
            </Field>
            <div className="flex items-center gap-3 rounded-md border p-4">
              <Checkbox
                id="decision-verified"
                checked={verified}
                onCheckedChange={(value) => setVerified(value === true)}
              />
              <FieldLabel htmlFor="decision-verified">
                Student identity verified in person at Admission
              </FieldLabel>
            </div>
            {decide.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  The decision was not saved. The request may be stale; reload
                  and review it again.
                </AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={!verified || decide.isPending}
                onClick={() => void makeDecision("approve")}
              >
                Approve changes
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!verified || notes.trim() === "" || decide.isPending}
                onClick={() => void makeDecision("reject")}
              >
                Reject with notes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ChangeRequestsPanel() {
  const query = useProfileChangeRequestsQuery({ page: 1, per_page: 50 })
  const [selected, setSelected] = useState<ProfileChangeRequest | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Student information change requests</CardTitle>
        <CardDescription>
          Review proposed personal-information updates and record the Admission
          decision.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AsyncBoundary
          query={query}
          emptyMessage="No student information change requests yet."
        >
          {(page) => (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.data.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <strong>{request.student_name}</strong>
                      <div className="text-xs text-muted-foreground">
                        {request.student_number}
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.requested_at
                        ? new Date(request.requested_at).toLocaleString()
                        : "Not provided"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          request.status === "approved"
                            ? "success"
                            : request.status === "rejected"
                              ? "destructive"
                              : request.status === "pending"
                                ? "warning"
                                : "outline"
                        }
                      >
                        {request.status_label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {request.status === "pending" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelected(request)}
                        >
                          Review
                        </Button>
                      ) : (
                        (request.decision_notes ?? "Completed")
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </AsyncBoundary>
        <ChangeRequestDialog
          key={selected?.id ?? "closed"}
          request={selected}
          onClose={() => setSelected(null)}
        />
      </CardContent>
    </Card>
  )
}

export function StudentRecordsWorkspace() {
  return (
    <WorkspacePage
      title="Student Records"
      description="Create student access once, maintain official information, and review verified profile changes."
    >
      <Tabs defaultValue="create" className="gap-5">
        <TabsList
          className="h-auto w-full justify-start overflow-x-auto p-1 sm:w-fit"
          aria-label="Student Records sections"
        >
          <TabsTrigger value="create">Create Account</TabsTrigger>
          <TabsTrigger value="directory">Student Directory</TabsTrigger>
          <TabsTrigger value="requests">Change Requests</TabsTrigger>
        </TabsList>
        <TabsContent value="create">
          <CreateAccountPanel />
        </TabsContent>
        <TabsContent value="directory">
          <StudentDirectoryPanel />
        </TabsContent>
        <TabsContent value="requests">
          <ChangeRequestsPanel />
        </TabsContent>
      </Tabs>
    </WorkspacePage>
  )
}
