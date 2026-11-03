"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { Children, type CSSProperties, type ReactNode } from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { moveTo, stepInto } from "@/lib/moves"

// PageActions holds what can be done with a record, a group named «Amallar»,
// as the prototype's: on the web a row of buttons at the right of the
// record's title (PageTitle's action); on a phone a row of tiles under the
// title, as wide as the page, the actions sharing it alike.
export function PageActions({ children }: { children: ReactNode }) {
  const n = Children.toArray(children).length
  return (
    <div
      role="group"
      aria-label="Amallar"
      data-slot="page-actions"
      style={{ "--n": String(n) } as CSSProperties}
      className="flex items-center gap-2 max-md:grid max-md:w-full max-md:grid-cols-[repeat(var(--n),minmax(0,1fr))]"
    >
      {children}
    </div>
  )
}

const variants = { primary: "default", secondary: "secondary", ghost: "ghost", danger: "destructive" } as const

// The phone's tile: a card with the icon in an accent circle over the name.
const tile =
  "max-md:h-auto max-md:w-auto max-md:min-h-[68px] max-md:flex-col max-md:gap-1.5 max-md:rounded-group max-md:bg-card max-md:px-0.5 max-md:pt-3 max-md:pb-2.5 max-md:text-[12px] max-md:font-medium max-md:text-foreground max-md:shadow-(--group-ring) max-md:hover:bg-card"

// PageAction is one of them, named in full. On the web it is the
// prototype's button, its icon and its name (or the icon alone: a trash);
// on a phone the prototype's tile, the name under the icon. It does its
// action, or leads somewhere (a call by a plain link).
export function PageAction({
  label,
  icon: Icon,
  variant = "secondary",
  iconOnly = false,
  onClick,
  href,
  disabled,
}: {
  label: string
  icon?: LucideIcon
  variant?: keyof typeof variants
  iconOnly?: boolean
  onClick?: () => void
  href?: string
  disabled?: boolean
}) {
  const classes = cn(buttonVariants({ variant: variants[variant], size: iconOnly && Icon ? "icon" : "default" }), tile)
  const content = (
    <>
      {Icon && (
        <span
          aria-hidden="true"
          data-slot="action-icon"
          className={cn(
            "contents max-md:grid max-md:size-9 max-md:shrink-0 max-md:place-items-center max-md:rounded-full max-md:[&_svg]:size-4",
            variant === "danger" ? "max-md:bg-destructive max-md:text-white" : "max-md:bg-primary max-md:text-primary-foreground",
          )}
        >
          <Icon strokeWidth={1.8} />
        </span>
      )}
      <span className={cn("max-md:max-w-full max-md:truncate", iconOnly && "md:sr-only")}>{label}</span>
    </>
  )
  if (href !== undefined) {
    return href.startsWith("/") ? (
      <Link href={href} onClick={() => moveTo(stepInto(href))} data-slot="page-action" className={classes}>
        {content}
      </Link>
    ) : (
      <a href={href} data-slot="page-action" className={classes}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" data-slot="page-action" onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  )
}
