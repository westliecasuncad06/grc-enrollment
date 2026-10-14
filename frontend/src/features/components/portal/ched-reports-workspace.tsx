"use client"

import { useState } from "react"
import { Download, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/features/auth/use-auth"
import { AcademicTermSelector } from "@/features/components/portal/academic-term-selector"
import { AsyncBoundary } from "@/features/components/portal/async-boundary"
import { WorkspacePage } from "@/features/components/portal/workspace-page"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/features/components/ui/alert"
import { Badge } from "@/features/components/ui/badge"
import { Button } from "@/features/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/features/components/ui/tabs"
import { useAcademicTermSelection } from "@/features/hooks/use-academic-term-selection"
import {
  useChedListQuery,
  useChedSummaryQuery,
} from "@/features/hooks/use-ched-reports"
import {
  chedReportKeySchema,
  type ChedDownloadFormat,
  type ChedNstpComponents,
  type ChedReportKey,
} from "@/features/schemas/ched-report-schema"
import type { AcademicTerm } from "@/features/schemas/reference-data-schema"
import {
  chedReportFileName,
  downloadChedReport,
} from "@/features/services/ched-report-service"

const PER_PAGE = 25

type ListReportKey = Exclude<ChedReportKey, "nstp-summary">

const REPORTS: readonly {
  key: ChedReportKey
  tab: string
  title: string
  description: string
}[] = [
  {
    key: "enrollment-list",
    tab: "Enrollment List",
    title: "CHED Enrollment List",
    description:
      "Every student officially enrolled in the term, in the CHED NCR template: program, major, name, citizenship, gender, year level, subjects with units.",
  },
  {
    key: "nstp-enrollment",
    tab: "NSTP 2-B Enrollment",
    title: "NSTP Form 2-B — Enrollment",
    description:
      "Students officially enrolled in NSTP 1 or NSTP 2 in the term (CWTS), with their birth date, address and contact details.",
  },
  {
    key: "nstp-graduates",
    tab: "NSTP 2-B Graduates",
    title: "NSTP Form 2-B — Graduates",
    description:
      "Students who passed NSTP 2 in the term (a locked, passing grade), in the same layout.",
  },
  {
    key: "nstp-summary",
    tab: "NSTP 2-A Summary",
    title: "NSTP Form 2-A — Summary",
    description:
      "Enrollment and graduates of the whole school year by semester, component and gender. Only CWTS is offered; ROTC, LTS and Summer are 0.",
  },
]

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

/** The template's own file name, and the two ways to get it. */
function DownloadButtons({
  report,
  title,
  term,
}: {
  report: ChedReportKey
  title: string
  term: AcademicTerm
}) {
  const [busy, setBusy] = useState<ChedDownloadFormat | null>(null)

  const download = async (format: ChedDownloadFormat) => {
    setBusy(format)
    try {
      await downloadChedReport({
        report,
        academicTermId: term.id,
        format,
        fileName: chedReportFileName(report, term, format),
      })
    } catch {
      toast.error(
        `The ${title} ${format === "csv" ? "CSV" : "Excel"} file could not be downloaded. Try again.`,
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={busy === "csv"}
        onClick={() => void download("csv")}
      >
        <Download className="mr-1.5 size-4" aria-hidden="true" />
        {busy === "csv" ? "Preparing…" : "Download CSV"}
      </Button>
      <Button
        type="button"
        disabled={busy === "xlsx"}
        onClick={() => void download("xlsx")}
      >
        <FileSpreadsheet className="mr-1.5 size-4" aria-hidden="true" />
        {busy === "xlsx" ? "Preparing…" : "Download Excel"}
      </Button>
    </div>
  )
}

function ReportNotices({
  missingGender,
  demoPopulated,
  total,
}: {
  missingGender: number
  demoPopulated: number
  total: number
}) {
  return (
    <>
      {missingGender > 0 && (
        <Alert>
          <AlertTitle>Gender missing</AlertTitle>
          <AlertDescription>
            {`${missingGender} listed ${plural(missingGender, "student has", "students have")} no gender on file, so their Gender cell is blank in the file.`}
          </AlertDescription>
        </Alert>
      )}
      {demoPopulated > 0 && (
        <Alert>
          <AlertTitle>Some details are generated, not real</AlertTitle>
          <AlertDescription>
            {`${demoPopulated} of the ${total} listed ${plural(total, "student carries", "students carry")} generated (demo) details such as birth date, contact number and address. Replace them with the real values before you submit this file to CHED.`}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}

function ListReportPanel({
  report,
  title,
  description,
  term,
}: {
  report: ListReportKey
  title: string
  description: string
  term: AcademicTerm
}) {
  const [page, setPage] = useState(1)
  const query = useChedListQuery(report, term.id, page, PER_PAGE, true)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <DownloadButtons report={report} title={title} term={term} />
      </CardHeader>
      <CardContent className="grid gap-4">
        <AsyncBoundary query={query} loadingLabel={`Loading the ${title}…`}>
          {(response) => {
            const { meta } = response
            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {response.report.term_label}
                  </span>
                  <Badge variant="secondary">
                    {`${meta.total} ${plural(meta.total, "student", "students")}`}
                  </Badge>
                </div>
                <ReportNotices
                  missingGender={response.report.missing_gender}
                  demoPopulated={response.report.demo_populated}
                  total={meta.total}
                />
                <Table aria-label={`${title}, page ${meta.current_page}`}>
                  <TableHeader>
                    <TableRow>
                      {response.report.columns.map((column) => (
                        <TableHead key={column.key} scope="col">
                          {column.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {response.data.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={Math.max(1, response.report.columns.length)}
                          className="py-8 text-center text-muted-foreground"
                        >
                          No students are listed for this term.
                        </TableCell>
                      </TableRow>
                    ) : (
                      response.data.map((row, index) => (
                        <TableRow key={`${meta.current_page}-${index}`}>
                          {response.report.columns.map((column) => {
                            const value = row[column.key]
                            const text =
                              value === undefined || value === ""
                                ? "—"
                                : String(value)
                            return (
                              <TableCell
                                key={column.key}
                                className={
                                  column.key === "subjects" ||
                                  column.key === "course" ||
                                  column.key === "program"
                                    ? "max-w-xs whitespace-normal"
                                    : undefined
                                }
                              >
                                {text}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {meta.last_page > 1 && (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={meta.current_page <= 1}
                      onClick={() =>
                        setPage((current) => Math.max(1, current - 1))
                      }
                    >
                      Previous
                    </Button>
                    <span className="px-2 text-xs text-muted-foreground">
                      {`Page ${meta.current_page} of ${meta.last_page}`}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={meta.current_page >= meta.last_page}
                      onClick={() => setPage((current) => current + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )
          }}
        </AsyncBoundary>
      </CardContent>
    </Card>
  )
}

const COMPONENTS = [
  ["rotc", "ROTC"],
  ["cwts", "CWTS"],
  ["lts", "LTS"],
] as const

/** The 12 male / female cells of one block (a semester or the graduates): ROTC, CWTS, LTS. */
function countCells(block: ChedNstpComponents, keyPrefix: string) {
  return COMPONENTS.flatMap(([key]) => [
    <TableCell
      key={`${keyPrefix}-${key}-m`}
      className="text-center tabular-nums"
    >
      {block[key].m}
    </TableCell>,
    <TableCell
      key={`${keyPrefix}-${key}-f`}
      className="text-center tabular-nums"
    >
      {block[key].f}
    </TableCell>,
  ])
}

function SummaryPanel({
  title,
  description,
  term,
}: {
  title: string
  description: string
  term: AcademicTerm
}) {
  const query = useChedSummaryQuery(term.id, true)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <DownloadButtons report="nstp-summary" title={title} term={term} />
      </CardHeader>
      <CardContent className="grid gap-4">
        <AsyncBoundary query={query} loadingLabel={`Loading the ${title}…`}>
          {({ data }) => {
            const blocks = [
              data.enrollment["1st"],
              data.enrollment["2nd"],
              data.enrollment.summer,
              data.graduates,
            ]
            return (
              <>
                <p className="text-sm font-medium">
                  {`Academic Year ${data.academic_year} · Region: National Capital Region`}
                </p>
                {data.missing_gender > 0 && (
                  <Alert>
                    <AlertTitle>Gender missing</AlertTitle>
                    <AlertDescription>
                      {`${data.missing_gender} ${plural(data.missing_gender, "student has", "students have")} no gender on file and ${plural(data.missing_gender, "is", "are")} counted in neither the M nor the F column.`}
                    </AlertDescription>
                  </Alert>
                )}
                <Table aria-label="NSTP Form 2-A summary of enrollment and graduates, by semester, component and gender">
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={4} scope="col">
                        Name of HEI/Campus
                      </TableHead>
                      <TableHead rowSpan={4} scope="col">
                        Classification (Private/Public)
                      </TableHead>
                      <TableHead
                        colSpan={18}
                        scope="colgroup"
                        className="text-center"
                      >
                        Enrollment
                      </TableHead>
                      <TableHead
                        colSpan={6}
                        rowSpan={2}
                        scope="colgroup"
                        className="text-center"
                      >
                        Graduates
                      </TableHead>
                    </TableRow>
                    <TableRow>
                      {["1st Sem", "2nd Sem", "Summer"].map((label) => (
                        <TableHead
                          key={label}
                          colSpan={6}
                          scope="colgroup"
                          className="text-center"
                        >
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                    <TableRow>
                      {blocks.flatMap((_, blockIndex) =>
                        COMPONENTS.map(([key, label]) => (
                          <TableHead
                            key={`${blockIndex}-${key}`}
                            colSpan={2}
                            scope="colgroup"
                            className="text-center"
                          >
                            {label}
                          </TableHead>
                        )),
                      )}
                    </TableRow>
                    <TableRow>
                      {blocks.flatMap((_, blockIndex) =>
                        COMPONENTS.flatMap(([key]) => [
                          <TableHead
                            key={`${blockIndex}-${key}-m`}
                            scope="col"
                            className="text-center"
                          >
                            M
                          </TableHead>,
                          <TableHead
                            key={`${blockIndex}-${key}-f`}
                            scope="col"
                            className="text-center"
                          >
                            F
                          </TableHead>,
                        ]),
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        {data.campus}
                      </TableCell>
                      <TableCell>{data.classification}</TableCell>
                      {blocks.flatMap((block, index) =>
                        countCells(block, `school-${index}`),
                      )}
                    </TableRow>
                    <TableRow className="font-semibold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell>1</TableCell>
                      {blocks.flatMap((block, index) =>
                        countCells(block, `total-${index}`),
                      )}
                    </TableRow>
                  </TableBody>
                </Table>
              </>
            )
          }}
        </AsyncBoundary>
      </CardContent>
    </Card>
  )
}

/**
 * The Registrar Head's CHED reports (ADR 0049): the CHED Enrollment List and NSTP Forms 2-B and 2-A
 * for a term, each previewed on screen and downloaded as CSV or as CHED's own template filled in.
 */
export function ChedReportsWorkspace() {
  const { session } = useAuth()
  const authorized = session?.role === "registrar_head"
  const { term, sortedTerms, isCurrentTerm, setSelectedTermId, termsQuery } =
    useAcademicTermSelection()
  const [active, setActive] = useState<ChedReportKey>("enrollment-list")

  return (
    <WorkspacePage
      title="CHED Reports"
      description="Preview the CHED Enrollment List and the NSTP forms for a term, and download each as CSV or as CHED's own Excel template, ready to submit."
      unauthorized={!authorized}
    >
      <div className="grid gap-5">
        <AcademicTermSelector
          sortedTerms={sortedTerms}
          term={term}
          isCurrentTerm={isCurrentTerm}
          onSelectTerm={setSelectedTermId}
          isLoading={termsQuery.isPending}
          readOnly
        />

        <Tabs
          value={active}
          onValueChange={(value) => {
            const parsed = chedReportKeySchema.safeParse(value)
            if (parsed.success) setActive(parsed.data)
          }}
        >
          <TabsList aria-label="CHED report">
            {REPORTS.map((report) => (
              <TabsTrigger key={report.key} value={report.key}>
                {report.tab}
              </TabsTrigger>
            ))}
          </TabsList>
          {REPORTS.map((report) => (
            <TabsContent key={report.key} value={report.key}>
              {term === null ? (
                <p className="text-sm text-muted-foreground">
                  Choose a school year and semester to see this report.
                </p>
              ) : report.key === "nstp-summary" ? (
                <SummaryPanel
                  key={term.id}
                  title={report.title}
                  description={report.description}
                  term={term}
                />
              ) : (
                <ListReportPanel
                  key={`${report.key}-${term.id}`}
                  report={report.key}
                  title={report.title}
                  description={report.description}
                  term={term}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </WorkspacePage>
  )
}
