import Link from "next/link"
import type { Key, ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface Column<T> {
  // key tells the column from the others where two may share a name (a field
  // the owner named like a built-in column); without one the header does.
  key?: string
  header: string
  cell: (item: T) => ReactNode
  // primary is the record's title: the header of its row in the table and
  // the top of its card on phones (and the record's link, when the list is
  // given href).
  primary?: boolean
  // actions are what can be done with the record. The table names their
  // column for screen readers only; a card shows them at its top, beside the
  // title, with no name on screen (the group is named for screen readers).
  actions?: boolean
  // card is how a card shows the value: "row" (the default) on a line of its
  // own beside the column's name. "inline" and "tag" share one line under
  // the title, the tags first: an inline value follows its column's name (a
  // bare date could be any date); a tag is a value that says what it is by
  // itself (a badge, a day count, a period), so its name is kept for screen
  // readers only. "aside" is the figure the
  // record is read for (an amount): it stands at the card's top, across from
  // the title, its name for screen readers only. "note" is free text: it
  // takes a line of its own after everything else and wraps, its name for
  // screen readers only.
  card?: "row" | "inline" | "tag" | "aside" | "note"
  // align puts a column of figures (day counts, amounts) at the end of its
  // cells, so the digits line up.
  align?: "end"
  // className styles the column's cells in the table, header and body: a
  // width, a quieter color.
  className?: string
}

// keyOf is what React tells a column's cells apart by.
const keyOf = <T,>(column: Column<T>) => column.key ?? column.header

// present tells a value from one that is not there (null, false, "").
const present = (value: ReactNode) => value !== null && value !== undefined && value !== false && value !== ""

// filled is a table cell's content: the value, or a dash where there is
// none, so the eye does not take the gap for a value still on its way.
const filled = (value: ReactNode) => (present(value) ? value : <span className="text-muted-foreground">—</span>)

// DataList shows records as a table on wide screens and as cards on phones:
// the title, an aside figure and the actions at the top, the tags and inline
// values in a line under the title, every other value labeled with its
// column's name, a note last. A value that is not
// there is a dash in the table and takes no place in the card. The footer
// (a total, the pager) closes the list once, whichever of the two is on
// screen.
export function DataList<T>({
  label,
  items,
  columns,
  getKey,
  href,
  footer,
}: {
  label: string
  items: T[]
  columns: Column<T>[]
  getKey: (item: T) => Key
  // href links every record by its whole title cell. It is for plain-text
  // titles: a cell that links itself (an Identity with its own href) must not
  // be combined with it, or one link would sit inside another.
  href?: (item: T) => string
  footer?: ReactNode
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
    // The frame is the table's, from md up; on phones every card has its own.
    // Nothing is clipped at its corners (a focus ring must show whole), so
    // the header and footer bands round their own.
    <div data-slot="data-list" className="tabular-nums md:rounded-xl md:border md:bg-card">
      <div className="hidden md:block">
        <Table aria-label={label}>
          <TableHeader className="bg-muted/50 [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl [&_tr]:hover:bg-transparent">
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={keyOf(column)}
                  scope="col"
                  className={cn(
                    "px-4 text-[0.8125rem] text-muted-foreground",
                    column.align === "end" && "text-right",
                    column.actions && "w-px px-2",
                    column.className,
                  )}
                >
                  {column.actions ? <span className="sr-only">{column.header}</span> : column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={getKey(item)} className="hover:bg-muted/40">
                {columns.map((column) =>
                  column.primary ? (
                    <th
                      key={keyOf(column)}
                      scope="row"
                      className={cn("px-4 py-3 text-left align-middle font-normal", column.className)}
                    >
                      {title(column, item)}
                    </th>
                  ) : (
                    <TableCell
                      key={keyOf(column)}
                      className={cn(
                        "px-4 py-3",
                        column.align === "end" && "text-right",
                        column.actions && "px-2 py-2 text-right",
                        column.className,
                      )}
                    >
                      {column.actions ? column.cell(item) : filled(column.cell(item))}
                    </TableCell>
                  ),
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul aria-label={label} className="grid gap-3 md:hidden">
        {items.map((item) => {
          const valuesOf = (wanted: (column: Column<T>) => boolean) =>
            columns
              .filter(wanted)
              .map((column) => ({ column, value: column.cell(item) }))
              .filter(({ value }) => present(value))
          // shown are a card's values of one kind; the title and the actions
          // have places of their own.
          const shown = (kind: NonNullable<Column<T>["card"]>) =>
            valuesOf((column) => !column.primary && !column.actions && (column.card ?? "row") === kind)
          const actions = valuesOf((column) => !!column.actions)
          const aside = shown("aside")
          // A badge leads the line: it is what the eye looks for first.
          const inline = [...shown("tag"), ...shown("inline")]
          const labeled = shown("row")
          const notes = shown("note")
          return (
            // The card is a grid so that what it shows at its top right (the
            // actions) can come last in the source: a screen reader meets the
            // record before what can be done with it. A card whose title is
            // a link opens from anywhere on it: the link's stretched area is
            // measured from the card here (from the identity in a table
            // cell), the card answers a press by darkening, and the actions
            // stay above the link.
            <li
              key={getKey(item)}
              className="relative grid grid-cols-[minmax(0,1fr)_auto_auto] rounded-xl border bg-card p-4 text-sm has-[a:active]:bg-muted/40 [&_[data-slot=identity]]:static"
            >
              <div data-slot="data-list-title" className="col-start-1 row-start-1 min-w-0 font-medium">
                {columns
                  .filter((column) => column.primary)
                  .map((column) => (
                    <div key={keyOf(column)}>{title(column, item)}</div>
                  ))}
              </div>
              {aside.length > 0 && (
                <dl data-slot="data-list-aside" className="col-start-2 row-start-1 ml-3 grid justify-items-end gap-1">
                  {aside.map(({ column, value }) => (
                    <div key={keyOf(column)}>
                      <dt className="sr-only">{column.header}</dt>
                      <dd className="font-medium whitespace-nowrap">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {inline.length > 0 && (
                <dl
                  data-slot="data-list-meta"
                  className="col-span-3 row-start-2 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] leading-5 text-muted-foreground"
                >
                  {inline.map(({ column, value }) => (
                    <div key={keyOf(column)} className="flex items-center gap-1.5">
                      <dt className={column.card === "tag" ? "sr-only" : undefined}>{column.header}</dt>
                      <dd className="whitespace-nowrap">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {labeled.length > 0 && (
                <dl data-slot="data-list-values" className="col-span-3 row-start-3 mt-3 grid gap-1.5">
                  {labeled.map(({ column, value }) => (
                    <div key={keyOf(column)} className="flex items-baseline justify-between gap-3">
                      <dt className="text-[0.8125rem] text-muted-foreground">{column.header}</dt>
                      <dd className="min-w-0 text-right break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {notes.length > 0 && (
                <dl
                  data-slot="data-list-note"
                  className="col-span-3 row-start-4 mt-1.5 grid gap-1 text-[0.8125rem] leading-5 text-muted-foreground"
                >
                  {notes.map(({ column, value }) => (
                    <div key={keyOf(column)}>
                      <dt className="sr-only">{column.header}</dt>
                      <dd className="[overflow-wrap:anywhere]">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {actions.length > 0 && (
                <div
                  role="group"
                  aria-label={actions[0].column.header}
                  data-slot="data-list-actions"
                  className="relative z-10 col-start-3 row-start-1 -mt-1 -mr-2 ml-2 flex shrink-0 items-center gap-2 self-start"
                >
                  {actions.map(({ column, value }) => (
                    <span key={keyOf(column)} className="contents">
                      {value}
                    </span>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {footer && (
        <div
          data-slot="data-list-footer"
          className="mt-3 px-1 text-[0.8125rem] leading-5 text-muted-foreground md:mt-0 md:flex md:min-h-11 md:items-center md:rounded-b-xl md:border-t md:bg-muted/50 md:px-4 md:py-1.5"
        >
          {footer}
        </div>
      )}
    </div>
  )
}
