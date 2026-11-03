"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { MouseEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { moveTo, stepInto } from "@/lib/moves"
import { Group, Row } from "./group"

// A column of the web's table: its head, where it stands (a figure at the
// end, at the right), its width, and what its cell says of a record.
export interface Column<T> {
  key: string
  label: string
  align?: "start" | "end"
  width?: string
  render: (row: T) => ReactNode
}

// What a record's row says on a phone: what leads it (an avatar), its title
// and badge, the line under it, the value at the right and its line.
export interface MobileRow {
  lead?: ReactNode
  title: ReactNode
  sub?: ReactNode
  badge?: ReactNode
  end?: ReactNode
  endSub?: ReactNode
}

// DataTable is a list of records as the prototype shows it on either
// screen: on the web a table (its columns' grey heads, 48px rows that tint
// under the pointer, a hairline between them, in a ringed card), on a phone
// the grouped rows of the mini app. Both are drawn, one hidden by the
// screen's width, and both are named for the records. A record with a way
// in (href) leads there: from the table's first cell, a link, and from a
// press anywhere on its row; from the phone's row, which is a link. A page
// may draw the phone's records its own way (phone: in groups, say).
export function DataTable<T>({
  label,
  rows,
  rowKey,
  columns,
  mobileRow,
  phone,
  href,
  onRow,
  empty,
}: {
  label: string
  rows: T[]
  rowKey: (row: T) => string | number
  columns: Column<T>[]
  mobileRow?: (row: T) => MobileRow
  phone?: ReactNode
  href?: (row: T) => string
  onRow?: (row: T) => void
  empty?: ReactNode
}) {
  const router = useRouter()
  if (rows.length === 0) return <>{empty}</>

  const open = (row: T) => {
    if (href) {
      const to = href(row)
      moveTo(stepInto(to))
      router.push(to)
    } else onRow?.(row)
  }
  // A press on the row opens its record, unless it was on a control of its
  // own (the link in the first cell, a button).
  const pressRow = (row: T) => (event: MouseEvent<HTMLTableRowElement>) => {
    if ((event.target as HTMLElement).closest("a, button, input, label, [role=button]")) return
    open(row)
  }
  const leads = href !== undefined || onRow !== undefined

  return (
    <>
      <div data-slot="data-table" className="mb-4 hidden overflow-x-auto rounded-lg bg-card shadow-[0_0_0_1px_var(--border)] md:block">
        <table aria-label={label} className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    "h-9 border-b border-border px-3 text-[12px] font-medium whitespace-nowrap text-faint",
                    column.align === "end" ? "text-right" : "text-left",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                data-click={leads || undefined}
                onClick={leads ? pressRow(row) : undefined}
                className={cn("group/row [&:last-child>td]:border-b-0", leads && "cursor-pointer")}
              >
                {columns.map((column, index) => {
                  const content = column.render(row)
                  return (
                    <td
                      key={column.key}
                      className={cn(
                        "h-12 border-b border-line-faint px-3 text-foreground tabular-nums group-hover/row:bg-ink-1",
                        column.align === "end" ? "text-right" : "text-left",
                      )}
                    >
                      {index === 0 && href ? (
                        <Link
                          href={href(row)}
                          onClick={() => moveTo(stepInto(href(row)))}
                          className="text-foreground no-underline outline-none focus-visible:underline"
                        >
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div data-slot="data-list" className="md:hidden">
        {phone ?? (
          <Group label={label}>
            {rows.map((row) => {
              const item = mobileRow?.(row) ?? { title: "" }
              return (
                <Row
                  key={rowKey(row)}
                  href={href?.(row)}
                  onClick={!href && onRow ? () => onRow(row) : undefined}
                  media={item.lead}
                  title={item.title}
                  badge={item.badge}
                  sub={item.sub}
                  end={item.end}
                  endSub={item.endSub}
                />
              )
            })}
          </Group>
        )}
      </div>
    </>
  )
}
