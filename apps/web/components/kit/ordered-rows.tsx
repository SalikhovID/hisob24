"use client"

import { type CSSProperties, type ReactNode, useState } from "react"
import { SortableList } from "@/components/sortable-list"
import { SectionHeading } from "./group"

const insets = { none: "16px", icon: "68px", tile: "60px" } as const

// OrderedRows is a list of the settings as the prototype's group of rows,
// put in order in its «Tartiblash» mode: the heading says how many there
// are and, for whoever may change the order (with two or more), offers the
// mode; in it the rows show their handles (dragged, or moved with the
// arrow keys) and lead nowhere; out of it each row is the way to its
// record, as row draws it (handle is null then).
export function OrderedRows<T>({
  label,
  heading,
  items,
  getId,
  getLabel,
  onReorder,
  canOrder,
  inset = "none",
  row,
}: {
  label: string
  heading: string
  items: readonly T[]
  getId: (item: T) => string
  getLabel: (item: T) => string
  onReorder: (ids: string[]) => void
  canOrder: boolean
  inset?: keyof typeof insets
  row: (item: T, handle: ReactNode | null) => ReactNode
}) {
  const [sorting, setSorting] = useState(false)
  const orderable = canOrder && items.length > 1
  const on = sorting && orderable
  return (
    <>
      <SectionHeading
        action={
          orderable && (
            <button type="button" onClick={() => setSorting(!sorting)}>
              {sorting ? "Tayyor" : "Tartiblash"}
            </button>
          )
        }
      >
        {heading}
      </SectionHeading>
      <div style={{ "--inset": insets[inset] } as CSSProperties}>
        <SortableList
          label={label}
          items={items}
          getId={getId}
          getLabel={getLabel}
          onReorder={onReorder}
          sorting={on}
          disabled={!orderable}
          className="mb-6 overflow-hidden rounded-group bg-card"
          renderItem={(item, handle) => row(item, on ? handle : null)}
        />
      </div>
    </>
  )
}
