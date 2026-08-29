"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"
import { Button } from "@/features/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { applyApiFieldErrors } from "@/features/lib/api-form-errors"
import { accountSetupSchema } from "@/features/schemas/admission-schema"
import { facultyAccountSetupSchema } from "@/features/schemas/faculty-invitation-schema"
import { staffAccountSetupSchema } from "@/features/schemas/staff-invitation-schema"
import { setupStudentAccount } from "@/features/services/admission-service"
import { setupFacultyAccount } from "@/features/services/faculty-invitation-service"
import { setupStaffAccount } from "@/features/services/staff-invitation-service"

interface AccountSetupFormValues {
  email: string
  code: string
  name?: string
  password: string
  password_confirmation: string
}

interface AccountSetupPageProps {
  /** Faculty and staff supply a name here since the inviting Chair/Registrar Head only gave an email — the Student flow never needed this field. */
  variant?: "student" | "faculty" | "staff"
}

const COPY = {
  student: {
    eyebrow: "Student account",
    inviterLine:
      "Use the one-time code delivered separately in your Admission account-setup email.",
    enterLine: "Enter the email and one-time code from your Admission message.",
    nameHint: "",
  },
  faculty: {
    eyebrow: "Faculty account",
    inviterLine:
      "Use the one-time code delivered separately in your Program Chair's invitation email.",
    enterLine:
      "Enter the email and one-time code from your Program Chair's invitation.",
    nameHint:
      "Your Program Chair invited you by email only — tell us your name here.",
  },
  staff: {
    eyebrow: "Staff account",
    inviterLine:
      "Use the one-time code delivered separately in your Registrar's Office invitation email.",
    enterLine:
      "Enter the email and one-time code from your Registrar's Office invitation.",
    nameHint:
      "The Registrar's Office invited you by email only — tell us your name here.",
  },
} as const

