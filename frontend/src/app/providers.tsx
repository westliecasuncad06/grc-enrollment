"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

import { createApiAuthGateway } from "@/features/auth/api-auth-gateway"
import { AuthProvider } from "@/features/auth/auth-context"
import { createBrowserAuthTokenStore } from "@/features/auth/auth-token"
import { createAppQueryClient } from "@/features/lib/query-client"
import { Toaster } from "@/features/components/ui/toaster"
import {
  setAuthTokenProvider,
  setUnauthorizedHandler,
} from "@/features/services/api-client"

/**
 * The application's composition root, replacing Vite's `main.tsx`.
 *
 * Everything here is created inside `useState` initializers rather than at
 * module scope. Under Next.js a module is shared across every request the
 * server handles, so a module-scope QueryClient or token provider would leak
 * one user's cache and credentials into another's request. `"use client"`
 * keeps this file out of the server bundle, and the lazy initializers keep it
 * correct even so.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createAppQueryClient)

  const [gateway] = useState(() => {
    const tokenStore = createBrowserAuthTokenStore()

    // The API client reaches the token through this provider so
    // `auth-token.ts` remains the only module that touches token storage
    // (PRD §9.1).
    setAuthTokenProvider(() => tokenStore.read())
    setUnauthorizedHandler(() => {
      tokenStore.clear()
    })

    return createApiAuthGateway(tokenStore)
  })

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider gateway={gateway}>{children}</AuthProvider>
      <Toaster />
    </QueryClientProvider>
  )
}
