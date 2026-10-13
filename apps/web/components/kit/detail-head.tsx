"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Children, type CSSProperties, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { stepInto } from "@/lib/moves"

// DetailHead opens a record's page as the prototype does: its mark (a large
// avatar, a colored icon) over its name, a line under it (the type, the
// phone) and its badges. The heading stays the name alone.
export function DetailHead({
  media,
  title,
  description,
  badges,
  heading = "h1",
  className,
}: {
  media?: ReactNode
  title: string
  description?: ReactNode
  badges?: ReactNode
  // heading is the name's level: a sheet over a page heads it as h2.
  heading?: "h1" | "h2"
  className?: string
}) {
  const Heading = heading
  return (
    <header data-slot="detail-head" className={cn("flex flex-col items-center px-4 pt-4 pb-5 text-center", className)}>
      {media && <div className="mb-3">{media}</div>}
      <Heading className="text-[26px] leading-[1.15] font-bold tracking-[-0.02em] [overflow-wrap:anywhere]">{title}</Heading>
      {description && <p className="mt-1.5 text-md text-muted-foreground">{description}</p>}
      {badges && <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">{badges}</div>}
    </header>
  )
}

// Tiles are a record's quick actions in a row of equal squares under its
// head; on a wide screen they keep a tile's width instead of stretching.
export function Tiles({ children, label = "Amallar", className }: { children: ReactNode; label?: string; className?: string }) {
  const count = Children.toArray(children).length
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="tiles"
      style={{ "--n": String(count) } as CSSProperties}
      className={cn("mb-3 grid grid-cols-[repeat(var(--n),minmax(0,1fr))] gap-2 md:grid-cols-[repeat(var(--n),minmax(0,10rem))]", className)}
    >
      {children}
    </div>
  )
}

// Tile is one action: a round icon over its name; a button, or a link (an
// address of the app, or tel: to call). A danger tile is red.
export function Tile({
  icon: Icon,
  label,
  onClick,
  href,
  danger = false,
  disabled = false,
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  href?: string
  danger?: boolean
  disabled?: boolean
}) {
  const classes = cn(
    "flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-tile bg-card px-0.5 py-2 text-xs font-semibold no-underline transition-transform duration-150 ease-out-expo outline-none active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
    danger ? "text-destructive" : "text-primary",
  )
  const content = (
    <>
      <span aria-hidden="true" className={cn("grid size-7 place-items-center rounded-full", danger ? "bg-destructive text-white" : "bg-primary text-primary-foreground")}>
        <Icon strokeWidth={2.6} className="size-[17px]" />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </>
  )
  if (href !== undefined) {
    return href.startsWith("/") ? (
      <Link href={href} transitionTypes={stepInto(href)} data-slot="tile" data-danger={danger || undefined} className={classes}>
        {content}
      </Link>
    ) : (
      <a href={href} data-slot="tile" data-danger={danger || undefined} className={classes}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" data-slot="tile" data-danger={danger || undefined} onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  )
}
