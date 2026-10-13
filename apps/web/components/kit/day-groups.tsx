"use client"

import { Fragment, type ReactNode } from "react"
import { dayOf, dayTitle } from "@/lib/format"
import { todayISO } from "@/lib/tasks"
import { Group, SectionHeading } from "./group"

// DayGroups is a list of documents as the prototype groups them: under
// their day (in the order they come, the newest first), each day headed as
// people say it («Bugun», «Kecha», «8-oktabr, payshanba») with a hint at
// its right (what the day's documents came to); a group of rows a day.
// children draws a document's row; today is the day it is (the browser's).
export function DayGroups<T>({
  label,
  items,
  at,
  today = todayISO(),
  hint,
  className,
  children,
}: {
  label: string
  items: T[]
  at: (item: T) => string
  today?: string
  hint?: (items: T[]) => string
  className?: string
  children: (item: T) => ReactNode
}) {
  const days: { day: string; items: T[] }[] = []
  for (const item of items) {
    const day = dayOf(at(item))
    const last = days.at(-1)
    if (last?.day === day) last.items.push(item)
    else days.push({ day, items: [item] })
  }
  return (
    <section aria-label={label} className={className}>
      {days.map(({ day, items }) => {
        const title = dayTitle(day, today)
        return (
          <Fragment key={day}>
            <SectionHeading hint={hint?.(items)}>{title}</SectionHeading>
            <Group label={title} inset="icon">
              {items.map(children)}
            </Group>
          </Fragment>
        )
      })}
    </section>
  )
}
