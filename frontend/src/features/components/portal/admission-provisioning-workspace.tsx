"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { z } from "zod"

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
import { useStudentProvisioning } from "@/features/hooks/use-student-provisioning"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import { generateStudentNumber } from "@/features/lib/student-number"
import { generateTemporaryCredential } from "@/features/lib/temporary-credential"
import {
  useCurriculaQuery,
  useProgramsQuery,
} from "@/features/hooks/use-reference-data"
import {
  provisionStudentSchema,
  type StudentProfile,
} from "@/features/schemas/admission-schema"

const formSchema = provisionStudentSchema.omit({ password: true })

/** Ordinals, matching how the enrollment schedule names each year level. */
const YEAR_LEVEL_OPTIONS = [
  { value: 1, label: "1st Year" },
  { value: 2, label: "2nd Year" },
  { value: 3, label: "3rd Year" },
  { value: 4, label: "4th Year" },
] as const
type AdmissionFormValues = z.infer<typeof formSchema>

const workspaceHeadings: Record<string, string> = {
  "student-accounts": "Student accounts",
  "admission-status": "Admission status",
  "credential-issuance": "Credential issuance",
}

interface AdmissionProvisioningWorkspaceProps {
  initialModuleId?: string
  generateCredential?: () => string
  writeCredential?: (credential: string) => Promise<void>
  generateStudentNumber?: () => string
}

interface CredentialReceipt {
  credential: string
  profile: StudentProfile
}

