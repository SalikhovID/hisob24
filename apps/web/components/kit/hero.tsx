"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Amount } from "./amount"
import { stepInto } from "@/lib/moves"

// Hero is the figure a page opens with (the home's debt to the suppliers,
// a purchase's total, a supplier's balance): a label, the amount large and
// badges under it; the whole leads somewhere when told.
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
    "block w-full rounded-[24px] px-2 pt-6 pb-7 text-center text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    className,
  )
  const Label = heading ? "h1" : "span"
  const content = (
    <>
      <Label data-slot="hero-label" className={cn("mb-1.5 block text-md font-semibold", tone === "red" && "text-destructive", tone === "green" && "text-positive")}>
        {label}
      </Label>{" "}
      <Amount value={value} unit={unit} />
      {badges && " "}
      {badges && (
        <span data-slot="hero-badges" className="mt-2.5 flex flex-wrap items-center justify-center gap-2 text-md font-semibold">
          {badges}
        </span>
      )}
    </>
  )
  if (href !== undefined) {
    return (
      <Link href={href} transitionTypes={stepInto(href)} data-slot="hero" className={classes}>
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
