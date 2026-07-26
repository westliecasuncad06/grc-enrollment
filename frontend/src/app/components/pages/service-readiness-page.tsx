import {
  ArrowRight,
  CircleCheck,
  LockKeyhole,
  Monitor,
  RefreshCw,
  Server,
  ShieldCheck,
  Waypoints,
  WifiOff,
} from "lucide-react"

import { ServiceBoundaryCard } from "@/app/components/common/service-boundary-card"
import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert"
import { Button } from "@/app/components/ui/button"
import { Separator } from "@/app/components/ui/separator"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useHealthQuery } from "@/app/hooks/use-health-query"
import { cn } from "@/app/lib/utils"
import { isApiClientError } from "@/app/services/api-client"
import { PUBLIC_API_HEALTH_PATH } from "@/app/services/health-service"
import type { ServiceHealth } from "@/app/types/health"

interface ErrorPresentation {
  message: string
  title: string
}

function getErrorPresentation(error: unknown): ErrorPresentation {
  if (!isApiClientError(error)) {
    return {
      title: "Connection interrupted",
      message:
        "The public enrollment API is not available right now. Confirm that the Laravel service is running, then try again.",
    }
  }

  switch (error.kind) {
    case "configuration":
      return {
        title: "API address needs attention",
        message: error.message,
      }
    case "contract":
      return {
        title: "Unexpected API response",
        message: error.message,
      }
    case "http":
      return {
        title: "API check was not accepted",
        message: error.requestId
          ? `${error.message} Request ${error.requestId}.`
          : error.message,
      }
    case "connection":
      return {
        title: "Connection interrupted",
        message:
          "The public enrollment API is not available right now. Confirm that the Laravel service is running, then try again.",
      }
  }
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(value))
}

