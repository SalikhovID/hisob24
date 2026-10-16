"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { moveTo, stepInto } from "@/lib/moves"

const W = 160
const H = 78
const PAD = 8

// Sparkline is a smooth line over a short series (the month's purchases
// day by day), filled under, drawn across the bottom of a card. It is
// decoration: the card says the figure.
export function Sparkline({ values, color = "var(--primary)", className }: { values: number[]; color?: string; className?: string }) {
  const points = values.length < 2 ? [values[0] ?? 0, values[0] ?? 0] : values
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const pts = points.map((value, i) => [i * (W / (points.length - 1)), H - PAD - ((value - min) / range) * (H - PAD * 2.6)])
  const at = (p: number[]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
  let d = `M${at(pts[0])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${at(c1)} ${at(c2)} ${at(p2)}`
  }
  return (
    <svg
      data-slot="sparkline"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-x-0 bottom-0 block h-[78px] w-full", className)}
    >
      <path d={`${d} L${W},${H} L0,${H}Z`} fill={color} fillOpacity=".13" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  )
}

// Bars are a few figures side by side (the active tasks per stage), each
// in its own color with a light falling from its top and the figure over it
// in the hint ink; the tallest is
// the largest. Together they are one image, named with every figure; each
// bar names its stage on hover.
export function Bars({ items, label }: { items: { label: string; value: number; color: string }[]; label: string }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <div
      role="img"
      aria-label={`${label}: ${items.map((item) => `${item.label} ${item.value}`).join(", ")}`}
      data-slot="bars"
      className="absolute inset-x-3.5 bottom-3 flex h-[62px] items-end gap-2"
    >
      {items.map((item) => (
        <span
          key={item.label}
          data-slot="bar"
          title={item.label}
          style={{ backgroundColor: item.color, height: `${Math.max(10, (item.value / max) * 100)}%` }}
          className="relative min-h-1.5 flex-1 rounded-t-[8px] rounded-b-[5px] bg-[linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0))] opacity-90"
        >
          <i className="absolute inset-x-0 -top-[17px] text-center text-[11.5px] font-semibold text-muted-foreground not-italic">{item.value}</i>
        </span>
      ))}
    </div>
  )
}

// StatCard is one of the "Umumiy holat" cards, frosted glass: a section's
// glossy icon and name,
// a figure with its unit, a line of badges and a chart along the bottom;
// the whole card leads to the section.
export function StatCard({
  href,
  onClick,
  icon: Icon,
  color,
  title,
  value,
  unit,
  meta,
  chart,
  className,
}: {
  href?: string
  onClick?: () => void
  icon: LucideIcon
  color: string
  title: string
  value: string
  unit?: string
  meta?: ReactNode
  chart?: ReactNode
  className?: string
}) {
  const classes = cn(
    "relative flex h-48 flex-col items-stretch overflow-hidden rounded-group surface px-3.5 pt-3.5 text-left no-underline transition-transform duration-150 ease-out-expo outline-none active:scale-[.97] focus-visible:ring-3 focus-visible:ring-ring/50",
    className,
  )
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-md font-medium">
        <span aria-hidden="true" style={{ background: color }} className="gloss grid size-5 place-items-center rounded-full text-white">
          <Icon strokeWidth={2.8} className="size-3" />
        </span>
        {title}
      </span>{" "}
      <span data-slot="stat-value" className="mt-1.5 text-[22px] leading-tight font-bold tracking-[-0.02em] whitespace-nowrap">
        {value}
        {unit && " "}
        {unit && <span className="text-md font-semibold tracking-normal text-muted-foreground">{unit}</span>}
      </span>
      {meta && " "}
      {meta && <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">{meta}</span>}
      {chart}
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
    <button type="button" data-slot="stat-card" onClick={onClick} className={classes}>
      {content}
    </button>
  )
}
