"use client"

import { Alert, AlertDescription } from "@/features/components/ui/alert"
import { useAuth } from "@/features/auth/use-auth"
import { Badge } from "@/features/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import { Skeleton } from "@/features/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"
import {
  useAcademicTermsQuery,
  useSectionsQuery,
  useSubjectsQuery,
} from "@/features/hooks/use-reference-data"
import { getFacultyTeachingSchedule } from "@/features/services/faculty-service"

export function TeachingScheduleWorkspace() {
  const { session } = useAuth()
  const termsQuery = useAcademicTermsQuery()
  const subjectsQuery = useSubjectsQuery()
  const sectionsQuery = useSectionsQuery()
  const facultyId = Number(session?.userId)
  const assignedSections =
    Number.isSafeInteger(facultyId) && facultyId > 0
      ? (sectionsQuery.data ?? []).filter(
          (section) => section.professor_id === facultyId,
        )
      : []
  const rows = getFacultyTeachingSchedule(
    assignedSections,
    subjectsQuery.data ?? [],
    termsQuery.data ?? [],
  )
  const isLoading =
    termsQuery.isLoading || subjectsQuery.isLoading || sectionsQuery.isLoading
  const hasError =
    termsQuery.isError || subjectsQuery.isError || sectionsQuery.isError

  return (
    <section aria-label="Teaching schedule workspace" className="grid gap-4">
      <div>
        <h2>Teaching schedule</h2>
        <p>This schedule contains sections assigned to your faculty account.</p>
      </div>
      {hasError && (
        <Alert variant="destructive">
          <AlertDescription>
            Your teaching schedule could not be loaded. Refresh the page and try
            again.
          </AlertDescription>
        </Alert>
      )}
      {isLoading ? (
        <Skeleton className="h-48" />
      ) : rows.length === 0 ? (
        <p>No teaching schedule is available for your account.</p>
      ) : (
        <>
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.sectionId}>
                    <TableCell>
                      {row.subjectCode} · {row.subjectTitle}
                    </TableCell>
                    <TableCell>{row.termLabel}</TableCell>
                    <TableCell>{row.days}</TableCell>
                    <TableCell>{row.time}</TableCell>
                    <TableCell>{row.room}</TableCell>
                    <TableCell>
                      <Badge>{row.statusLabel}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <Card
                key={row.sectionId}
                role="article"
                aria-label={`${row.subjectCode} ${row.subjectTitle}`}
              >
                <CardHeader>
                  <CardTitle>
                    {row.subjectCode} · {row.subjectTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt>Term</dt>
                    <dd>{row.termLabel}</dd>
                    <dt>Days</dt>
                    <dd>{row.days}</dd>
                    <dt>Time</dt>
                    <dd>{row.time}</dd>
                    <dt>Room</dt>
                    <dd>{row.room}</dd>
                  </dl>
                  <Badge className="mt-3">{row.statusLabel}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