function ApiHealthContent({
  error,
  health,
  isPending,
}: {
  error: unknown
  health?: ServiceHealth
  isPending: boolean
}) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-live="polite">
        <span>Contacting the public gateway…</span>
        <div className="flex flex-col gap-2" aria-hidden="true">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    )
  }

  if (!health) {
    const presentation = getErrorPresentation(error)

    return (
      <Alert variant="destructive">
        <WifiOff aria-hidden="true" />
        <AlertTitle>{presentation.title}</AlertTitle>
        <AlertDescription>{presentation.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="health-confirmation" role="status" aria-live="polite">
        <CircleCheck aria-hidden="true" />
        <span>Public gateway responding</span>
      </div>
      <dl className="health-ledger">
        <div>
          <dt>Service</dt>
          <dd>{health.service}</dd>
        </div>
        <div>
          <dt>Contract</dt>
          <dd>{health.api_version}</dd>
        </div>
        <div>
          <dt>API report</dt>
          <dd>
            <time dateTime={health.generated_at}>
              {formatGeneratedAt(health.generated_at)}
            </time>
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function ServiceReadinessPage() {
  const {
    data: health,
    error,
    isError,
    isFetching,
    isPending,
    refetch,
  } = useHealthQuery()

  const apiBadge = isPending
    ? "Checking"
    : isError
      ? "Unavailable"
      : "API online"
  const apiBadgeVariant = isPending
    ? "secondary"
    : isError
      ? "destructive"
      : "default"
  const statusLine = isPending
    ? "Checking the versioned public API."
    : isError
      ? "The public API needs attention."
      : isFetching
        ? "Refreshing the latest API report."
        : "The public API contract is responding."

  return (
    <div className="institutional-shell">
      <a className="skip-link" href="#main-content">
        Skip to service status
      </a>

      <header className="site-masthead">
        <div className="institutional-identity">
          <div className="grc-monogram" aria-hidden="true">
            GRC
          </div>
          <div>
            <p className="institution-name">Global Reciprocal Colleges</p>
            <p className="system-name">Automated Enrollment System</p>
          </div>
        </div>
        <div className="phase-folio" aria-label="Current delivery phase">
          <span>Foundation ledger</span>
          <strong>Phase 0A</strong>
        </div>
      </header>

      <Separator />

      <main id="main-content" tabIndex={-1}>
        <section className="readiness-hero" aria-labelledby="readiness-title">
          <div className="hero-copy reveal reveal--one">
            <p className="eyebrow">
              <Waypoints aria-hidden="true" />
              Service wayfinding · Folio 001
            </p>
            <h1 id="readiness-title">
              Enrollment systems,
              <em> accounted for.</em>
            </h1>
            <p className="hero-summary">
              A contract-first checkpoint for the public enrollment gateway—
              before student records, approvals, or predictive services enter
              the room.
            </p>
            <div className="hero-action-row">
              <Button
                type="button"
                variant={isError ? "default" : "outline"}
                size="lg"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={cn(isFetching && "animate-spin")}
                  aria-hidden="true"
                />
                {isFetching
                  ? "Checking…"
                  : isError
                    ? "Retry API check"
                    : "Check again"}
              </Button>
              <p className="hero-status" aria-live="polite">
                {statusLine}
              </p>
            </div>
          </div>

          <aside
            className="route-ledger reveal reveal--two"
            aria-label="Service boundary route"
          >
            <div className="route-ledger__heading">
              <span>Route ledger</span>
              <span aria-hidden="true">GRC / 26</span>
            </div>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <small>Browser entry</small>
                  <strong>Vite SPA</strong>
                </div>
                <ArrowRight aria-hidden="true" />
              </li>
              <li>
                <span>02</span>
                <div>
                  <small>Public contract</small>
                  <strong>/api/v1</strong>
                </div>
                <ArrowRight aria-hidden="true" />
              </li>
              <li>
                <span>03</span>
                <div>
                  <small>Private handoff</small>
                  <strong>Laravel → ML</strong>
                </div>
                <LockKeyhole aria-hidden="true" />
              </li>
            </ol>
            <p>
              The browser stops at Laravel. Predictive services remain private
              and advisory.
            </p>
          </aside>
        </section>

        <section
          className="boundary-section reveal reveal--three"
          aria-labelledby="boundary-heading"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">Service boundaries</p>
              <h2 id="boundary-heading">Three clear lines of responsibility</h2>
            </div>
            <p>
              This screen verifies one public route only. It does not infer
              database or prediction readiness.
            </p>
          </div>

          <div className="boundary-grid">
            <ServiceBoundaryCard
              index="01"
              icon={Monitor}
              title="Web interface"
              description="A strict-TypeScript shell for role-governed enrollment journeys."
              badge="Shell ready"
              badgeVariant="secondary"
              footer={<span>No authentication or student data loaded</span>}
            >
              <p className="boundary-card__copy">
                The interface is independently runnable and configured to
                contact only the public Laravel origin.
              </p>
            </ServiceBoundaryCard>

            <ServiceBoundaryCard
              index="02"
              icon={Server}
              title="Public API"
              description="The versioned Laravel boundary for all browser-facing data."
              badge={apiBadge}
              badgeVariant={apiBadgeVariant}
              footer={<code>GET {PUBLIC_API_HEALTH_PATH}</code>}
            >
              <ApiHealthContent
                error={error}
                health={health}
                isPending={isPending}
              />
            </ServiceBoundaryCard>

            <ServiceBoundaryCard
              index="03"
              icon={LockKeyhole}
              title="Predictive service"
              description="A private advisory boundary reached by Laravel—not by this browser."
              badge="Server only"
              badgeVariant="outline"
              footer={<span>No browser request is made</span>}
            >
              <p className="boundary-card__copy">
                Demand and attrition outputs remain decision support. They never
                become automatic enrollment denials.
              </p>
            </ServiceBoundaryCard>
          </div>
        </section>

        <section
          className="boundary-note reveal reveal--four"
          aria-labelledby="boundary-note-title"
        >
          <div className="boundary-note__icon" aria-hidden="true">
            <ShieldCheck />
          </div>
          <div>
            <p className="eyebrow">Boundary rule</p>
            <h2 id="boundary-note-title">One public route. No shortcuts.</h2>
          </div>
          <p>
            Browser traffic ends at the versioned Laravel API. Database and
            predictive-service access stay behind that authorization boundary.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <span>Phase 0A · Contract-first service shell</span>
        <span>Global Reciprocal Colleges · Caloocan City</span>
      </footer>
    </div>
  )
}
