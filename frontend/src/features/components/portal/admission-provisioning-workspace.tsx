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
}

interface CredentialReceipt {
  credential: string
  profile: StudentProfile
}

export function AdmissionProvisioningWorkspace({
  initialModuleId = "student-accounts",
  generateCredential = generateTemporaryCredential,
  writeCredential = (credential) => navigator.clipboard.writeText(credential),
}: AdmissionProvisioningWorkspaceProps) {
  const [receipt, setReceipt] = useState<CredentialReceipt | null>(null)
  const [copyStatus, setCopyStatus] = useState("")
  const [requestError, setRequestError] = useState("")
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
      student_number: "",
      program_id: 0,
      curriculum_id: 0,
      year_level: 0,
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
    reset()
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
                <Input
                  id="admission-student-number"
                  disabled={isProvisioning}
                  aria-invalid={Boolean(errors.student_number)}
                  {...register("student_number")}
                />
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
                        {[1, 2, 3, 4].map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            Year {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError>{errors.year_level?.message}</FieldError>
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
