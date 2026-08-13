"use client"

import { motion, useReducedMotion } from "motion/react"
import { BrainCircuit, ChartSpline, Gauge, UsersRound } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { GroupedWarningsList } from "@/features/components/portal/grouped-warnings-list"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/features/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import type { ScheduleGenerationRun } from "@/features/schemas/schedule-generation-schema"

export function DemandForecastDialog({
  open,
  onOpenChange,
  run,
  loading = false,
  error = false,
  onRetry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  run: ScheduleGenerationRun | null
  loading?: boolean
  error?: boolean
  onRetry?: () => void
}) {
  const reducedMotion = useReducedMotion()
  const facultyLoad = run?.faculty_load
  const forecasts = run?.forecasts ?? []
  const blockRecommendations = run?.section_block_recommendations ?? []
  const running = run?.status === "queued" || run?.status === "running"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92dvh] max-w-5xl overflow-y-auto p-0 sm:max-w-5xl"
        showCloseButton={false}
      >
        <motion.div
          layoutId="demand-forecast-surface"
          initial={reducedMotion ? false : { opacity: 0, scale: 0.86, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={
            reducedMotion ? undefined : { opacity: 0, scale: 0.28, y: -120 }
          }
          transition={{ duration: 0.32, ease: [0.2, 0.75, 0.2, 1] }}
          className="grid gap-5 p-5 sm:p-7"
        >
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="grid gap-2">
                <div className="flex items-center gap-2 text-primary">
                  <BrainCircuit className="size-4" aria-hidden="true" />
                  <span className="text-xs font-semibold tracking-[0.16em] uppercase">
                    Predictive planning
                  </span>
                </div>
                <DialogTitle>Demand Forecast</DialogTitle>
                <DialogDescription>
                  Forecasts are advisory. The Program Chair can review and edit
                  every section, faculty, and room recommendation.
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href="/portal/program-chair-analytics">
                    <ChartSpline data-icon="inline-start" aria-hidden="true" />
                    View in Analytics
                  </Link>
                </Button>
                <Badge
                  variant={
                    run?.status === "failed" ? "destructive" : "secondary"
                  }
                >
                  {loading
                    ? "Loading"
                    : running
                      ? "Generating"
                      : (run?.status ?? "No run")}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          {running && (
            <p className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
              Building the demand forecast, faculty-loading recommendation, and
              editable draft…
            </p>
          )}
          {loading && run === null && (
            <p className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
              Loading the latest forecast…
            </p>
          )}
          {error && run === null && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <span>The latest forecast could not be loaded.</span>
              {onRetry && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                >
                  Retry
                </Button>
              )}
            </div>
          )}
          {run?.status === "failed" && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {run.error_summary ?? "The forecast could not be generated."}
            </p>
          )}
          {run?.warnings.length ? (
            <GroupedWarningsList warnings={run.warnings} />
          ) : null}

          {run?.model && (
            <div className="grid gap-3 sm:grid-cols-3">
              <ForecastStat
                icon={<BrainCircuit />}
                label="Model strategy"
                value={
                  run.model.strategy === "random_forest"
                    ? "Random Forest"
                    : run.model.strategy === "historical_baseline"
                      ? "Historical baseline"
                      : "Waiting"
                }
                detail={run.model.model_version ?? ""}
              />
              <ForecastStat
                icon={<Gauge />}
                label="Historical observations"
                value={String(run.model.training_observation_count)}
                detail={
                  run.model.strategy === "historical_baseline"
                    ? "Sparse data fallback"
                    : "Training input"
                }
              />
              <ForecastStat
                icon={<UsersRound />}
                label="Faculty loads"
                value={
                  facultyLoad?.equivalent_faculty_loads === null ||
                  facultyLoad?.equivalent_faculty_loads === undefined
                    ? "Set threshold"
                    : String(facultyLoad.equivalent_faculty_loads)
                }
                detail={
                  facultyLoad
                    ? `${facultyLoad.required_teaching_units} teaching units`
                    : "Loading"
                }
              />
            </div>
          )}

          <section className="grid gap-3" aria-label="Section demand forecasts">
            <div>
              <h3 className="font-heading text-lg">
                Section Demand Forecasting
              </h3>
              <p className="text-sm text-muted-foreground">
                Recommended sections are calculated from predicted subject
                demand and planned capacity.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Predicted students</TableHead>
                    <TableHead>Sections needed</TableHead>
                    <TableHead>Historical basis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecasts.length ? (
                    forecasts.map((forecast) => (
                      <TableRow
                        key={`${forecast.subject_id}-${forecast.year_level}`}
                      >
                        <TableCell>
                          <p className="font-medium">{forecast.subject_code}</p>
                          <p className="text-xs text-muted-foreground">
                            {forecast.subject_title}
                          </p>
                        </TableCell>
                        <TableCell>{forecast.year_level ?? "—"}</TableCell>
                        <TableCell>
                          {forecast.predicted_demand.toFixed(0)}
                          {forecast.confidence_lower !== null &&
                          forecast.confidence_upper !== null ? (
                            <p className="text-xs text-muted-foreground">
                              {forecast.confidence_lower.toFixed(0)}–
                              {forecast.confidence_upper.toFixed(0)} range
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {forecast.suggested_section_count}
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Demand ÷ capacity
                          </p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {forecast.historical_basis.school_year
                            ? `${forecast.historical_basis.school_year} · ${forecast.historical_basis.semester} · Year ${forecast.historical_basis.year_level}`
                            : "No usable history"}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-9 text-center text-muted-foreground"
                      >
                        {loading
                          ? "Loading the latest forecast…"
                          : running
                            ? "Forecasting demand…"
                            : "No forecast rows are available yet."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>

          <section
            className="grid gap-3"
            aria-label="Recommended block sections"
          >
            <div>
              <h3 className="font-heading text-lg">
                Recommended block sections
              </h3>
              <p className="text-sm text-muted-foreground">
                These program and year-level block counts are editable in the
                schedule workspace.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {blockRecommendations.length ? (
                blockRecommendations.map((recommendation) => (
                  <div
                    key={`${recommendation.program_code}-${recommendation.year_level}`}
                    className="rounded-lg border bg-muted/20 p-3"
                  >
                    <p className="font-medium">
                      {recommendation.program_code} · Year{" "}
                      {recommendation.year_level}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {recommendation.recommended_block_sections} blocks ·{" "}
                      {recommendation.students_per_block} seats each
                    </p>
                    {recommendation.is_overridden && (
                      <Badge className="mt-2" variant="outline">
                        Chair override
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Generate a forecast to see recommended blocks by program and
                  year level.
                </p>
              )}
            </div>
          </section>

          {facultyLoad && (
            <section
              className="grid gap-3"
              aria-label="Faculty loading support"
            >
              <div>
                <h3 className="font-heading text-lg">
                  Faculty Loading Support
                </h3>
                <p className="text-sm text-muted-foreground">
                  {facultyLoad.threshold_units === null
                    ? "Set a college-term threshold in Schedule & Faculty Loading to enable overload flags."
                    : `Threshold: ${facultyLoad.threshold_units} units per professor.`}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <ForecastStat
                  icon={<UsersRound />}
                  label="Teaching assignments"
                  value={String(facultyLoad.required_assignments)}
                  detail="Section-subject rows"
                />
                <ForecastStat
                  icon={<Gauge />}
                  label="Total units"
                  value={String(facultyLoad.required_teaching_units)}
                  detail="Predicted teaching load"
                />
                <ForecastStat
                  icon={<UsersRound />}
                  label="Unassigned"
                  value={String(facultyLoad.unassigned_count)}
                  detail="Needs Chair decision"
                />
                <ForecastStat
                  icon={<Gauge />}
                  label="Overload flags"
                  value={
                    facultyLoad.threshold_units === null
                      ? "—"
                      : String(facultyLoad.overloaded_count)
                  }
                  detail={
                    facultyLoad.threshold_units === null
                      ? "Threshold not set"
                      : "Above threshold"
                  }
                />
              </div>
            </section>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close forecast
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}

function ForecastStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="grid gap-1 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        <span className="size-4">{icon}</span>
        <span className="text-xs font-semibold tracking-wide uppercase">
          {label}
        </span>
      </div>
      <strong className="font-heading text-2xl">{value}</strong>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  )
}
