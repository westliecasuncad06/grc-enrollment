import { StrictMode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { createRoot } from "react-dom/client"

import { App } from "@/app/app"
import { AuthProvider } from "@/app/auth/auth-context"
import { getAuthMode } from "@/app/auth/demo-auth-mode"
import {
  createDemoAuthGateway,
  createDisabledAuthGateway,
} from "@/app/auth/demo-auth-gateway"
import { createBrowserDemoSessionStore } from "@/app/auth/demo-session-store"
import { demoUsers } from "@/app/auth/demo-users"
import { createAppQueryClient } from "@/app/lib/query-client"

import "./index.css"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("The application root element is missing.")
}

const queryClient = createAppQueryClient()
const authMode = getAuthMode()
const authGateway =
  authMode === "demo"
    ? createDemoAuthGateway(demoUsers)
    : createDisabledAuthGateway()
const sessionStore = createBrowserDemoSessionStore()

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider
        authMode={authMode}
        gateway={authGateway}
        sessionStore={sessionStore}
      >
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
