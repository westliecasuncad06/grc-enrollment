"use client"

import { useState, type FormEvent } from "react"

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
import { Field, FieldGroup, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import { useAuditLogsQuery } from "@/features/hooks/use-audit-logs"
import { useScheduleProposalsQuery } from "@/features/hooks/use-scheduling"
import {
  auditActions,
  auditableTypes,
  type AuditLogFilters,
} from "@/features/schemas/audit-schema"

const defaults: AuditLogFilters = { page: 1, per_page: 20 }
// Radix `Select.Item` reserves an empty-string value to mean "no selection";
// "all" is a safe sentinel since neither enum contains it (see ADR 0015).
const ALL_FILTER_VALUE = "all"
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
  const [actionFilter, setActionFilter] = useState(ALL_FILTER_VALUE)
  const [entityTypeFilter, setEntityTypeFilter] = useState(ALL_FILTER_VALUE)
  const [actorUserId, setActorUserId] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
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
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const action = auditActions.find((value) => value === actionFilter)
    const auditableType = auditableTypes.find(
      (value) => value === entityTypeFilter,
    )
    setFilters({
      action,
      auditable_type: auditableType,
      actor_user_id: actorUserId.trim()
        ? Number(actorUserId.trim())
        : undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
      page: 1,
      per_page: 20,
    })
  }
  return (
    <WorkspacePage
      title="Audit logs"
      description="Operational activity is shown without actor names or email addresses."
      unauthorized={!authorized}
      lastUpdated={auditQuery.dataUpdatedAt}
    >
      <form onSubmit={apply}>
        <FieldGroup className="grid gap-3 md:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="audit-filter-action">Action</FieldLabel>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger id="audit-filter-action" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>All actions</SelectItem>
                {auditActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="audit-filter-entity-type">
              Entity type
            </FieldLabel>
            <Select
              value={entityTypeFilter}
              onValueChange={setEntityTypeFilter}
            >
              <SelectTrigger id="audit-filter-entity-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>
                  All entity types
                </SelectItem>
                {auditableTypes.map((auditableType) => (
                  <SelectItem key={auditableType} value={auditableType}>
                    {auditableType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="audit-filter-actor">Actor user ID</FieldLabel>
            <Input
              id="audit-filter-actor"
              inputMode="numeric"
              value={actorUserId}
              onChange={(event) => setActorUserId(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="audit-filter-from">From</FieldLabel>
            <Input
              id="audit-filter-from"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="audit-filter-to">To</FieldLabel>
            <Input
              id="audit-filter-to"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </Field>
          <Button type="submit" className="self-end">
            Apply audit filters
          </Button>
        </FieldGroup>
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
                <CardTitle level={2}>Audit history</CardTitle>
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
                <CardTitle level={2}>Published proposal closure</CardTitle>
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
