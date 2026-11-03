"use client"

import { ChevronLeftIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { useRegisterBack } from "@/components/kit/back-target"
import { cn } from "@/lib/utils"
import { moveTo, stepInto } from "@/lib/moves"

// BackLink is the way back from a page under another, as iOS draws it: a
// chevron and the parent's name in the accent's words, with a thumb-sized
// target as wide as its words (not the page's column it stands in). It is a
// phone browser's: inside Telegram the BackButton (TelegramSync) leads back
// and the link is hidden; inside the shell on a wide screen the top bar
// leads back, where it tells it to; a page of its own (the company list)
// keeps it on a wide screen.
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  const inShell = useRegisterBack({ href, label })
  return (
    <Link
      href={href}
      onClick={() => moveTo("back")}
      data-slot="back-link"
      className={cn(
        "relative -ml-1.5 inline-flex min-h-11 items-center gap-0.5 self-start pr-3 text-[17px] text-accent-text outline-none after:absolute after:-inset-x-2 after:-inset-y-1 focus-visible:ring-3 focus-visible:ring-ring/50 [html[data-telegram]_&]:hidden",
        inShell && "md:hidden",
        className,
      )}
    >
      <ChevronLeftIcon aria-hidden="true" strokeWidth={2} className="size-[22px]" />
      <span>{label}</span>
    </Link>
  )
}

// PlusButton adds a record, at the right of a page's title, as the
// prototype's: on a phone a 36px accent circle with a plus; on the web the
// accent button with the plus and its name. A button or a link, named in
// full ("Mijoz qo'shish").
export function PlusButton({ label, onClick, href, className }: { label: string; onClick?: () => void; href?: string; className?: string }) {
  const classes = cn(
    "inline-flex size-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary text-primary-foreground transition-[transform,background-color] duration-150 ease-out-expo outline-none active:scale-[.96] focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:w-auto md:rounded-md md:px-3 md:text-[13px] md:font-medium md:hover:bg-[color-mix(in_srgb,var(--primary)_88%,#000)]",
    className,
  )
  const icon = (
    <>
      <PlusIcon aria-hidden="true" strokeWidth={2.2} className="size-5 md:size-4" />
      <span className="hidden md:inline">{label}</span>
    </>
  )
  if (href !== undefined) {
    return (
      <Link href={href} onClick={() => moveTo(stepInto(href))} aria-label={label} data-slot="plus-button" className={classes}>
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
// under another), the name (a 32px bold title on a phone, 20px semibold on
// the web), a line under it on what the page holds (with how many, when that
// is known) and, at the right, what can be done (a PlusButton, or other
// controls).
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
      <div className="flex items-end justify-between gap-3 pt-0.5 pb-4 max-md:flex-wrap md:items-center md:pt-0 md:pb-5">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-[1.15] font-bold tracking-[-0.01em] [overflow-wrap:anywhere] md:text-[20px] md:leading-[1.3] md:font-semibold">{title}</h1>
          {description && <p className="mt-1 text-md text-muted-foreground md:mt-0.5 md:text-[13px]">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2 max-md:has-[[data-slot=page-actions]]:w-full">{action}</div>}
      </div>
    </header>
  )
}
