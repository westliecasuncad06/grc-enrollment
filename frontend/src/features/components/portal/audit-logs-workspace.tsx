"use client"

import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { ScheduleDecisionControls } from "@/features/components/portal/schedule-decision-workspace"
import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Skeleton } from "@/features/components/ui/skeleton"
import { useAuditLogsQuery } from "@/features/hooks/use-audit-logs"
import { useScheduleProposalsQuery } from "@/features/hooks/use-scheduling"
import type { AuditLogFilters } from "@/features/schemas/audit-schema"

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
  if (!authorized)
    return (
      <section aria-label="Audit logs workspace">
        <p>This workspace is not available for your role.</p>
      </section>
    )
  const loading = auditQuery.isLoading || proposalsQuery.isLoading
  const failed = auditQuery.isError || proposalsQuery.isError
  const apply = (form: HTMLFormElement) => {
    const values = new FormData(form)
    const get = (name: string) => {
      const value = values.get(name)
      return typeof value === "string" ? value.trim() : ""
    }
    const actor = get("actor_user_id")
    setFilters({
      action: get("action") || undefined,
      auditable_type: get("auditable_type") || undefined,
      actor_user_id: actor ? Number(actor) : undefined,
      from: get("from") || undefined,
      to: get("to") || undefined,
      page: 1,
      per_page: 20,
    })
  }
  return (
    <section aria-label="Audit logs workspace" className="grid gap-4">
      <div>
        <h2>Audit logs</h2>
        <p>
          Operational activity is shown without actor names or email addresses.
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          apply(event.currentTarget)
        }}
        className="grid gap-2 md:grid-cols-3"
      >
        <label>
          Action
          <input name="action" />
        </label>
        <label>
          Entity type
          <input name="auditable_type" />
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
      {loading ? (
        <Skeleton className="h-48" />
      ) : failed ? (
        <Alert variant="destructive">
          <AlertDescription>
            Audit logs could not be loaded.{" "}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void Promise.all([
                  auditQuery.refetch(),
                  proposalsQuery.refetch(),
                ])
              }
            >
              Retry audit logs
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Audit history</CardTitle>
            </CardHeader>
            <CardContent>
              {(auditQuery.data?.data.length ?? 0) === 0 ? (
                <p>No audit records match these filters.</p>
              ) : (
                <ul className="grid gap-3">
                  {(auditQuery.data?.data ?? []).map((log) => (
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
              )}
              <div className="mt-4 flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={(auditQuery.data?.meta.current_page ?? 1) <= 1}
                  onClick={() =>
                    setFilters((value) => ({
                      ...value,
                      page: Math.max(1, (value.page ?? 1) - 1),
                    }))
                  }
                >
                  Previous page
                </Button>
                <span>
                  Page {auditQuery.data?.meta.current_page ?? 1} of{" "}
                  {auditQuery.data?.meta.last_page ?? 1}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    (auditQuery.data?.meta.current_page ?? 1) >=
                    (auditQuery.data?.meta.last_page ?? 1)
                  }
                  onClick={() =>
                    setFilters((value) => ({
                      ...value,
                      page: (value.page ?? 1) + 1,
                    }))
                  }
                >
                  Next page
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Published proposal closure</CardTitle>
            </CardHeader>
            <CardContent>
              <ScheduleDecisionControls
                role="registrar_head"
                proposals={proposalsQuery.data ?? []}
              />
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}
