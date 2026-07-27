import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { Link, useNavigate, useSearchParams } from "react-router"
import { z } from "zod"

import {
  DemoAuthError,
  invalidDemoCredentialsMessage,
} from "@/app/auth/demo-auth-gateway"
import type { AuthMode } from "@/app/auth/demo-auth-mode"
import { useAuth } from "@/app/auth/use-auth"
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert"
import { Button } from "@/app/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/app/components/ui/field"
import { Input } from "@/app/components/ui/input"
import { getSafeReturnPath } from "@/app/router/safe-return-path"

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
})

type LoginValues = z.infer<typeof loginSchema>

interface LoginModeCopy {
  eyebrow: string
  formIntro: string
  guideDescription: string
  guidePath: string
  purposeDescription: string
  invalidCredentialsMessage: string
  boundaryAlert?: {
    title: string
    description: string
  }
}

const genericInvalidCredentialsMessage =
  "The email or password you entered was not recognized."

const modeCopy: Record<AuthMode, LoginModeCopy> = {
  api: {
    eyebrow: "Enrollment portal",
    formIntro: "Sign in with your institutional GRC account.",
    guideDescription: "Seeded development identities",
    guidePath: "docs/testing/SEEDED_IDENTITIES.md",
    purposeDescription:
      "Enter your credentials to reach the role-guided enrollment portal assigned to your account.",
    invalidCredentialsMessage: genericInvalidCredentialsMessage,
  },
  demo: {
    eyebrow: "Demo portal access",
    formIntro:
      "Use one of the nine synthetic role accounts from the local testing guide.",
    guideDescription: "Local credential guide",
    guidePath: "docs/testing/DEMO_CREDENTIALS.md",
    purposeDescription:
      "Enter the local demonstration portal to review role-guided enrollment navigation before real identity services are connected.",
    invalidCredentialsMessage: invalidDemoCredentialsMessage,
    boundaryAlert: {
      title: "Interface demonstration—not real authentication",
      description:
        "The credentials in this local preview are client fixtures. Laravel does not accept them.",
    },
  },
  disabled: {
    eyebrow: "Enrollment portal",
    formIntro: "Sign-in is unavailable in this environment.",
    guideDescription: "Seeded development identities",
    guidePath: "docs/testing/SEEDED_IDENTITIES.md",
    purposeDescription: "Sign-in is unavailable in this environment.",
    invalidCredentialsMessage: genericInvalidCredentialsMessage,
  },
}

const trustStatements = [
  {
    icon: UsersRound,
    title: "Role-aware navigation",
    description: "Each identity opens its assigned portal pathway.",
  },
  {
    icon: LockKeyhole,
    title: "Private records stay private",
    description: "This interface loads no student record on sign-in.",
  },
  {
    icon: ShieldCheck,
    title: "Authorized workflows",
    description: "Every protected action requires server authorization.",
  },
] as const

export function LoginPage() {
  const { authMode, signIn } = useAuth()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    shouldFocusError: false,
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const submitLogin = async (values: LoginValues) => {
    try {
      await signIn(values)
      await navigate(getSafeReturnPath(searchParams.get("returnTo")), {
        replace: true,
      })
    } catch (error) {
      const message =
        error instanceof DemoAuthError && error.code === "DEMO_AUTH_DISABLED"
          ? error.message
          : modeCopy[authMode].invalidCredentialsMessage

      setError("root.credentials", { message })
      setValue("password", "")
    }
  }

  const errorMessages = [
    errors.email?.message,
    errors.password?.message,
    errors.root?.credentials?.message,
  ].filter((message): message is string => Boolean(message))
  const hasErrors = errorMessages.length > 0
  const signInDisabled = authMode === "disabled"
  const copy = modeCopy[authMode]

  useEffect(() => {
    if (hasErrors) {
      errorSummaryRef.current?.focus()
    }
  }, [hasErrors])

  return (
    <main className="login-shell">
      <section
        className="login-institutional-panel"
        aria-labelledby="login-purpose-title"
      >
        <Link
          className="login-brand"
          to="/"
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
          <h2 id="login-purpose-title">
            One identity. The right work in view.
          </h2>
          <p>{copy.purposeDescription}</p>
        </div>

        <ul className="login-trust-list">
          {trustStatements.map((statement) => {
            const Icon = statement.icon

            return (
              <li key={statement.title}>
                <Icon aria-hidden="true" />
                <div>
                  <strong>{statement.title}</strong>
                  <span>{statement.description}</span>
                </div>
              </li>
            )
          })}
        </ul>

        {copy.boundaryAlert && (
          <Alert className="login-boundary-alert">
            <KeyRound aria-hidden="true" />
            <AlertTitle>{copy.boundaryAlert.title}</AlertTitle>
            <AlertDescription>
              {copy.boundaryAlert.description}
            </AlertDescription>
          </Alert>
        )}
      </section>

      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form-card">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1 id="login-title">Sign in to your portal</h1>
            <p className="login-form-intro">{copy.formIntro}</p>
          </div>

          {signInDisabled && (
            <Alert variant="destructive">
              <LockKeyhole aria-hidden="true" />
              <AlertTitle>Demo access disabled</AlertTitle>
              <AlertDescription>
                Demo portal access is unavailable in this environment.
              </AlertDescription>
            </Alert>
          )}

          {hasErrors && (
            <div
              ref={errorSummaryRef}
              className="login-error-summary"
              role="alert"
              aria-label="Sign-in errors"
              tabIndex={-1}
            >
              <strong>Check the sign-in details.</strong>
              <ul>
                {errorMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <form
            noValidate
            onSubmit={(event) => void handleSubmit(submitLogin)(event)}
          >
            <FieldGroup>
              <Field data-invalid={Boolean(errors.email)}>
                <FieldLabel htmlFor="login-email">Email address</FieldLabel>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  placeholder="name@grc.test"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={
                    errors.email ? "login-email-error" : undefined
                  }
                  disabled={signInDisabled || isSubmitting}
                  {...register("email")}
                />
                <FieldError id="login-email-error">
                  {errors.email?.message}
                </FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.password)}>
                <FieldLabel htmlFor="login-password">Password</FieldLabel>
                <div className="login-password-row">
                  <Input
                    id="login-password"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={
                      errors.password ? "login-password-error" : undefined
                    }
                    disabled={signInDisabled || isSubmitting}
                    {...register("password")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={
                      passwordVisible ? "Hide password" : "Show password"
                    }
                    disabled={signInDisabled || isSubmitting}
                    onClick={() => setPasswordVisible((visible) => !visible)}
                  >
                    {passwordVisible ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </Button>
                </div>
                <FieldError id="login-password-error">
                  {errors.password?.message}
                </FieldError>
              </Field>
            </FieldGroup>

            <Button
              className="login-submit"
              type="submit"
              size="lg"
              disabled={signInDisabled || isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
            <span className="sr-only" role="status" aria-live="polite">
              {isSubmitting ? "Checking credentials." : ""}
            </span>
          </form>

          <div className="login-guide-note">
            <FieldDescription>{copy.guideDescription}</FieldDescription>
            <code>{copy.guidePath}</code>
          </div>

          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Return to the landing page
            </Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
