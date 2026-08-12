"use client"

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

// Fixed hue order, never cycled per-render — this is the dataviz skill's
// validated categorical sequence (references/palette.md), CVD-safe for
// adjacent line-series comparison in both light and dark. `.dark` swaps the
// underlying custom property in globals.css, so no JS-side theme branching is
// needed here.
const SERIES_COLORS = [
  "var(--dataviz-series-1)",
  "var(--dataviz-series-2)",
  "var(--dataviz-series-3)",
  "var(--dataviz-series-4)",
  "var(--dataviz-series-5)",
  "var(--dataviz-series-6)",
  "var(--dataviz-series-7)",
  "var(--dataviz-series-8)",
]

export interface EnrollmentYearOverYearPoint {
  school_year: string
  semester: string
  enrollee_count: number
}

interface PivotedRow {
  semester: string
  [schoolYear: string]: string | number
}

function pivotYearOverYearPoints(points: EnrollmentYearOverYearPoint[]): {
  rows: PivotedRow[]
  schoolYears: string[]
} {
  const semesters: string[] = []
  const schoolYears: string[] = []

  for (const point of points) {
    if (!semesters.includes(point.semester)) semesters.push(point.semester)
    if (!schoolYears.includes(point.school_year)) {
      schoolYears.push(point.school_year)
    }
  }

  const rows = semesters.map((semester) => {
    const row: PivotedRow = { semester }
    for (const point of points) {
      if (point.semester === semester) {
        row[point.school_year] = point.enrollee_count
      }
    }
    return row
  })

  return { rows, schoolYears }
}

// Term(semester)-level, not weekly/monthly: the seeded enrollment timestamps
// carry no real per-week/month signal (see task brief), so this chart is
// honest about the real achievable resolution — one row per semester, one
// line per school year — rather than promising a spike chart the data can't
// back up.
export function EnrollmentYearOverYearChart({
  points,
}: {
  points: EnrollmentYearOverYearPoint[]
}) {
  const { rows, schoolYears } = pivotYearOverYearPoints(points)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrollment Year-over-Year</CardTitle>
        <CardDescription>
          Enrollee counts by semester, one line per school year.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No year-over-year enrollment data is available yet.
          </p>
        ) : (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rows}
                margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke="var(--dataviz-grid)" vertical={false} />
                <XAxis
                  dataKey="semester"
                  stroke="var(--dataviz-axis)"
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  allowDecimals={false}
                  stroke="var(--dataviz-axis)"
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)" }}
                />
                <Tooltip
                  cursor={{ stroke: "var(--dataviz-axis)", strokeWidth: 1 }}
                  contentStyle={{
                    background: "var(--card)",
                    borderColor: "var(--border)",
                    borderRadius: "var(--radius)",
                  }}
                  labelStyle={{ color: "var(--card-foreground)" }}
                  itemStyle={{ color: "var(--card-foreground)" }}
                />
                {schoolYears.length > 1 && <Legend iconType="line" />}
                {schoolYears.map((schoolYear, index) => (
                  <Line
                    key={schoolYear}
                    type="monotone"
                    dataKey={schoolYear}
                    name={schoolYear}
                    stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
