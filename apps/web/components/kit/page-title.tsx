"use client"

import { ChevronLeftIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { stepBack, stepInto } from "@/lib/moves"

// BackLink is the way back from a page under another, as iOS draws it: a
// chevron and the parent's name in the accent color, with a thumb-sized
// target. Inside Telegram the BackButton (TelegramSync) stands beside it.
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      href={href}
      transitionTypes={stepBack}
      data-slot="back-link"
      className={cn(
        "relative -ml-1.5 inline-flex min-h-11 items-center gap-0.5 pr-3 text-base text-primary outline-none after:absolute after:-inset-x-2 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <ChevronLeftIcon aria-hidden="true" strokeWidth={2.4} className="size-6" />
      <span>{label}</span>
    </Link>
  )
}

// PlusButton is the round accent button that adds a record, at the right of
// a page's title: a button or a link, named in full for assistive technology
// ("Mijoz qo'shish").
export function PlusButton({ label, onClick, href, className }: { label: string; onClick?: () => void; href?: string; className?: string }) {
  const classes = cn(
    "grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 ease-out-expo outline-none active:scale-[.92] focus-visible:ring-3 focus-visible:ring-ring/50",
    className,
  )
  const icon = <PlusIcon aria-hidden="true" strokeWidth={2.6} className="size-[22px]" />
  if (href !== undefined) {
    return (
      <Link href={href} transitionTypes={stepInto(href)} aria-label={label} data-slot="plus-button" className={classes}>
        {icon}
      </Link>
    )
  }
  return (
    <button type="button" aria-label={label} data-slot="plus-button" onClick={onClick} className={classes}>
      {icon}
    </button>
  )
}

// PageTitle opens a page as the prototype does: the way back (on a page
// under another), the name large, a line under it on what the page holds
// (with how many, when that is known) and, at the right, what can be done
// (a PlusButton, or another control).
export function PageTitle({
  title,
  description,
  action,
  back,
  className,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  back?: { href: string; label: string }
  className?: string
}) {
  return (
    <header data-slot="page-title" className={className}>
      {back && <BackLink {...back} />}
      <div className="flex items-start justify-between gap-3 px-0.5 pt-1.5 pb-3.5">
        <div className="min-w-0">
          <h1 className="text-[30px] leading-[1.1] font-bold tracking-[-0.025em] [overflow-wrap:anywhere]">{title}</h1>
          {description && <p className="mt-0.5 text-md text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
    </header>
  )
}
