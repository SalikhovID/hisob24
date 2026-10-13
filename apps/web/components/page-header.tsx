import type { ReactNode } from "react"
import { BackLink } from "@/components/kit/page-title"
import { cn } from "@/lib/utils"

// PageHeader opens a page as the prototype does: the way back (on a page
// under another, iOS's chevron and the parent's name), the name large, a
// line under it on what the page holds (with how many, when that is known)
// and, beside them, what can be done on it. A page about one record may show
// the record's avatar beside the name: beside, not inside, so the heading
// stays the name alone. The name never gives way to the actions: it keeps
// at least 10rem, and actions that do not fit beside it go under it. A page
// with more to do than one button fits beside a name on a phone stacks its
// actions there: they take a line of their own under it.
export function PageHeader({
  title,
  description,
  actions,
  back,
  avatar,
  stack = false,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  back?: { href: string; label: string }
  avatar?: ReactNode
  stack?: boolean
}) {
  return (
    <header data-slot="page-header">
      {back && <BackLink href={back.href} label={back.label} />}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 px-0.5 pt-1.5">
        <div className={cn("min-w-0 flex-[1_1_10rem]", stack && "max-md:basis-full")}>
          <div className="flex min-w-0 items-center gap-3">
            {avatar}
            <h1 className="min-w-0 text-[30px] leading-[1.1] font-bold tracking-[-0.025em] [overflow-wrap:anywhere]">{title}</h1>
          </div>
          {description && <p className="mt-0.5 text-md text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}
