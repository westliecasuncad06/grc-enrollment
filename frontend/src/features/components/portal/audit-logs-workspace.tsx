"use client"

import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { Paginator } from "@/features/components/portal/paginator"
import { ScheduleDecisionControls } from "@/features/components/portal/schedule-decision-workspace"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { useAuditLogsQuery } from "@/features/hooks/use-audit-logs"
import { useScheduleProposalsQuery } from "@/features/hooks/use-scheduling"
import {
  auditActions,
  auditableTypes,
  type AuditLogFilters,
} from "@/features/schemas/audit-schema"

const defaults: AuditLogFilters = { page: 1, per_page: 20 }
function snapshot(value: Record<string, unknown> | null) {
  if (value === null) return "No recorded values."
  const redact = (input: unknown, key = ""): unknown => {
    if (/email|name|password|token|secret/iu.test(key)) return "[redacted]"
    if (Array.isArray(input)) return input.map((item) => redact(item))
    if (input && typeof input === "object")
      return Object.fromEntries(
        Object.entries(input).map(([childKey, childValue]) => [
          childKey,
          redact(childValue, childKey),
        ]),
      )
    return input
  }
  return JSON.stringify(redact(value), null, 2)
}

export function AuditLogsWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "registrar_head"
  const [filters, setFilters] = useState<AuditLogFilters>(defaults)
  const auditQuery = useAuditLogsQuery(filters, authorized)
  const proposalsQuery = useScheduleProposalsQuery({ enabled: authorized })
  const combinedQuery = {
    isPending: auditQuery.isPending || proposalsQuery.isPending,
    isError: auditQuery.isError || proposalsQuery.isError,
    error: auditQuery.error ?? proposalsQuery.error,
    data: auditQuery.data,
    refetch: () => {
      void auditQuery.refetch()
      void proposalsQuery.refetch()
    },
  }
  const apply = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const get = (name: string) => {
      const value = values.get(name)
      return typeof value === "string" ? value.trim() : ""
    }
    const actor = get("actor_user_id")
    const action = auditActions.find((value) => value === get("action"))
    const auditableType = auditableTypes.find(
      (value) => value === get("auditable_type"),
    )
    setFilters({
      action,
      auditable_type: auditableType,
      actor_user_id: actor ? Number(actor) : undefined,
      from: get("from") || undefined,
      to: get("to") || undefined,
      page: 1,
      per_page: 20,
    })
  }
  return (
    <WorkspacePage
      title="Audit logs"
      description="Operational activity is shown without actor names or email addresses."
      unauthorized={!authorized}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          apply(event.currentTarget)
        }}
        className="grid gap-2 md:grid-cols-3"
      >
        <label>
          Action
          <select name="action" defaultValue="">
            <option value="">All actions</option>
            {auditActions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
        <label>
          Entity type
          <select name="auditable_type" defaultValue="">
            <option value="">All entity types</option>
            {auditableTypes.map((auditableType) => (
              <option key={auditableType} value={auditableType}>
                {auditableType}
              </option>
            ))}
          </select>
        </label>
        <label>
          Actor user ID
          <input name="actor_user_id" inputMode="numeric" />
        </label>
        <label>
          From
          <input name="from" type="date" />
        </label>
        <label>
          To
          <input name="to" type="date" />
        </label>
        <Button type="submit">Apply audit filters</Button>
      </form>
      <AsyncBoundary
        query={combinedQuery}
        isEmpty={(audit) => audit.data.length === 0}
        emptyMessage="No audit records match these filters."
        loadingLabel="Loading audit logs…"
      >
        {(audit) => (
          <>
            <Card>
              <CardHeader>
                <CardTitle level={3}>Audit history</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-3">
                  {audit.data.map((log) => (
                    <li key={log.id} className="rounded-md border p-3">
                      <p>
                        {log.action} · {log.auditable_type}
                        {log.auditable_id ? ` #${log.auditable_id}` : ""}
                      </p>
                      <p>
                        {log.actor_role_label} account #{log.actor_user_id} ·{" "}
                        {log.created_at ?? "Timestamp unavailable"}
                      </p>
                      <details>
                        <summary>Expand audit snapshot</summary>
                        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                          Before: {snapshot(log.before_values)}
                          {"\n"}After: {snapshot(log.after_values)}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Paginator
                    currentPage={audit.meta.current_page}
                    lastPage={audit.meta.last_page}
                    onPageChange={(page) =>
                      setFilters((value) => ({ ...value, page }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle level={3}>Published proposal closure</CardTitle>
              </CardHeader>
              <CardContent>
                <ScheduleDecisionControls
                  actorRole="registrar_head"
                  proposals={proposalsQuery.data ?? []}
                />
              </CardContent>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
