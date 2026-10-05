"use client"

import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { Paginator } from "@/features/components/portal/paginator"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Input } from "@/features/components/ui/input"
import { useDebouncedValue } from "@/features/hooks/use-debounced-value"
import { useFreshmanEnrolleesQuery } from "@/features/hooks/use-freshman"
import { formatYearLevel } from "@/features/lib/format-year-level"
import type {
  FreshmanEnrollee,
  FreshmanEnrolleeFilters,
} from "@/features/schemas/freshman-schema"

type StatusFilter = NonNullable<FreshmanEnrolleeFilters["status"]> | "all"

const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All freshmen" },
  { value: "enrolled", label: "Enrolled" },
  { value: "awaiting_section", label: "Awaiting a section" },
  { value: "enrolling", label: "Awaiting approval" },
  { value: "awaiting_payment", label: "Awaiting payment" },
]

function formatPhp(amount: string): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(amount))
}

function StatusBadge({ enrollee }: { enrollee: FreshmanEnrollee }) {
  const variant =
    enrollee.status === "enrolled"
      ? ("success" as const)
      : enrollee.status === "awaiting_section" ||
          enrollee.status === "enrolling"
        ? ("warning" as const)
        : ("outline" as const)

  return <Badge variant={variant}>{enrollee.status_label}</Badge>
}

/**
 * Registrar Staff and the Registrar Head: a read-only list of the freshmen who enrolled by paying
 * first (ADR 0043). It replaces the Registrar's approval step for freshmen, so this is where they
 * see who was enrolled, in which section, and who is still waiting for a section to open.
 */
export function RegistrarFreshmanEnrolleesWorkspace() {
  const { session } = useAuth()
  const authorized =
    session?.role === "registrar_staff" || session?.role === "registrar_head"
  const [status, setStatus] = useState<StatusFilter>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebouncedValue(search, 300)

  const query = useFreshmanEnrolleesQuery({
    ...(status === "all" ? {} : { status }),
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
    page,
    per_page: 20,
  })

  return (
    <WorkspacePage
      title="Freshmen enrollees"
      description="Freshmen who paid the Cashier first and were enrolled automatically, including those still waiting for a section to open. This list is for viewing only."
      unauthorized={!authorized}
      lastUpdated={query.dataUpdatedAt}
    >
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle level={2}>Freshmen</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                type="button"
                size="sm"
                variant={status === filter.value ? "default" : "outline"}
                aria-pressed={status === filter.value}
                onClick={() => {
                  setStatus(filter.value)
                  setPage(1)
                }}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 w-full max-w-sm">
            <Input
              type="search"
              placeholder="Search by student number or name…"
              aria-label="Search freshmen"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>
          <AsyncBoundary
            query={{ ...query, data: query.data?.data }}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="No freshmen match this list."
            loadingLabel="Loading the freshmen…"
          >
            {(rows) => (
              <DataTable
                caption="Freshmen enrollees"
                rowKey={(enrollee) => enrollee.id}
                rows={rows}
                columns={[
                  {
                    key: "student",
                    header: "Student",
                    render: (enrollee) => (
                      <div>
                        <div className="font-medium">{enrollee.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {enrollee.student_number}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "program",
                    header: "Program",
                    render: (enrollee) =>
                      `${enrollee.program_code} · ${formatYearLevel(enrollee.year_level)}`,
                  },
                  {
                    key: "section",
                    header: "Section",
                    render: (enrollee) => enrollee.block_code ?? "—",
                  },
                  {
                    key: "status",
                    header: "Status",
                    render: (enrollee) => <StatusBadge enrollee={enrollee} />,
                  },
                  {
                    key: "paid",
                    header: "Paid",
                    render: (enrollee) =>
                      enrollee.amount_paid
                        ? formatPhp(enrollee.amount_paid)
                        : "—",
                  },
                  {
                    key: "ticket",
                    header: "Queue no.",
                    render: (enrollee) => enrollee.ticket_number ?? "—",
                  },
                ]}
              />
            )}
          </AsyncBoundary>
          <div className="mt-4">
            <Paginator
              currentPage={query.data?.meta.current_page ?? 1}
              lastPage={query.data?.meta.last_page ?? 1}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>
    </WorkspacePage>
  )
}
