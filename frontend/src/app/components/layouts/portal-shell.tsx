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
import type { ReactNode } from "react"
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router"

import { useAuth } from "@/app/auth/use-auth"
import { Alert, AlertDescription } from "@/app/components/ui/alert"
import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Separator } from "@/app/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/app/components/ui/sheet"
import { cn } from "@/app/lib/utils"
import {
  getRoleModule,
  rolePortalDefinitions,
  type RolePortalDefinition,
} from "@/app/portal/role-capabilities"

interface PortalNavigationProps {
  definition: RolePortalDefinition
  mobile?: boolean
}

function NavigationLink({
  children,
  mobile = false,
  to,
}: {
  children: ReactNode
  mobile?: boolean
  to: string
}) {
  const link = (
    <NavLink
      to={to}
      end={to === "/portal"}
      className={({ isActive }) =>
        cn("portal-nav-link", isActive && "portal-nav-link--active")
      }
    >
      {children}
    </NavLink>
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
      <NavigationLink to="/portal" mobile={mobile}>
        <LayoutDashboard data-icon="inline-start" aria-hidden="true" />
        <span>Portal overview</span>
      </NavigationLink>
      {definition.modules.map((module) => {
        const Icon = module.icon

        return (
          <NavigationLink
            key={module.id}
            to={`/portal/${module.id}`}
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

export function PortalShell() {
  const { authMode, session, signOut, storageAvailable } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { moduleId } = useParams()

  if (!session) {
    return null
  }

  const isDemo = authMode === "demo"
  const portalBadgeLabel = isDemo ? "Demo portal" : "Preview portal"
  const workspaceDescriptor = isDemo ? "demo workspace" : "workspace"
  const storageWarning = isDemo
    ? "This demo session cannot be restored after refresh on this browser."
    : "Your session cannot be restored after refresh on this browser."

  const definition = rolePortalDefinitions[session.role]
  const activeModule = moduleId ? getRoleModule(session.role, moduleId) : null
  const currentPageLabel =
    location.pathname === "/portal"
      ? "Portal overview"
      : (activeModule?.label ?? "Module preview")
  const initials = session.displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  async function handleSignOut() {
    await navigate("/", { replace: true })
    signOut()
  }

  return (
    <div className="portal-app">
      <a className="skip-link" href="#portal-content">
        Skip to portal content
      </a>

      <aside className="portal-sidebar">
        <div>
          <PortalIdentity />
          <Badge variant="secondary">{portalBadgeLabel}</Badge>
        </div>

        <PortalNavigation definition={definition} />

        <div className="portal-sidebar__footer">
          <p>Academic term not connected</p>
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
                    {definition.roleLabel} {workspaceDescriptor}
                  </SheetDescription>
                </SheetHeader>
                <div className="portal-mobile-sheet__body">
                  <PortalIdentity />
                  <Badge variant="secondary">{portalBadgeLabel}</Badge>
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
            <PreviewAction icon={Bell} label="Notifications preview" />
            <PreviewAction icon={UserRound} label="Profile preview" />
            <PreviewAction icon={KeyRound} label="Password settings preview" />
            <PreviewAction icon={CircleHelp} label="Help preview" />
            <PreviewAction icon={Flag} label="Report issue preview" />
            <Separator orientation="vertical" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleSignOut()}
              aria-label="Sign out"
            >
              <LogOut data-icon="inline-start" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </header>

        {!storageAvailable && (
          <Alert className="portal-storage-alert">
            <AlertDescription>{storageWarning}</AlertDescription>
          </Alert>
        )}

        <div id="portal-content" className="portal-content" tabIndex={-1}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
