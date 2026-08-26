"use client"

import { useMemo, useState } from "react"
import { useAuth } from "@/features/auth/use-auth"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/features/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import { useAttritionReportQuery } from "@/features/hooks/use-attrition-honors"
import {
  useAcademicTermsQuery,
  useProgramsQuery,
} from "@/features/hooks/use-reference-data"

const colleges = [
  ["ccs", "College of Computer Studies"],
  ["coe", "College of Education"],
  ["coa", "College of Accountancy"],
  ["cbae", "College of Business Administration and Entrepreneurship"],
] as const

export function AttritionAnalyticsWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "registrar_head"
  const terms = useAcademicTermsQuery({ enabled: authorized })
  const programs = useProgramsQuery({ enabled: authorized })
  const pair = useMemo(() => {
    const second = terms.data?.find(
      (term) => term.semester.toLowerCase() === "2nd semester",
    )
    return {
      baseline: terms.data?.find(
        (term) =>
          term.school_year === second?.school_year &&
          term.semester.toLowerCase() === "1st semester",
      )?.id,
      comparison: second?.id,
    }
  }, [terms.data])
  const [college, setCollege] = useState<string>()
  const [programId, setProgramId] = useState<number>()
  const [yearLevel, setYearLevel] = useState<number>()
  const report = useAttritionReportQuery({
    baselineAcademicTermId: pair.baseline,
    comparisonAcademicTermId: pair.comparison,
    college,
    programId,
    yearLevel,
  })
  return (
    <WorkspacePage
      title="Attrition analytics"
      description="Official enrollment retention from the first to second semester. Results are anonymous cohort aggregates."
      unauthorized={!authorized}
      lastUpdated={report.dataUpdatedAt}
    >
      <div className="flex flex-wrap gap-2">
        <Select onValueChange={(v) => setCollege(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All colleges" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All colleges</SelectItem>
            {colleges.map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(v) =>
            setProgramId(v === "all" ? undefined : Number(v))
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All programs" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {programs.data?.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(v) =>
            setYearLevel(v === "all" ? undefined : Number(v))
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {[1, 2, 3, 4].map((y) => (
              <SelectItem key={y} value={String(y)}>
                Year {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => void report.refetch()}>
          Refresh
        </Button>
      </div>
      <AsyncBoundary
        query={report}
        isEmpty={(data) => data.summary.baseline_count === 0}
        emptyMessage="No officially enrolled students match this term pair and filter."
        loadingLabel="Loading attrition analytics…"
      >
        {(data) => (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Baseline", data.summary.baseline_count],
                ["Retained", data.summary.retained_count],
                ["Did not enroll", data.summary.attrited_count],
                ["Attrition", `${data.summary.attrition_rate}%`],
              ].map(([label, value]) => (
                <Card key={String(label)}>
                  <CardHeader>
                    <CardTitle level={2}>{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums">
                      {value}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <CardTitle level={2}>Program cohorts</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Program</TableHead>
                      <TableHead>Baseline</TableHead>
                      <TableHead>Retained</TableHead>
                      <TableHead>Did not enroll</TableHead>
                      <TableHead>Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.groups.programs.map((row) => (
                      <TableRow key={row.program_id}>
                        <TableCell>
                          {row.program_code} · {row.program_name}
                        </TableCell>
                        <TableCell>{row.baseline_count}</TableCell>
                        <TableCell>{row.retained_count}</TableCell>
                        <TableCell>{row.attrited_count}</TableCell>
                        <TableCell>{row.attrition_rate}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </AsyncBoundary>
    </WorkspacePage>
  )
}
