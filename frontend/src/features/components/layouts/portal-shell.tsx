"use client"

import {
  Bell,
  CircleHelp,
  Flag,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  UserRound,
} from "lucide-react"
import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { startTransition, type ReactNode } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Avatar, AvatarFallback } from "@/features/components/ui/avatar"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import { Separator } from "@/features/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/features/components/ui/sheet"
import { PortalNotificationSheet } from "@/features/components/portal/portal-notification-sheet"
import { useAcademicTermsQuery } from "@/features/hooks/use-reference-data"
import { cn } from "@/features/lib/utils"
import {
  formatAcademicTerm,
  getActiveAcademicTerm,
} from "@/features/services/reference-data-service"
import {
  getRoleModule,
  rolePortalDefinitions,
  type RolePortalDefinition,
} from "@/features/portal/role-capabilities"

interface PortalNavigationProps {
  definition: RolePortalDefinition
  mobile?: boolean
}

function NavigationLink({
  children,
  href,
  mobile = false,
}: {
  children: ReactNode
  href: string
  mobile?: boolean
}) {
  const pathname = usePathname()
  // react-router's NavLink used `end` only for "/portal"; module routes have no
  // children, so an exact comparison reproduces both cases.
  const isActive = pathname === href

  const link = (
    <Link
      href={href}
      className={cn("portal-nav-link", isActive && "portal-nav-link--active")}
    >
      {children}
    </Link>
  )

  return mobile ? <SheetClose asChild>{link}</SheetClose> : link
}

function PortalNavigation({
  definition,
  mobile = false,
}: PortalNavigationProps) {
  return (
    <nav
      className="portal-navigation"
      aria-label={
        mobile ? "Mobile role portal navigation" : "Role portal navigation"
      }
    >
      <NavigationLink href="/portal" mobile={mobile}>
        <LayoutDashboard data-icon="inline-start" aria-hidden="true" />
        <span>Portal overview</span>
      </NavigationLink>
      {definition.modules.map((module) => {
        const Icon = module.icon

        return (
          <NavigationLink
            key={module.id}
            href={`/portal/${module.id}`}
            mobile={mobile}
          >
            <Icon data-icon="inline-start" aria-hidden="true" />
            <span>{module.label}</span>
          </NavigationLink>
        )
      })}
    </nav>
  )
}

function PortalIdentity() {
  return (
    <div className="portal-brand">
      <span className="grc-monogram" aria-hidden="true">
        GRC
      </span>
      <span>
        <strong>Global Reciprocal Colleges</strong>
        <small>Enrollment System</small>
      </span>
    </div>
  )
}

function PreviewAction({
  icon: Icon,
  label,
}: {
  icon: typeof Bell
  label: string
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled
      aria-label={label}
      title={`${label} — not connected`}
    >
      <Icon aria-hidden="true" />
    </Button>
  )
}

export function PortalShell({ children }: { children: ReactNode }) {
  const { session, signOut, storageAvailable } = useAuth()
  const academicTermsQuery = useAcademicTermsQuery({
    enabled: session !== null,
  })
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ moduleId?: string }>()

  if (!session) {
    return null
  }

  const moduleId = typeof params.moduleId === "string" ? params.moduleId : null
  const definition = rolePortalDefinitions[session.role]
  const activeModule = moduleId ? getRoleModule(session.role, moduleId) : null
  const activeAcademicTerm = getActiveAcademicTerm(academicTermsQuery.data)
  const currentPageLabel =
    pathname === "/portal"
      ? "Portal overview"
      : (activeModule?.label ?? "Module preview")
  const initials = session.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  function handleSignOut() {
    // Navigate away before clearing the session, so RequireSession never sees
    // an anonymous user still sitting on /portal and bounces them to /login.
    // `router.replace` no longer returns a promise the way react-router's
    // `navigate` did, so a transition is what keeps the two batched together.
    startTransition(() => {
      router.replace("/")
      signOut()
    })
  }

  return (
    <div className="portal-app">
      <a className="skip-link" href="#portal-content">
        Skip to portal content
      </a>

      <aside className="portal-sidebar">
        <div>
          <PortalIdentity />
          <Badge variant="secondary">Preview portal</Badge>
        </div>

        <PortalNavigation definition={definition} />

        <div className="portal-sidebar__footer">
          <p>
            {activeAcademicTerm
              ? formatAcademicTerm(activeAcademicTerm)
              : academicTermsQuery.isPending
                ? "Loading academic term…"
                : "No active academic term"}
          </p>
          <Separator />
          <div className="portal-profile">
            <Avatar>
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <strong>{session.displayName}</strong>
              <span>{definition.roleLabel}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="portal-main-column">
        <header className="portal-topbar">
          <div className="portal-topbar__context">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  className="portal-mobile-trigger"
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Open portal navigation"
                >
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="portal-mobile-sheet">
                <SheetHeader>
                  <SheetTitle>Portal navigation</SheetTitle>
                  <SheetDescription>
                    {definition.roleLabel} workspace
                  </SheetDescription>
                </SheetHeader>
                <div className="portal-mobile-sheet__body">
                  <PortalIdentity />
                  <Badge variant="secondary">Preview portal</Badge>
                  <PortalNavigation definition={definition} mobile />
                </div>
              </SheetContent>
            </Sheet>

            <div>
              <p>Role workspace / {definition.roleLabel}</p>
              <strong>{currentPageLabel}</strong>
            </div>
          </div>

          <div className="portal-topbar__actions">
            <PortalNotificationSheet />
            <PreviewAction icon={UserRound} label="Profile preview" />
            <PreviewAction icon={KeyRound} label="Password settings preview" />
            <PreviewAction icon={CircleHelp} label="Help preview" />
            <PreviewAction icon={Flag} label="Report issue preview" />
            <Separator orientation="vertical" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut data-icon="inline-start" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </header>

        {!storageAvailable && (
          <Alert className="portal-storage-alert">
            <AlertDescription>
              Your session cannot be restored after refresh on this browser.
            </AlertDescription>
          </Alert>
        )}

        <div id="portal-content" className="portal-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  )
}
