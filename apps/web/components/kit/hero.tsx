"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Amount } from "./amount"
import { moveTo, stepInto } from "@/lib/moves"

// Hero is the figure a page opens with (the home's debt to the suppliers,
// a purchase's total, an account's balance), the prototype's card of
// frosted glass: a label in the hint's grey (a debt's red, an advance's
// green), the amount large and badges under it, larger pills than a row's,
// all at the left; on a wide screen the figure is larger. The whole leads
// somewhere when told.
export function Hero({
  label,
  value,
  unit,
  badges,
  href,
  onClick,
  tone,
  heading = false,
  className,
}: {
  label: string
  value: string
  unit: string
  badges?: ReactNode
  href?: string
  onClick?: () => void
  // tone colors the label: a debt is red, an advance green.
  tone?: "red" | "green"
  // heading makes the label the page's heading (a document's page opens
  // with its figure).
  heading?: boolean
  className?: string
}) {
  const classes = cn(
    "mt-1.5 mb-4 block w-full rounded-[30px] surface px-[22px] pt-6 pb-[22px] text-left text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:[--amount-big:72px] md:[--amount-small:48px]",
    className,
  )
  const Label = heading ? "h1" : "span"
  const content = (
    <>
      <Label
        data-slot="hero-label"
        className={cn("mb-2.5 block text-[16px] font-medium", tone === "red" ? "text-destructive" : tone === "green" ? "text-positive" : "text-muted-foreground")}
      >
        {label}
      </Label>{" "}
      <Amount value={value} unit={unit} />
      {badges && " "}
      {badges && (
        <span
          data-slot="hero-badges"
          className="mt-3.5 flex flex-wrap items-center justify-start gap-2 text-md font-semibold [&_[data-slot=badge]]:h-[26px] [&_[data-slot=badge]]:px-[11px] [&_[data-slot=badge]]:text-sm [&_[data-slot=badge]]:font-semibold"
        >
          {badges}
        </span>
      )}
    </>
  )
  if (href !== undefined) {
    return (
      <Link href={href} onClick={() => moveTo(stepInto(href))} data-slot="hero" className={classes}>
        {content}
      </Link>
    )
  }
  if (onClick !== undefined) {
    return (
      <button type="button" data-slot="hero" onClick={onClick} className={classes}>
        {content}
      </button>
    )
  }
  return (
    <div data-slot="hero" className={classes}>
      {content}
    </div>
  )
}
