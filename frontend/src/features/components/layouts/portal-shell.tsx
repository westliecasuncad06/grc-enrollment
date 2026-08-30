"use client"

import { useGSAP } from "@gsap/react"
import { LayoutDashboard, LogOut, Menu } from "lucide-react"
import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { startTransition, useRef, type ReactNode } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { Breadcrumb } from "@/features/components/common/breadcrumb"
import { GrcBrand } from "@/features/components/common/grc-brand"
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
import { useAcademicTermWorkflowsQuery } from "@/features/hooks/use-academic-term-workflows"
import { useScheduleProposalsQuery } from "@/features/hooks/use-scheduling"
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
import { useReducedMotion } from "@/features/hooks/use-reduced-motion"
import { gsap } from "@/features/lib/gsap"
import { isConnectedModuleId } from "@/features/portal/module-registry"

interface PortalNavigationProps {
  definition: RolePortalDefinition
  mobile?: boolean
}

function NavigationLink({
  children,
  href,
  mobile = false,
  locked = false,
}: {
  children: ReactNode
  href: string
  mobile?: boolean
  locked?: boolean
}) {
  const pathname = usePathname()
  // react-router's NavLink used `end` only for "/portal"; module routes have no
  // children, so an exact comparison reproduces both cases.
  const isActive = pathname === href

  const link = (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-disabled={locked ? "true" : undefined}
      title={locked ? "Complete Enrollment steps first" : undefined}
      onClick={(event) => {
        if (locked) event.preventDefault()
      }}
      className={cn(
        "portal-nav-link",
        isActive && "portal-nav-link--active",
        locked && "portal-nav-link--locked",
      )}
    >
      {children}
    </Link>
  )

  return mobile ? <SheetClose asChild>{link}</SheetClose> : link
}

function PortalNavigation({
  definition,
  mobile = false,
  enrollmentLinksLocked = false,
  hasReturnedSchedule = false,
}: PortalNavigationProps & {
  enrollmentLinksLocked?: boolean
  hasReturnedSchedule?: boolean
}) {
  return (
    <nav
      className="portal-navigation"
      aria-label={
        mobile ? "Mobile role portal navigation" : "Role portal navigation"
      }
    >
      <NavigationLink href="/portal" mobile={mobile}>
        <LayoutDashboard data-icon="inline-start" aria-hidden="true" />
        <span>GRC Connect</span>
      </NavigationLink>
      {definition.modules
        .filter((module) => isConnectedModuleId(module.id))
        .map((module) => {
          const Icon = module.icon

          return (
            <NavigationLink
              key={module.id}
              href={`/portal/${module.id}`}
              mobile={mobile}
              locked={
                enrollmentLinksLocked &&
                ["schedule-proposals"].includes(module.id)
              }
            >
              <Icon data-icon="inline-start" aria-hidden="true" />
              <span className="flex min-w-0 items-center justify-between gap-2">
                {module.label}
                {hasReturnedSchedule &&
                  module.id === "program-chair-enrollment" && (
                    <Badge variant="destructive" className="shrink-0">
                      Returned
                    </Badge>
                  )}
              </span>
            </NavigationLink>
          )
        })}
    </nav>
  )
}

function PortalIdentity() {
  return (
    <div className="portal-brand">
      <GrcBrand compact />
    </div>
  )
}

export function PortalShell({ children }: { children: ReactNode }) {
  const { session, signOut, storageAvailable } = useAuth()
  const academicTermsQuery = useAcademicTermsQuery({
    enabled: session !== null,
  })
  const activeAcademicTerm = getActiveAcademicTerm(academicTermsQuery.data)
  const workflowsQuery = useAcademicTermWorkflowsQuery(
    activeAcademicTerm?.id ?? 0,
    session?.role === "program_chair" && activeAcademicTerm !== null,
  )
  const scheduleProposalsQuery = useScheduleProposalsQuery({
    enabled: session?.role === "program_chair",
  })
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ moduleId?: string }>()
  const reducedMotion = useReducedMotion()
  const sidebarRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // ── Sidebar nav links: stagger-in on first mount ─────────────────────────
  useGSAP(
    () => {
      if (reducedMotion || !session) return
      gsap.from(".portal-nav-link", {
        opacity: 0,
        x: -10,
        duration: 0.35,
        ease: "power2.out",
        stagger: 0.06,
        delay: 0.1,
      })
    },
    { scope: sidebarRef, dependencies: [reducedMotion, Boolean(session)] },
  )

  // ── Portal content area: fade-in on route change ─────────────────────────
  useGSAP(
    () => {
      if (reducedMotion || !session) return
      gsap.fromTo(
        ".portal-content",
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
      )
    },
    {
      scope: contentRef,
      dependencies: [pathname, reducedMotion, Boolean(session)],
    },
  )

  if (!session) {
    return null
  }

  const moduleId = typeof params.moduleId === "string" ? params.moduleId : null
  const definition = rolePortalDefinitions[session.role]
  const activeModule = moduleId ? getRoleModule(session.role, moduleId) : null
  const chairWorkflow =
    workflowsQuery.data?.find((item) => item.college === session.college) ??
    workflowsQuery.data?.[0]
  const enrollmentLinksLocked =
    session.role === "program_chair" &&
    chairWorkflow?.stage !== "schedule_preparation" &&
    chairWorkflow?.stage !== "for_dean_approval"
  const hasReturnedSchedule =
    session.role === "program_chair" &&
    (scheduleProposalsQuery.data ?? []).some((proposal) => proposal.is_returned)
  const currentPageLabel =
    pathname === "/portal"
      ? "GRC Connect"
      : (activeModule?.label ?? "Unavailable workspace")
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

      <aside className="portal-sidebar" ref={sidebarRef}>
        <div>
          <PortalIdentity />
          <Badge variant="secondary">GRC Connect</Badge>
        </div>

        <PortalNavigation
          definition={definition}
          enrollmentLinksLocked={enrollmentLinksLocked}
          hasReturnedSchedule={hasReturnedSchedule}
        />

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

      <div className="portal-main-column" ref={contentRef}>
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
                  <SheetTitle>GRC Connect navigation</SheetTitle>
                  <SheetDescription>
                    {definition.roleLabel} workspace
                  </SheetDescription>
                </SheetHeader>
                <div className="portal-mobile-sheet__body">
                  <PortalIdentity />
                  <Badge variant="secondary">GRC Connect</Badge>
                  <PortalNavigation
                    definition={definition}
                    mobile
                    enrollmentLinksLocked={enrollmentLinksLocked}
                    hasReturnedSchedule={hasReturnedSchedule}
                  />
                </div>
              </SheetContent>
            </Sheet>

            <Breadcrumb
              items={
                pathname === "/portal"
                  ? [{ label: "GRC Connect" }]
                  : [
                      { label: "GRC Connect", href: "/portal" },
                      { label: currentPageLabel },
                    ]
              }
            />
          </div>

          <div className="portal-topbar__actions">
            <PortalNotificationSheet />
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
