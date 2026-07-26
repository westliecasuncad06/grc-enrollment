import { QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router"

import { AuthProvider } from "@/app/auth/auth-context"
import type { AuthMode } from "@/app/auth/demo-auth-mode"
import {
  createDemoAuthGateway,
  createDisabledAuthGateway,
} from "@/app/auth/demo-auth-gateway"
import type { DemoAuthGateway, DemoSession } from "@/app/auth/demo-auth-types"
import {
  createDemoSessionStore,
  demoSessionStorageKey,
  type DemoSessionPersistence,
  type SessionStorageLike,
} from "@/app/auth/demo-session-store"
import { demoUsers } from "@/app/auth/demo-users"
import { createAppQueryClient } from "@/app/lib/query-client"
import { AppRouter } from "@/app/router/app-router"
import { LocationProbe } from "@/tests/location-probe"

class TestStorage implements SessionStorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

interface RenderAppOptions {
  authMode?: AuthMode
  gateway?: DemoAuthGateway
  initialSession?: DemoSession
  persistedValue?: string
  sessionStore?: DemoSessionPersistence
}

export function renderAppAtRoute(
  route: string,
  {
    authMode = "demo",
    gateway: gatewayOverride,
    initialSession,
    persistedValue,
    sessionStore: sessionStoreOverride,
  }: RenderAppOptions = {},
) {
  const storage = new TestStorage()

  if (persistedValue !== undefined) {
    storage.setItem(demoSessionStorageKey, persistedValue)
  }

  const sessionStore = sessionStoreOverride ?? createDemoSessionStore(storage)

  if (initialSession && !sessionStoreOverride) {
    sessionStore.write(initialSession)
  }

  const gateway =
    gatewayOverride ??
    (authMode === "demo"
      ? createDemoAuthGateway(demoUsers)
      : createDisabledAuthGateway())
  const queryClient = createAppQueryClient()

  const result = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        authMode={authMode}
        gateway={gateway}
        sessionStore={sessionStore}
      >
        <MemoryRouter initialEntries={[route]}>
          <AppRouter />
          <LocationProbe />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )

  return {
    ...result,
    sessionStore,
    storage,
  }
}
