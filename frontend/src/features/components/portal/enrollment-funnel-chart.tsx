"use client"

import {
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"

export interface EnrollmentFunnelStage {
  key: string
  label: string
  count: number
}

// Ordinal ramp (stage position, not series identity) — see globals.css for
// the validated light/dark hex steps this points at.
const STAGE_FILLS = [
  "var(--dataviz-funnel-1)",
  "var(--dataviz-funnel-2)",
  "var(--dataviz-funnel-3)",
  "var(--dataviz-funnel-4)",
]

/**
 * A true funnel shape reads "step 1 through the end" more directly than bars:
 * width at each stage is the count that reached it, so drop-off between
 * stages is visible as the narrowing itself, not just a number to compare.
 */
export function EnrollmentFunnelChart({
  stages,
}: {
  stages: EnrollmentFunnelStage[]
}) {
  const baseline = stages[0]?.count ?? 0
  const rows = stages.map((stage, index) => ({
    ...stage,
    fill: STAGE_FILLS[index % STAGE_FILLS.length],
    conversionLabel:
      baseline === 0
        ? `${stage.label}: 0`
        : `${stage.label}: ${stage.count} (${Math.round((stage.count / baseline) * 100)}%)`,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle level={2}>Enrollment funnel</CardTitle>
        <CardDescription>
          How many submitted enrollments have reached each stage, in order.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {baseline === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No submitted enrollments yet this term.
          </p>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart margin={{ top: 8, right: 90, bottom: 8, left: 8 }}>
                <Tooltip
                  cursor={false}
                  contentStyle={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                  labelStyle={{ color: "var(--card-foreground)" }}
                  itemStyle={{ color: "var(--card-foreground)" }}
                  formatter={(value) => [value, "Enrollments"]}
                />
                <Funnel
                  dataKey="count"
                  nameKey="label"
                  data={rows}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="conversionLabel"
                    position="right"
                    fill="var(--card-foreground)"
                    stroke="none"
                    fontSize={12}
                  />
                  {rows.map((row) => (
                    <Cell key={row.key} fill={row.fill} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