export function AdmissionProvisioningWorkspace({
  initialModuleId = "student-accounts",
  generateCredential = generateTemporaryCredential,
  writeCredential = (credential) => navigator.clipboard.writeText(credential),
  generateStudentNumber: makeStudentNumber = generateStudentNumber,
}: AdmissionProvisioningWorkspaceProps) {
  const [receipt, setReceipt] = useState<CredentialReceipt | null>(null)
  const [copyStatus, setCopyStatus] = useState("")
  const [requestError, setRequestError] = useState("")
  // Computed once at mount, not inline in `defaultValues` below — that
  // object literal is rebuilt on every render (React Hook Form only reads
  // it once), so calling the generator there would silently waste a call
  // per keystroke instead of exactly once.
  const [initialStudentNumber] = useState(makeStudentNumber)
  const programsQuery = useProgramsQuery()
  const curriculaQuery = useCurriculaQuery()
  const { isProvisioning, provision } = useStudentProvisioning()
  const heading =
    workspaceHeadings[initialModuleId] ?? workspaceHeadings["student-accounts"]
  const {
    formState: { errors },
    control,
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
  } = useForm<AdmissionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      student_number: initialStudentNumber,
      program_id: 0,
      curriculum_id: 0,
      year_level: 0,
      enrollment_category: "regular",
      financial_status: undefined,
    },
  })
  const selectedProgramId = useWatch({ control, name: "program_id" })
  const curricula = useMemo(
    () =>
      (curriculaQuery.data ?? []).filter(
        (curriculum) => curriculum.program_id === selectedProgramId,
      ),
    [curriculaQuery.data, selectedProgramId],
  )

  const submit = async (values: AdmissionFormValues) => {
    setRequestError("")
    setCopyStatus("")

    try {
      const created = await provision(values, generateCredential)
      setReceipt(created)
    } catch (error) {
      if (!applyApiFieldErrors(error, setError)) {
        setRequestError(
          "The student account could not be created. Check the connection and try again.",
        )
      }
    }
  }

  const copyCredential = async () => {
    if (!receipt) {
      return
    }

    try {
      await writeCredential(receipt.credential)
      setCopyStatus("Credential copied")
    } catch {
      setCopyStatus("Credential copy is unavailable in this browser.")
    }
  }

  const closeReceipt = () => {
    setReceipt(null)
    setCopyStatus("")
    // `reset()` with no args restores the *original* mount-time defaults —
    // including the already-used student number — so the next account
    // would immediately collide. Generate a fresh one instead.
    reset({
      name: "",
      email: "",
      student_number: makeStudentNumber(),
      program_id: 0,
      curriculum_id: 0,
      year_level: 0,
      enrollment_category: "regular",
      financial_status: undefined,
    })
  }

  return (
    <WorkspacePage
      title={heading}
      description="Create an admitted student account, verify its initial outcome, and hand off its temporary credential once."
    >
      <Card>
        <CardHeader>
          <CardTitle level={2}>1. Student account details</CardTitle>
          <CardDescription>
            Only the approved account and profile fields are submitted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            onSubmit={(event) => void handleSubmit(submit)(event)}
          >
            <FieldGroup>
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="admission-name">Student name</FieldLabel>
                <Input
                  id="admission-name"
                  disabled={isProvisioning}
                  aria-invalid={Boolean(errors.name)}
                  {...register("name")}
                />
                <FieldError>{errors.name?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="admission-email">Email address</FieldLabel>
                <Input
                  id="admission-email"
                  type="email"
                  autoComplete="email"
                  disabled={isProvisioning}
                  aria-invalid={Boolean(errors.email)}
                  {...register("email")}
                />
                <FieldError>{errors.email?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.student_number)}>
                <FieldLabel htmlFor="admission-student-number">
                  Student number
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="admission-student-number"
                    disabled={isProvisioning}
                    aria-invalid={Boolean(errors.student_number)}
                    {...register("student_number")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isProvisioning}
                    onClick={() =>
                      setValue("student_number", makeStudentNumber(), {
                        shouldValidate: true,
                      })
                    }
                  >
                    Generate new number
                  </Button>
                </div>
                <FieldDescription>
                  Auto-generated as YYYY-MM-NNNNN. Generate a new one if this
                  number turns out to already be taken.
                </FieldDescription>
                <FieldError>{errors.student_number?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.program_id)}>
                <FieldLabel htmlFor="admission-program">Program</FieldLabel>
                <Controller
                  control={control}
                  name="program_id"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => {
                        field.onChange(Number(value))
                        setValue("curriculum_id", 0, { shouldValidate: true })
                      }}
                      disabled={isProvisioning || programsQuery.isLoading}
                    >
                      <SelectTrigger
                        id="admission-program"
                        className="w-full"
                        aria-invalid={Boolean(errors.program_id)}
                      >
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
              <Field data-invalid={Boolean(errors.curriculum_id)}>
                <FieldLabel htmlFor="admission-curriculum">
                  Curriculum
                </FieldLabel>
                <Controller
                  control={control}
                  name="curriculum_id"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => field.onChange(Number(value))}
                      disabled={
                        isProvisioning ||
                        curriculaQuery.isLoading ||
                        selectedProgramId === 0
                      }
                    >
                      <SelectTrigger
                        id="admission-curriculum"
                        className="w-full"
                        aria-invalid={Boolean(errors.curriculum_id)}
                      >
                        <SelectValue placeholder="Select a curriculum" />
                      </SelectTrigger>
                      <SelectContent>
                        {curricula.map((curriculum) => (
                          <SelectItem
                            key={curriculum.id}
                            value={String(curriculum.id)}
                          >
                            {curriculum.name} (
                            {curriculum.effective_school_year})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{errors.curriculum_id?.message}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.year_level)}>
                <FieldLabel htmlFor="admission-year-level">
                  Year level
                </FieldLabel>
                <Controller
                  control={control}
                  name="year_level"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(value) => field.onChange(Number(value))}
                      disabled={isProvisioning}
                    >
                      <SelectTrigger
                        id="admission-year-level"
                        className="w-full"
                        aria-invalid={Boolean(errors.year_level)}
                      >
                        <SelectValue placeholder="Select a year level" />
                      </SelectTrigger>
                      <SelectContent>
                        {YEAR_LEVEL_OPTIONS.map(({ value, label }) => (
                          <SelectItem key={value} value={String(value)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{errors.year_level?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="admission-enrollment-category">
                  Enrollment category
                </FieldLabel>
                <Controller
                  control={control}
                  name="enrollment_category"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isProvisioning}
                    >
                      <SelectTrigger
                        id="admission-enrollment-category"
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="irregular">Irregular</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldDescription>
                  Regular students enrol in their year level&apos;s block.
                  Irregular students choose subjects individually during the
                  irregular enrollment window.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="admission-financial-status">
                  Financial status
                </FieldLabel>
                <Controller
                  control={control}
                  name="financial_status"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "unset"}
                      onValueChange={(value) =>
                        field.onChange(value === "unset" ? undefined : value)
                      }
                      disabled={isProvisioning}
                    >
                      <SelectTrigger
                        id="admission-financial-status"
                        className="w-full"
                      >
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
                <FieldDescription>
                  Informational only — shown to Registrar and Accounting
                  staff. Does not change fee computation.
                </FieldDescription>
              </Field>
              {requestError && (
                <Alert variant="destructive">
                  <AlertDescription>{requestError}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={
                    isProvisioning ||
                    programsQuery.isLoading ||
                    curriculaQuery.isLoading
                  }
                >
                  {isProvisioning
                    ? "Creating student account…"
                    : "Create student account"}
                </Button>
                {requestError && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isProvisioning}
                    onClick={() => void handleSubmit(submit)()}
                  >
                    Try again
                  </Button>
                )}
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle level={2}>2. Initial admission outcome</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Admission status: Admitted</p>
          <p>Academic standing: Good</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle level={2}>3. Credential handoff</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            A temporary credential is generated in this browser only after
            submission and is never saved by this workspace.
          </p>
        </CardContent>
      </Card>

      <Dialog
        open={receipt !== null}
        onOpenChange={(open) => {
          if (!open) closeReceipt()
        }}
      >
        <DialogContent
          showCloseButton={false}
          aria-describedby="credential-receipt-description"
        >
          <DialogHeader>
            <DialogTitle>Student account created</DialogTitle>
            <DialogDescription id="credential-receipt-description">
              Give this one-time temporary credential to the student through the
              approved handoff channel. It will be cleared when this receipt
              closes.
            </DialogDescription>
          </DialogHeader>
          <code>{receipt?.credential}</code>
          <div className="flex gap-2">
            <Button type="button" onClick={() => void copyCredential()}>
              Copy temporary credential
            </Button>
            <Button type="button" variant="outline" onClick={closeReceipt}>
              Close credential receipt
            </Button>
          </div>
          <span role="status" aria-live="polite">
            {copyStatus}
          </span>
        </DialogContent>
      </Dialog>
    </WorkspacePage>
  )
}
