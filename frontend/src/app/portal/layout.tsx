import { Suspense, type ReactNode } from "react"

import { RequireSession } from "@/features/auth/auth-route-guards"
import { PortalShell } from "@/features/components/layouts/portal-shell"

// `RequireSession` reads `useSearchParams()` to build the `?returnTo=` value,
// which Next requires be wrapped in a Suspense boundary.
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <RequireSession>
        <PortalShell>{children}</PortalShell>
      </RequireSession>
    </Suspense>
  )
}
