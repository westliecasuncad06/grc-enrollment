"use client"

import { ArrowLeft, Construction, ShieldX } from "lucide-react"
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/features/components/ui/empty"
import {
  getRoleModule,
  rolePortalDefinitions,
} from "@/features/portal/role-capabilities"
import {
  isConnectedModuleId,
  connectedModuleRegistry,
} from "@/features/portal/module-registry"

export function PortalModulePage({ moduleId }: { moduleId: string }) {
  const { session } = useAuth()

  if (!session) {
    return null
  }

  const definition = rolePortalDefinitions[session.role]
  const module = getRoleModule(session.role, moduleId)

  if (!module) {
    return (
      <main className="portal-module-page">
        <Empty
          className="portal-module-empty"
          role="region"
          aria-label="Unavailable portal module"
        >
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldX aria-hidden="true" />
            </EmptyMedia>
            <Badge variant="outline">{definition.roleLabel}</Badge>
            <EmptyTitle role="heading" aria-level={1}>
              Portal module not found
            </EmptyTitle>
            <EmptyDescription>
              This destination is not assigned to your signed-in demo role.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <p>
              Use the role navigation or return to the overview to continue
              within your assigned workspace.
            </p>
            <Button asChild>
              <Link href="/portal">
                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                Return to portal overview
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    )
  }

  const Icon = module.icon
  const ModuleComponent = isConnectedModuleId(module.id)
    ? connectedModuleRegistry[module.id]
    : null

  if (ModuleComponent) {
    // This wraps every connected workspace in a second, near-identically
    // named region (the workspace's own WorkspacePage renders its own
    // labelled section inside). Left as-is here deliberately — de-duplicating
    // it requires threading each multiplexed workspace's per-module heading
    // (e.g. RegistrarRecordsWorkspace's `workspaceHeadings[initialModuleId]`)
    // into that inner section's own label so it can become the sole region,
    // which is Task 5 (workspace migration) work, not a shell-only change.
    return (
      <main className="portal-module-page">
        <section
          className="portal-module-empty"
          aria-label={`${module.label} workspace`}
        >
          <Badge variant="outline">{definition.roleLabel}</Badge>
          <h1>{module.label}</h1>
          <p>{module.description}</p>
          <ModuleComponent />
          <Button asChild variant="outline">
            <Link href="/portal">
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Return to portal overview
            </Link>
          </Button>
        </section>
      </main>
    )
  }

  return (
    <main className="portal-module-page">
      <Empty
        className="portal-module-empty"
        role="region"
        aria-label={`${module.label} module preview`}
      >
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon aria-hidden="true" />
          </EmptyMedia>
          <Badge variant="outline">{definition.roleLabel}</Badge>
          <EmptyTitle role="heading" aria-level={1}>
            {module.label}
          </EmptyTitle>
          <EmptyDescription>{module.description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Alert className="portal-module-warning">
            <Construction aria-hidden="true" />
            <AlertTitle role="heading" aria-level={2}>
              Demo module preview
            </AlertTitle>
            <AlertDescription>
              This module is not connected to workflow or authorization APIs.
            </AlertDescription>
          </Alert>
          <Button asChild variant="outline">
            <Link href="/portal">
              <ArrowLeft data-icon="inline-start" aria-hidden="true" />
              Return to portal overview
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  )
}
