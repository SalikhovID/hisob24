"use client"

import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { moveTo, stepInto } from "@/lib/moves"

// PageActions holds what can be done with a record, at the right of its
// title (PageTitle's action), as the prototype's: a row of buttons, a group
// named «Amallar».
export function PageActions({ children }: { children: ReactNode }) {
  return (
    <div role="group" aria-label="Amallar" data-slot="page-actions" className="flex items-center gap-2">
      {children}
    </div>
  )
}

const variants = { primary: "default", secondary: "secondary", ghost: "ghost", danger: "destructive" } as const

// PageAction is one of them, named in full. On the web it is the
// prototype's button, its icon and its name (or the icon alone: a trash);
// on a phone every one but the primary is a 36px round icon (its name is
// still heard). It does its action, or leads somewhere.
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
  const round = variant !== "primary" && Icon !== undefined
  const classes = cn(
    buttonVariants({ variant: variants[variant], size: iconOnly && Icon ? "icon" : "default" }),
    round && "max-md:size-9 max-md:rounded-full max-md:p-0 max-md:[&_svg]:size-[18px]",
  )
  const content = (
    <>
      {Icon && <Icon aria-hidden="true" strokeWidth={1.8} />}
      <span className={cn(iconOnly ? "sr-only" : round && "max-md:sr-only")}>{label}</span>
    </>
  )
  if (href !== undefined) {
    return (
      <Link href={href} onClick={() => moveTo(stepInto(href))} data-slot="page-action" className={classes}>
        {content}
      </Link>
    )
  }
  return (
    <button type="button" data-slot="page-action" onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  )
}
