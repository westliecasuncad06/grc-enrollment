"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, MailWarning, Search, UserRoundPlus } from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"

import { AsyncBoundary } from "@/features/components/portal/async-boundary"
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
import {
  useDecideProfileChangeRequestMutation,
  useProfileChangeRequestsQuery,
  useProvisionStudentMutation,
  useResendAccountSetupInvitationMutation,
  useStudentDirectoryQuery,
  useUpdateStudentProfileMutation,
} from "@/features/hooks/use-student-records"
import { useProgramsQuery } from "@/features/hooks/use-reference-data"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import { generateStudentNumber } from "@/features/lib/student-number"
import {
  provisionStudentSchema,
  updateStudentProfileSchema,
  type ProfileChangeRequest,
  type StudentProfile,
} from "@/features/schemas/admission-schema"

const YEAR_LEVEL_OPTIONS = [1, 2, 3, 4] as const
type CreateValues = z.infer<typeof provisionStudentSchema>

function InvitationStatus({ profile }: { profile: StudentProfile }) {
  if (profile.account_setup_status === "active") {
    return <Badge variant="success">Activated</Badge>
  }
  if (profile.invitation_delivery_status === "failed") {
    return <Badge variant="destructive">Delivery failed</Badge>
  }
  if (profile.invitation_delivery_status === "sent") {
    return <Badge variant="warning">Awaiting setup</Badge>
  }
  return <Badge variant="outline">Pending delivery</Badge>
}

