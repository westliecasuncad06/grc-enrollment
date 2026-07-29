"use client"

import { useQuery } from "@tanstack/react-query"

import { useAuth } from "@/features/auth/use-auth"
import { type AuditLogFilters } from "@/features/schemas/audit-schema"
import { getAuditLogs } from "@/features/services/audit-service"

export const auditLogsQueryKey = (
  userId: string | null,
  filters: AuditLogFilters,
) => ["audit-logs", userId, filters] as const

export function useAuditLogsQuery(filters: AuditLogFilters, enabled = true) {
  const { session } = useAuth()
  return useQuery({
    queryKey: auditLogsQueryKey(session?.userId ?? null, filters),
    queryFn: ({ signal }) => getAuditLogs(filters, signal),
    enabled: enabled && session !== null,
  })
}
