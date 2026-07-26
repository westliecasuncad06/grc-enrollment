import { Route, Routes } from "react-router"

import {
  AnonymousOnlyRoute,
  RequireDemoSession,
} from "@/app/auth/auth-route-guards"
import { PortalShell } from "@/app/components/layouts/portal-shell"
import { LandingPage } from "@/app/components/pages/landing-page"
import { LoginPage } from "@/app/components/pages/login-page"
import { NotFoundPage } from "@/app/components/pages/not-found-page"
import { PortalModulePage } from "@/app/components/pages/portal-module-page"
import { PortalOverviewPage } from "@/app/components/pages/portal-overview-page"

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AnonymousOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<RequireDemoSession />}>
        <Route path="/portal" element={<PortalShell />}>
          <Route index element={<PortalOverviewPage />} />
          <Route path=":moduleId" element={<PortalModulePage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
