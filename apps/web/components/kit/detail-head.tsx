"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Children, type CSSProperties, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { moveTo, stepInto } from "@/lib/moves"

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

// Tiles are quick actions in a row of equal tiles (the home's: Buyurtma,
// Sotuv, Xarid, Xarajat, Mijoz), sharing the row alike, the whole width.
export function Tiles({ children, label = "Amallar", className }: { children: ReactNode; label?: string; className?: string }) {
  const count = Children.toArray(children).length
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="tiles"
      style={{ "--n": String(count) } as CSSProperties}
      className={cn("mb-4 grid grid-cols-[repeat(var(--n),minmax(0,1fr))] gap-2", className)}
    >
      {children}
    </div>
  )
}

// Tile is one action, the prototype's tile: on a phone a card with a 36px
// accent circle over its name, on the web a 44px row with the accent's
// icon beside its name; a button, or a link (an address of the app, or
// tel: to call). A danger tile's icon is red.
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
    "flex flex-col items-center justify-center gap-1.5 rounded-group surface px-0.5 pt-3 pb-2.5 text-[12px] font-medium text-foreground no-underline transition-[transform,background-color] duration-150 ease-out-expo outline-none active:scale-[.97] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 md:h-11 md:flex-row md:justify-start md:gap-2.5 md:rounded-lg md:px-3 md:py-0 md:text-[13px] md:hover:bg-ink-1",
  )
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full md:size-auto md:bg-transparent",
          danger ? "bg-destructive text-white md:text-destructive" : "bg-primary text-primary-foreground md:text-primary",
        )}
      >
        <Icon strokeWidth={1.9} className="size-4" />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </>
  )
  if (href !== undefined) {
    return href.startsWith("/") ? (
      <Link href={href} onClick={() => moveTo(stepInto(href))} data-slot="tile" data-danger={danger || undefined} className={classes}>
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
