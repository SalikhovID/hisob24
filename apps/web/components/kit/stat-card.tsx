"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { moveTo, stepInto } from "@/lib/moves"

const W = 160
const H = 78
const PAD = 8
// END is where the last day stands: short of the card's edge, the line
// going on level to it, so a rise on the last day does not run off the card.
const END = W - 12

// Sparkline is a smooth line over a short series (the month's purchases
// day by day), filled under, drawn across the bottom of a card. The curve
// is monotone: it never goes past a day's value, so a level stretch stays
// level and nothing dips under the foot. It is decoration: the card says
// the figure.
export function Sparkline({ values, color = "var(--primary)", className }: { values: number[]; color?: string; className?: string }) {
  const points = values.length < 2 ? [values[0] ?? 0, values[0] ?? 0] : values
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const pts = points.map((value, i) => [i * (END / (points.length - 1)), H - PAD - ((value - min) / range) * (H - PAD * 2.6)])
  const slopes = monotoneSlopes(pts)
  const at = (p: number[]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
  let d = `M${at(pts[0])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const third = (pts[i + 1][0] - pts[i][0]) / 3
    const c1 = [pts[i][0] + third, pts[i][1] + third * slopes[i]]
    const c2 = [pts[i + 1][0] - third, pts[i + 1][1] - third * slopes[i + 1]]
    d += ` C${at(c1)} ${at(c2)} ${at(pts[i + 1])}`
  }
  d += ` L${W},${pts[pts.length - 1][1].toFixed(1)}`
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

// monotoneSlopes is the slope of the line at each point, by Steffen's
// method (as d3's curveMonotoneX): between two points the curve stays
// between their values. Two points at least.
function monotoneSlopes(pts: number[][]): number[] {
  const n = pts.length
  const slope = (i: number) => (pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0])
  const slopes = new Array<number>(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    const before = pts[i][0] - pts[i - 1][0]
    const after = pts[i + 1][0] - pts[i][0]
    const s0 = slope(i - 1)
    const s1 = slope(i)
    const p = (s0 * after + s1 * before) / (before + after)
    slopes[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0
  }
  slopes[0] = (3 * slope(0) - slopes[1]) / 2
  slopes[n - 1] = (3 * slope(n - 2) - slopes[n - 2]) / 2
  return slopes
}

// Bars are a few figures side by side (the active orders per stage), each
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
// icon on the plain fill and its name,
// a figure with its unit, a line of badges and a chart along the bottom;
// the whole card leads to the section.
export function StatCard({
  href,
  onClick,
  icon: Icon,
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
        <span aria-hidden="true" className="grid size-5 place-items-center rounded-full bg-muted text-foreground">
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
