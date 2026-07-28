"use client"

import {
  ArrowUpRight,
  CalendarX2,
  CircleCheck,
  CircleDashed,
  ServerCrash,
  ShieldAlert,
} from "lucide-react"
import Link from "next/link"

import { useAuth } from "@/features/auth/use-auth"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { useHealthQuery } from "@/features/hooks/use-health-query"
import { rolePortalDefinitions } from "@/features/portal/role-capabilities"

export function PortalOverviewPage() {
  const { session } = useAuth()
  const healthQuery = useHealthQuery()

  if (!session) {
    return null
  }

  const definition = rolePortalDefinitions[session.role]

  return (
    <main className="portal-overview">
      <section className="portal-overview-header">
        <div>
          <Badge variant="outline">{definition.roleLabel} workspace</Badge>
          <h1>{definition.welcomeHeading}</h1>
          <p>
            Welcome, {session.displayName}. Explore the planned enrollment
            workspace for your role without changing institutional records.
          </p>
        </div>
        <span className="portal-overview-header__folio" aria-hidden="true">
          <strong>GRC</strong>
          <small>Role preview</small>
        </span>
      </section>

      <Alert className="portal-boundary-alert">
        <ShieldAlert aria-hidden="true" />
        <AlertTitle role="heading" aria-level={2}>
          Demo portal interface
        </AlertTitle>
        <AlertDescription>
          <p>
            Workflow and authorization APIs are not connected in this preview.
          </p>
          <p>
            The cards below demonstrate navigation and role visibility only.
          </p>
        </AlertDescription>
      </Alert>

      <section
        className="portal-module-section"
        aria-label={`${definition.roleLabel} portal modules`}
      >
        <div className="portal-section-heading">
          <div>
            <p className="eyebrow">Assigned workspace</p>
            <h2>Modules prepared for your role</h2>
          </div>
          <p>
            Each destination is a clearly labeled preview. Connected records,
            approvals, and transactions remain unavailable.
          </p>
        </div>

        <div className="portal-module-grid">
          {definition.modules.map((module, index) => {
            const Icon = module.icon

            return (
              <Card key={module.id} className="portal-module-card">
                <CardHeader>
                  <span className="portal-module-card__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <CardAction>
                    <Icon aria-hidden="true" />
                  </CardAction>
                  <CardTitle role="heading" aria-level={3}>
                    {module.label}
                  </CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/portal/${module.id}`}>
                      Open {module.label}
                      <ArrowUpRight data-icon="inline-end" aria-hidden="true" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="portal-status-grid" aria-label="Connection status">
        <Card>
          <CardHeader>
            <CardAction>
              <CalendarX2 aria-hidden="true" />
            </CardAction>
            <CardTitle role="heading" aria-level={2}>
              Academic term
            </CardTitle>
            <CardDescription>
              The active term must come from the future institutional settings
              API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">Academic term not connected</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardAction>
              {healthQuery.isPending ? (
                <CircleDashed aria-hidden="true" />
              ) : healthQuery.isError ? (
                <ServerCrash aria-hidden="true" />
              ) : (
                <CircleCheck aria-hidden="true" />
              )}
            </CardAction>
            <CardTitle role="heading" aria-level={2}>
              Public API
            </CardTitle>
            <CardDescription>
              Read-only reachability for the published health contract.
            </CardDescription>
          </CardHeader>
          <CardContent aria-live="polite">
            {healthQuery.isPending && <p>Checking public API…</p>}
            {healthQuery.isError && <p>Public API unavailable</p>}
            {healthQuery.data && (
              <p>Public API online · {healthQuery.data.api_version}</p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