function CreateAccountPanel() {
  const programsQuery = useProgramsQuery()
  const mutation = useProvisionStudentMutation()
  const resend = useResendAccountSetupInvitationMutation()
  const [created, setCreated] = useState<StudentProfile | null>(null)
  const [initialStudentNumber] = useState(generateStudentNumber)
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = useForm<CreateValues>({
    resolver: zodResolver(provisionStudentSchema),
    defaultValues: {
      first_name: "",
      middle_initial: "",
      last_name: "",
      suffix: "",
      email: "",
      address: "",
      student_number: initialStudentNumber,
      program_id: 0,
      entry_year: new Date().getFullYear(),
      year_level: 1,
      enrollment_category: "regular",
      student_type: "freshman",
      financial_status: null,
      requirements_verified: false as true,
    },
  })

  const submit = async (values: CreateValues) => {
    try {
      const profile = await mutation.mutateAsync(values)
      setCreated(profile)
      reset({
        ...values,
        first_name: "",
        middle_initial: "",
        last_name: "",
        suffix: "",
        email: "",
        address: "",
        student_number: generateStudentNumber(),
        requirements_verified: false as true,
      })
    } catch (error) {
      applyApiFieldErrors(error, setError)
    }
  }

  return (
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
            noValidate
            onSubmit={(event) => void handleSubmit(submit)(event)}
          >
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field data-invalid={Boolean(errors.first_name)}>
                <FieldLabel htmlFor="record-first-name">First name</FieldLabel>
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
                <Input id="record-email" type="email" {...register("email")} />
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
                <FieldLabel htmlFor="record-number">Student number</FieldLabel>
                <div className="flex gap-2">
                  <Input id="record-number" {...register("student_number")} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setValue("student_number", generateStudentNumber(), {
                        shouldValidate: true,
                      })
                    }
                  >
                    Generate
                  </Button>
                </div>
                <FieldError>{errors.student_number?.message}</FieldError>
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
                <FieldError>{errors.program_id?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.entry_year)}>
                <FieldLabel htmlFor="record-entry-year">Entry year</FieldLabel>
                <Input
                  id="record-entry-year"
                  type="number"
                  {...register("entry_year", { valueAsNumber: true })}
                />
                <FieldError>{errors.entry_year?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="record-year-level">Year level</FieldLabel>
                <Controller
                  control={control}
                  name="year_level"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger id="record-year-level" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {YEAR_LEVEL_OPTIONS.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="record-category">
                  Enrollment category
                </FieldLabel>
                <Controller
                  control={control}
                  name="enrollment_category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="record-category" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="irregular">Irregular</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field data-invalid={Boolean(errors.student_type)}>
                <FieldLabel htmlFor="record-student-type">
                  Student type
                </FieldLabel>
                <Controller
                  control={control}
                  name="student_type"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="record-student-type"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="freshman">Freshman</SelectItem>
                        <SelectItem value="transferee">Transferee</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{errors.student_type?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="record-financial">
                  Financial status
                </FieldLabel>
                <Controller
                  control={control}
                  name="financial_status"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "unset"}
                      onValueChange={(value) =>
                        field.onChange(value === "unset" ? null : value)
                      }
                    >
                      <SelectTrigger id="record-financial" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">Not set</SelectItem>
                        <SelectItem value="scholar">Scholar</SelectItem>
                        <SelectItem value="payee">Payee</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                className="md:col-span-2"
                data-invalid={Boolean(errors.requirements_verified)}
              >
                <div className="flex items-start gap-3 rounded-md border p-4">
                  <Controller
                    control={control}
                    name="requirements_verified"
                    render={({ field }) => (
                      <Checkbox
                        id="requirements-verified"
                        checked={field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(checked === true)
                        }
                      />
                    )}
                  />
                  <div>
                    <FieldLabel htmlFor="requirements-verified">
                      Requirements submitted and verified
                    </FieldLabel>
                    <FieldDescription>
                      I confirm that Admission received the student&apos;s
                      requirements.
                    </FieldDescription>
                  </div>
                </div>
                <FieldError>{errors.requirements_verified?.message}</FieldError>
              </Field>
              {mutation.isError && (
                <Alert className="md:col-span-2" variant="destructive">
                  <AlertTitle>Account not created</AlertTitle>
                  <AlertDescription>
                    Review the form details and try again. No duplicate account
                    was created.
                  </AlertDescription>
                </Alert>
              )}
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={mutation.isPending || programsQuery.isPending}
                >
                  <UserRoundPlus aria-hidden="true" />
                  {mutation.isPending
                    ? "Creating account…"
                    : "Create account and email setup"}
                </Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle level={2}>Account setup delivery</CardTitle>
          <CardDescription>
            No temporary password is displayed. The student receives a one-time
            code by email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {created ? (
            <>
              <div className="flex items-center gap-2">
                {created.invitation_delivery_status === "failed" ? (
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
              <InvitationStatus profile={created} />
              {created.invitation_delivery_status === "failed" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={resend.isPending}
                  onClick={() =>
                    void resend.mutateAsync(created.id).then(setCreated)
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
            entry_year: profile.entry_year ?? new Date().getFullYear(),
            year_level: profile.year_level,
            enrollment_category: profile.enrollment_category ?? "regular",
            student_type: profile.student_type ?? "freshman",
            financial_status: profile.financial_status,
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
              <InvitationStatus profile={profile} />
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
                    <Input id="edit-number" {...register("student_number")} />
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
                    <FieldLabel htmlFor="edit-entry">Entry year</FieldLabel>
                    <Input
                      id="edit-entry"
                      type="number"
                      {...register("entry_year", { valueAsNumber: true })}
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
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="edit-category" className="w-full">
                            <SelectValue />
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
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            id="edit-student-type"
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="freshman">Freshman</SelectItem>
                            <SelectItem value="transferee">
                              Transferee
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="edit-financial">
                      Financial status
                    </FieldLabel>
                    <Controller
                      control={control}
                      name="financial_status"
                      render={({ field }) => (
                        <Select
                          value={field.value ?? "unset"}
                          onValueChange={(value) =>
                            field.onChange(value === "unset" ? null : value)
                          }
                        >
                          <SelectTrigger id="edit-financial" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">Not set</SelectItem>
                            <SelectItem value="scholar">Scholar</SelectItem>
                            <SelectItem value="payee">Payee</SelectItem>
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
                    Student number, program, entry year, year level, category,
                    student type, financial status, and admission status are
                    locked because this student already has an enrollment.
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
                  onClick={() => void resend.mutateAsync(profile.id)}
                >
                  Resend setup email
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StudentDirectoryPanel() {
  const [draftSearch, setDraftSearch] = useState("")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<StudentProfile | null>(null)
  const query = useStudentDirectoryQuery({ search, page: 1, per_page: 50 })

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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.data.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="text-left font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => setSelected(profile)}
                      >
                        {profile.name}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        {profile.student_number} · {profile.email}
                      </div>
                    </TableCell>
                    <TableCell>{profile.program_code}</TableCell>
                    <TableCell>{profile.student_type_label ?? "—"}</TableCell>
                    <TableCell>
                      <InvitationStatus profile={profile} />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(profile)}
                      >
                        View / edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
