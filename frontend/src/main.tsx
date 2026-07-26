import { StrictMode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { createRoot } from "react-dom/client"

import { App } from "@/app/app"
import { createAppQueryClient } from "@/app/lib/query-client"

import "./index.css"

const rootElement = document.getElementById("root")

if (!rootElement) {
  throw new Error("The application root element is missing.")
}

const queryClient = createAppQueryClient()

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
