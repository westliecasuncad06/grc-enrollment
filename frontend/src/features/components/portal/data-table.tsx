"use client"

import type { ReactNode } from "react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/features/components/ui/card"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/features/components/ui/table"

export interface DataTableColumn<Row> {
  key: string
  header: string
  render: (row: Row) => ReactNode
  cellClassName?: string
}

export interface DataTableProps<Row> {
  /** Screen-reader-only by default (sr-only) — the table normally sits under a heading that already names it visually. */
  caption: string
  columns: DataTableColumn<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string | number
  /** Overrides the auto-generated card for narrow viewports; falls back to a column-label/value list built from `columns`. */
  renderCard?: (row: Row) => ReactNode
}

/**
 * A `<table>` with `<caption>` and `<th scope="col">` — neither existed
 * anywhere in the 13 tables audited across the portal — plus the card
 * fallback for narrow viewports that only 2 of those 13 tables had.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  renderCard,
}: DataTableProps<Row>) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} scope="col">
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.cellClassName}>
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 md:hidden">
        {rows.map((row) =>
          renderCard ? (
            <div key={rowKey(row)}>{renderCard(row)}</div>
          ) : (
            <Card key={rowKey(row)}>
              <CardHeader>
                <CardTitle level={4}>{String(rowKey(row))}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {columns.map((column) => (
                    <div key={column.key} className="contents">
                      <dt className="text-muted-foreground">{column.header}</dt>
                      <dd>{column.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ),
        )}
      </div>
    </>
  )
}
