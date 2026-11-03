"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Amount } from "./amount"
import { moveTo, stepInto } from "@/lib/moves"

// Hero is the figure a page opens with (the home's cash, a total, a
// balance), the prototype's card: a label in the hint's grey with its icon
// (a debt's red, an advance's green) and a link at its right, the amount
// (34px on a phone, 32px on the web, its unit 18px and faint), a line under
// it and badges, all at the left. A plain one is the figure alone in the
// middle, no card. The whole leads somewhere when told.
export function Hero({
  label,
  icon: Icon,
  action,
  value,
  unit,
  sub,
  badges,
  href,
  onClick,
  tone,
  heading = false,
  plain = false,
  className,
}: {
  label: string
  // icon leads the label; action stands at the label's right (a link on).
  icon?: LucideIcon
  action?: ReactNode
  value: string
  unit: string
  // sub is the line under the figure.
  sub?: ReactNode
  badges?: ReactNode
  href?: string
  onClick?: () => void
  // tone colors the label: a debt is red, an advance green.
  tone?: "red" | "green"
  // heading makes the label the page's heading (a document's page opens
  // with its figure).
  heading?: boolean
  // plain: the figure alone in the middle, no card.
  plain?: boolean
  className?: string
}) {
  const classes = cn(
    "block w-full text-foreground no-underline outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    plain
      ? "px-2 pt-2 pb-6 text-center [--amount-big:34px] [--amount-small:24px] [--amount-unit:18px] md:[--amount-big:32px] md:[--amount-small:22px]"
      : "mb-4 grid gap-1 rounded-group surface p-4 text-left [--amount-big:34px] [--amount-small:24px] [--amount-unit:18px] md:rounded-lg md:px-5 md:py-[18px] md:[--amount-big:32px] md:[--amount-small:22px]",
    className,
  )
  const Label = heading ? "h1" : "span"
  const labelEl = (
    <Label
      data-slot="hero-label"
      className={cn(
        "inline-flex items-center gap-1.5 text-md md:text-[12.5px]",
        plain && "justify-center",
        tone === "red" ? "text-destructive" : tone === "green" ? "text-positive" : "text-muted-foreground",
      )}
    >
      {Icon && <Icon aria-hidden="true" strokeWidth={1.8} className="size-4 text-icon md:size-3.5" />}
      {label}
    </Label>
  )
  const content = (
    <>
      {action ? (
        <span className="flex items-center justify-between gap-3">
          {labelEl}
          <span data-slot="hero-action" className="text-md font-medium text-accent-text md:text-[12.5px]">
            {action}
          </span>
        </span>
      ) : (
        labelEl
      )}{" "}
      <Amount value={value} unit={unit} className={plain ? undefined : "mt-1 justify-start"} />
      {sub && " "}
      {sub && (
        <span data-slot="hero-sub" className="text-md text-muted-foreground md:text-[12.5px]">
          {sub}
        </span>
      )}
      {badges && " "}
      {badges && (
        <span
          data-slot="hero-badges"
          className={cn(
            "mt-2 flex flex-wrap items-center gap-1.5 text-md",
            plain ? "justify-center" : "justify-start",
          )}
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
