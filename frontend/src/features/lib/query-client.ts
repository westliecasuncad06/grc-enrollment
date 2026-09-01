import { QueryClient } from "@tanstack/react-query"

import { isApiClientError } from "@/features/services/api-client"

/**
 * Retrying a 4xx is never useful — a 403/404/409/422/429 will fail again
 * identically, and retrying 429 specifically makes throttling worse. Only
 * retry failures that might be transient: network/offline (`kind:
 * "connection"`) and 5xx.
 */
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) {
    return false
  }

  if (!isApiClientError(error)) {
    return true
  }

  if (error.kind !== "http") {
    return error.kind === "connection"
  }

  return (error.status ?? 0) >= 500
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 15 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
        staleTime: 5 * 60 * 1000,
      },
    },
  })
}
