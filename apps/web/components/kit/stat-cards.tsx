"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { moveTo, stepInto } from "@/lib/moves"

// StatCards is the prototype's row of figure cards (the home's, a record's
// Balans / Buyurtmalar / Sotuvlar): two to a row on a phone, four on the
// web; three of them stand in one row everywhere, the first wider on a
// phone.
export function StatCards({ three = false, children, className }: { three?: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="stat-cards"
      className={cn(
        "mb-4 grid gap-2.5 md:gap-3",
        three ? "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  )
}

// StatCard is one figure card, the prototype's flat card: its label grey,
// the figure semibold (a debt red, an advance green), a line under it, and
// what else it holds (a stage bar). With href it leads there, named by what
// it says.
export function StatCard({
  label,
  value,
  sub,
  href,
  tone,
  children,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  href?: string
  tone?: "red" | "green"
  children?: ReactNode
}) {
  const classes = cn(
    "grid min-w-0 content-start gap-1 rounded-group surface px-3.5 py-3 text-left text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:rounded-lg md:px-4 md:py-3.5",
    href !== undefined && "active:bg-press md:hover:bg-ink-1",
  )
  const content = (
    <>
      <span className="text-[13px] text-muted-foreground md:text-[12.5px]">{label}</span>{" "}
      <b
        data-slot="stat-value"
        className={cn(
          "text-[17px] font-semibold tracking-[-0.01em] tabular-nums [overflow-wrap:anywhere] md:text-[18px]",
          tone === "red" && "text-destructive",
          tone === "green" && "text-positive",
        )}
      >
        {value}
      </b>
      {sub !== undefined && " "}
      {sub !== undefined && <span className="text-[13px] text-muted-foreground md:text-[12px]">{sub}</span>}
      {children}
    </>
  )
  if (href !== undefined) {
    return (
      <Link href={href} onClick={() => moveTo(stepInto(href))} data-slot="stat-card" className={classes}>
        {content}
      </Link>
    )
  }
  return (
    <div data-slot="stat-card" className={classes}>
      {content}
    </div>
  )
}

// StageBar is the prototype's bar of the active orders by stage: one image
// (named with every stage's count) of colored parts, as wide as their
// counts, and under it the legend: each stage's dot, name and count.
export function StageBar({ label, stages }: { label: string; stages: { name: string; color: string; count: number }[] }) {
  return (
    <>
      <span
        role="img"
        aria-label={`${label}: ${stages.map((stage) => `${stage.name} ${stage.count}`).join(", ")}`}
        data-slot="stage-bar"
        className="mt-1 flex h-1 gap-0.5 overflow-hidden rounded-xs"
      >
        {stages
          .filter((stage) => stage.count > 0)
          .map((stage) => (
            <span key={stage.name} data-slot="stage-bar-part" style={{ flex: stage.count, background: stage.color }} />
          ))}
      </span>
      <span data-slot="stage-legend" aria-hidden="true" className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
        {stages.map((stage) => (
          <span key={stage.name} className="inline-flex items-center gap-1">
            <i className="inline-block size-1.5 rounded-full" style={{ background: stage.color }} />
            {`${stage.name} ${stage.count}`}
          </span>
        ))}
      </span>
    </>
  )
}
