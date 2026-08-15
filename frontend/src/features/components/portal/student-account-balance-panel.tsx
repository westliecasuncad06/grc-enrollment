import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import type { StudentAccount } from "@/features/schemas/student-account-schema"

function formatPhp(amount: string): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number(amount))
}

/**
 * Read-only account detail for the authenticated Student. Cashier controls
 * deliberately stay in AccountingPaymentWorkspace so this panel cannot
 * confirm an enrollment or record a payment.
 */
export function StudentAccountBalancePanel({
  account,
}: {
  account: StudentAccount
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Account balance</CardTitle>
        <CardDescription>
          Your remaining balance across active academic terms.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Total outstanding</dt>
            <dd className="text-xl font-semibold">
              {formatPhp(account.outstanding_balance)}
            </dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">Prior balance</dt>
            <dd className="text-xl font-semibold">
              {formatPhp(account.prior_balance)}
            </dd>
          </div>
        </dl>
        {account.has_promissory_note_on_file && (
          <Badge variant="outline" className="w-fit">
            Promissory note on file
          </Badge>
        )}
        {account.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no outstanding active balance.
          </p>
        ) : (
          <ul className="grid gap-2" aria-label="Outstanding balances by term">
            {account.entries.map((entry) => (
              <li
                key={entry.enrollment_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span className="font-medium">{entry.academic_term_label}</span>
                <span>{formatPhp(entry.outstanding_balance)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