export function AccountSetupPage({ variant = "student" }: AccountSetupPageProps) {
  const router = useRouter()
  const needsName = variant !== "student"
  const copy = COPY[variant]
  const [completed, setCompleted] = useState(false)
  const [requestError, setRequestError] = useState("")
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<AccountSetupFormValues>({
    resolver: zodResolver(
      variant === "faculty"
        ? facultyAccountSetupSchema
        : variant === "staff"
          ? staffAccountSetupSchema
          : accountSetupSchema,
    ) as Resolver<AccountSetupFormValues>,
    defaultValues: {
      email: "",
      code: "",
      ...(needsName ? { name: "" } : {}),
      password: "",
      password_confirmation: "",
    },
  })

  useEffect(() => {
    if (!completed) return
    const redirectTimer = window.setTimeout(
      () => router.replace("/login?accountSetup=complete"),
      1500,
    )
    return () => window.clearTimeout(redirectTimer)
  }, [completed, router])

  const submit = async (values: AccountSetupFormValues) => {
    setRequestError("")
    try {
      if (variant === "faculty") {
        await setupFacultyAccount({
          email: values.email,
          code: values.code,
          name: values.name ?? "",
          password: values.password,
          password_confirmation: values.password_confirmation,
        })
      } else if (variant === "staff") {
        await setupStaffAccount({
          email: values.email,
          code: values.code,
          name: values.name ?? "",
          password: values.password,
          password_confirmation: values.password_confirmation,
        })
      } else {
        await setupStudentAccount({
          email: values.email,
          code: values.code,
          password: values.password,
          password_confirmation: values.password_confirmation,
        })
      }
      setCompleted(true)
    } catch (error) {
      if (!applyApiFieldErrors(error, setError)) {
        setRequestError(
          "The setup code could not be verified. It may be invalid, expired, or already used.",
        )
      }
    }
  }

  return (
    <main className="login-shell">
      <section
        className="login-institutional-panel"
        aria-labelledby="setup-purpose-title"
      >
        <Link
          className="login-brand"
          href="/"
          aria-label="Return to GRC enrollment home"
        >
          <span className="grc-monogram" aria-hidden="true">
            GRC
          </span>
          <span>
            <strong>Global Reciprocal Colleges</strong>
            <small>Automated Enrollment System</small>
          </span>
        </Link>
        <div className="login-purpose">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id="setup-purpose-title">Create your private password.</h2>
          <p>{copy.inviterLine}</p>
        </div>
        <ul className="login-trust-list">
          <li>
            <MailCheck aria-hidden="true" />
            <div>
              <strong>Separate setup code</strong>
              <span>The code never appears in the page link.</span>
            </div>
          </li>
          <li>
            <KeyRound aria-hidden="true" />
            <div>
              <strong>One use only</strong>
              <span>
                The code expires after 60 minutes and cannot be reused.
              </span>
            </div>
          </li>
          <li>
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>Account stays disabled</strong>
              <span>Access opens only after a valid setup is completed.</span>
            </div>
          </li>
        </ul>
      </section>
      <section
        className="login-form-panel"
        aria-labelledby="account-setup-title"
      >
        <div className="login-form-card">
          {completed ? (
            <div className="space-y-5" role="status" aria-live="polite">
              <div>
                <p className="eyebrow">Setup complete</p>
                <h1 id="account-setup-title">Your account is active.</h1>
              </div>
              <Alert>
                <MailCheck aria-hidden="true" />
                <AlertTitle>Password created</AlertTitle>
                <AlertDescription>
                  You can now sign in with your email and new password.
                  Redirecting to sign in…
                </AlertDescription>
              </Alert>
              <Button
                type="button"
                onClick={() => router.replace("/login?accountSetup=complete")}
              >
                Continue to sign in
              </Button>
            </div>
          ) : (
            <>
              <div>
                <p className="eyebrow">Secure activation</p>
                <h1 id="account-setup-title">Set up your account</h1>
                <p className="login-form-intro">{copy.enterLine}</p>
              </div>
              {requestError && (
                <Alert variant="destructive">
                  <AlertTitle>Setup not completed</AlertTitle>
                  <AlertDescription>{requestError}</AlertDescription>
                </Alert>
              )}
              <form
                noValidate
                onSubmit={(event) => void handleSubmit(submit)(event)}
              >
                <FieldGroup>
                  <Field data-invalid={Boolean(errors.email)}>
                    <FieldLabel htmlFor="setup-email">Email address</FieldLabel>
                    <Input
                      id="setup-email"
                      type="email"
                      autoComplete="username"
                      disabled={isSubmitting}
                      {...register("email")}
                    />
                    <FieldError>{errors.email?.message}</FieldError>
                  </Field>
                  <Field data-invalid={Boolean(errors.code)}>
                    <FieldLabel htmlFor="setup-code">
                      One-time setup code
                    </FieldLabel>
                    <Input
                      id="setup-code"
                      autoComplete="one-time-code"
                      disabled={isSubmitting}
                      {...register("code")}
                    />
                    <FieldDescription>
                      Codes expire 60 minutes after the latest invitation.
                    </FieldDescription>
                    <FieldError>{errors.code?.message}</FieldError>
                  </Field>
                  {needsName && (
                    <Field data-invalid={Boolean(errors.name)}>
                      <FieldLabel htmlFor="setup-name">Full name</FieldLabel>
                      <Input
                        id="setup-name"
                        autoComplete="name"
                        disabled={isSubmitting}
                        {...register("name")}
                      />
                      <FieldDescription>{copy.nameHint}</FieldDescription>
                      <FieldError>{errors.name?.message}</FieldError>
                    </Field>
                  )}
                  <Field data-invalid={Boolean(errors.password)}>
                    <FieldLabel htmlFor="setup-password">
                      New password
                    </FieldLabel>
                    <Input
                      id="setup-password"
                      type="password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      {...register("password")}
                    />
                    <FieldError>{errors.password?.message}</FieldError>
                  </Field>
                  <Field data-invalid={Boolean(errors.password_confirmation)}>
                    <FieldLabel htmlFor="setup-confirm">
                      Confirm new password
                    </FieldLabel>
                    <Input
                      id="setup-confirm"
                      type="password"
                      autoComplete="new-password"
                      disabled={isSubmitting}
                      {...register("password_confirmation")}
                    />
                    <FieldError>
                      {errors.password_confirmation?.message}
                    </FieldError>
                  </Field>
                </FieldGroup>
                <Button
                  className="login-submit"
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Activating account…"
                    : "Create password and activate"}
                </Button>
              </form>
              <Button asChild variant="ghost">
                <Link href="/login">Return to sign in</Link>
              </Button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
