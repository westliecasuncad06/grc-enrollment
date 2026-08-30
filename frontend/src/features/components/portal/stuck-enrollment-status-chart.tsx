"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"

export interface StuckEnrollmentStatusRow {
  status_label: string
  is_flagged: boolean
}

const ON_TIME_FILL = "var(--muted-foreground)"
const FLAGGED_FILL = "var(--destructive)"

function aggregateByStatus(rows: StuckEnrollmentStatusRow[]) {
  const byStatus = new Map<
    string,
    { status_label: string; onTime: number; flagged: number }
  >()
  for (const row of rows) {
    const entry = byStatus.get(row.status_label) ?? {
      status_label: row.status_label,
      onTime: 0,
      flagged: 0,
    }
    if (row.is_flagged) entry.flagged += 1
    else entry.onTime += 1
    byStatus.set(row.status_label, entry)
  }

  return [...byStatus.values()].sort(
    (left, right) =>
      right.onTime + right.flagged - (left.onTime + left.flagged),
  )
}

/**
 * Status (on time vs past threshold), not series identity, so it wears the
 * app's reserved status tokens rather than the categorical dataviz ramp —
 * the same tokens the Stuck Students table already badges "Past threshold"
 * with, so a row reads the same way in both places.
 */
export function StuckEnrollmentStatusChart({
  rows,
  thresholdConfigured,
}: {
  rows: StuckEnrollmentStatusRow[]
  thresholdConfigured: boolean
}) {
  const data = aggregateByStatus(rows)
  const flaggedTotal = rows.filter((row) => row.is_flagged).length

  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>In-progress enrollments by step</CardTitle>
        <CardDescription>
          {thresholdConfigured
            ? `Where enrollments currently sit, and how many have sat there past the configured threshold. ${flaggedTotal} of ${rows.length} in progress right now.`
            : `Where enrollments currently sit. No institutional threshold is configured yet, so "past threshold" stays at zero for every step.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No enrollments are currently in progress toward enrolled for this
            term.
          </p>
        ) : (
          <div style={{ height: Math.max(160, data.length * 64) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                barCategoryGap="30%"
              >
                <CartesianGrid
                  stroke="var(--dataviz-grid)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  stroke="var(--dataviz-axis)"
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="status_label"
                  width={150}
                  stroke="var(--dataviz-axis)"
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                  labelStyle={{ color: "var(--card-foreground)" }}
                  itemStyle={{ color: "var(--card-foreground)" }}
                />
                <Legend
                  iconType="square"
                  wrapperStyle={{ color: "var(--muted-foreground)" }}
                />
                <Bar
                  dataKey="onTime"
                  name="On time"
                  stackId="status"
                  fill={ON_TIME_FILL}
                  barSize={24}
                />
                <Bar
                  dataKey="flagged"
                  name="Past threshold"
                  stackId="status"
                  fill={FLAGGED_FILL}
                  barSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
