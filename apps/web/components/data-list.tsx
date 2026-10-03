import Link from "next/link"
import type { Key, ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export interface Column<T> {
  header: string
  cell: (item: T) => ReactNode
  // primary is the record's title: the header of its row in the table, the
  // top of its card on phones, and the record's link.
  primary?: boolean
  // actions are what can be done with the record. The table names their
  // column for screen readers only; a card shows them at its top, beside the
  // title, with no name.
  actions?: boolean
}

// present tells a value from one that is not there (null, false, "").
const present = (value: ReactNode) => value !== null && value !== undefined && value !== false && value !== ""

// DataList shows records as a table on wide screens and as cards on phones,
// where every other value is labeled with its column's name; a value that is
// not there leaves its row out of the card.
export function DataList<T>({
  label,
  items,
  columns,
  getKey,
  href,
}: {
  label: string
  items: T[]
  columns: Column<T>[]
  getKey: (item: T) => Key
  href?: (item: T) => string
}) {
  const title = (column: Column<T>, item: T) =>
    column.primary && href ? (
      <Link href={href(item)} className="font-medium underline-offset-4 hover:underline">
        {column.cell(item)}
      </Link>
    ) : (
      column.cell(item)
    )

  return (
    <>
      <div className="hidden rounded-xl border bg-card md:block">
        <Table aria-label={label}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.header}>
                  {column.actions ? <span className="sr-only">{column.header}</span> : column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={getKey(item)}>
                {columns.map((column) =>
                  column.primary ? (
                    <th key={column.header} scope="row" className="p-2 text-left align-middle font-normal whitespace-nowrap">
                      {title(column, item)}
                    </th>
                  ) : (
                    <TableCell key={column.header}>{column.cell(item)}</TableCell>
                  ),
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label={label} className="grid gap-3 md:hidden">
        {items.map((item) => {
          const actions = columns
            .filter((column) => column.actions)
            .map((column) => ({ column, value: column.cell(item) }))
            .filter(({ value }) => present(value))
          return (
            <li key={getKey(item)} className="rounded-xl border bg-card p-4 text-sm">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {columns
                    .filter((column) => column.primary)
                    .map((column) => (
                      <div key={column.header} className="text-base font-medium">
                        {title(column, item)}
                      </div>
                    ))}
                </div>
                {actions.length > 0 && (
                  <div data-slot="data-list-actions" className="flex shrink-0 items-center gap-1">
                    {actions.map(({ column, value }) => (
                      <span key={column.header} className="contents">
                        {value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <dl className="grid gap-1.5">
                {columns
                  .filter((column) => !column.primary && !column.actions)
                  .map((column) => ({ column, value: column.cell(item) }))
                  .filter(({ value }) => present(value))
                  .map(({ column, value }) => (
                    <div key={column.header} className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{column.header}</dt>
                      <dd className="text-right">{value}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          )
        })}
      </ul>
    </>
  )
}
