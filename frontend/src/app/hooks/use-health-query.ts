import { useQuery } from "@tanstack/react-query"

import { getPublicApiHealth } from "@/app/services/health-service"

export const publicApiHealthQueryKey = ["service-health", "public-api"] as const

export function useHealthQuery() {
  return useQuery({
    queryKey: publicApiHealthQueryKey,
    queryFn: ({ signal }) => getPublicApiHealth({ signal }),
  })
}
