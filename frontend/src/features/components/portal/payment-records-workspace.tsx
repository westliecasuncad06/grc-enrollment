"use client"

import { useState } from "react"

import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { DataTable } from "@/features/components/portal/data-table"
import { Paginator } from "@/features/components/portal/paginator"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Card, CardContent, CardHeader, CardTitle } from "@/features/components/ui/card"
import { Field, FieldLabel } from "@/features/components/ui/field"
import { Input } from "@/features/components/ui/input"
import { usePaymentsQuery } from "@/features/hooks/use-payments"

/**
 * Accounting Staff's own payment history, plus Registrar Head oversight —
 * the counterpart to the guided Payment Queue, for looking back at what
 * was already confirmed rather than working the current line.
 */
export function PaymentRecordsWorkspace() {
  const { session } = useAuth()
  const authorized =
    session?.role === "accounting_staff" || session?.role === "registrar_head"
  const [page, setPage] = useState(1)
  const [confirmedOn, setConfirmedOn] = useState("")

  const paymentsQuery = usePaymentsQuery(
    {
      confirmed_on: confirmedOn || undefined,
      page,
      per_page: 20,
    },
    { enabled: authorized },
  )

  return (
    <WorkspacePage
      title="Payment records"
      description="Look back at every payment you and Registrar Head have confirmed."
      unauthorized={!authorized}
      lastUpdated={paymentsQuery.dataUpdatedAt}
    >
      <Card>
        <CardHeader>
          <CardTitle level={2}>Filter by date</CardTitle>
        </CardHeader>
        <CardContent>
          <Field className="max-w-xs">
            <FieldLabel htmlFor="confirmed-on">Confirmed on</FieldLabel>
            <Input
              id="confirmed-on"
              type="date"
              value={confirmedOn}
              onChange={(event) => {
                setConfirmedOn(event.target.value)
                setPage(1)
              }}
            />
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle level={2}>Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          <AsyncBoundary
            query={{ ...paymentsQuery, data: paymentsQuery.data?.data }}
            isEmpty={(rows) => rows.length === 0}
            emptyMessage="No payments match this filter."
            loadingLabel="Loading payment history…"
          >
            {(payments) => (
              <DataTable
                caption="Payment history"
                rowKey={(payment) => payment.id}
                rows={payments}
                columns={[
                  {
                    key: "student",
                    header: "Student",
                    render: (payment) => payment.student_number,
                  },
                  {
                    key: "enrollment",
                    header: "Enrollment",
                    render: (payment) => `#${payment.enrollment_id}`,
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    render: (payment) =>
                      payment.amount ? `₱${payment.amount}` : "—",
                  },
                  {
                    key: "confirmed_at",
                    header: "Confirmed at",
                    render: (payment) =>
                      new Date(payment.confirmed_at).toLocaleString(),
                  },
                ]}
              />
            )}
          </AsyncBoundary>
          <div className="mt-4">
            <Paginator
              currentPage={paymentsQuery.data?.meta.current_page ?? 1}
              lastPage={paymentsQuery.data?.meta.last_page ?? 1}
              onPageChange={setPage}
            />
          </div>
        </CardContent>
      </Card>
    </WorkspacePage>
  )
}
