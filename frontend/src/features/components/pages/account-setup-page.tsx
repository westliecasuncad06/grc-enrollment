"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

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
import {
  accountSetupSchema,
  type AccountSetupInput,
} from "@/features/schemas/admission-schema"
import { setupStudentAccount } from "@/features/services/admission-service"

export function AccountSetupPage() {
  const router = useRouter()
  const [completed, setCompleted] = useState(false)
  const [requestError, setRequestError] = useState("")
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<AccountSetupInput>({
    resolver: zodResolver(accountSetupSchema),
    defaultValues: {
      email: "",
      code: "",
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

  const submit = async (values: AccountSetupInput) => {
    setRequestError("")
    try {
      await setupStudentAccount(values)
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
          <p className="eyebrow">Student account</p>
          <h2 id="setup-purpose-title">Create your private password.</h2>
          <p>
            Use the one-time code delivered separately in your Admission
            account-setup email.
          </p>
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
                <p className="login-form-intro">
                  Enter the email and one-time code from your Admission message.
                </p>
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
