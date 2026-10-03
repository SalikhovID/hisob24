import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

// PageHeader opens a page: its name, a line on what it holds (with how many,
// when that is known) and, beside them, what can be done on it. A page under
// another one leads back to it. A page about one record may show the
// record's avatar beside the name: beside, not inside, so the heading stays
// the name alone. On a phone the name and the action share the first line
// and the description takes the whole of the second, so it never wraps
// beside the button; in the source the order is always name, description,
// action.
export function PageHeader({
  title,
  description,
  actions,
  back,
  avatar,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  back?: { href: string; label: string }
  avatar?: ReactNode
}) {
  return (
    <header className="space-y-2">
      {back && (
        <Link
          href={back.href}
          className="inline-flex h-7 items-center gap-1 text-[0.8125rem] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
        <div className="flex min-w-0 items-center gap-3">
          {avatar}
          <h1 className="min-w-0 text-xl font-semibold tracking-tight [overflow-wrap:anywhere] md:text-2xl">{title}</h1>
        </div>
        {description && (
          <p className="col-span-2 row-start-2 text-sm text-muted-foreground md:col-span-1">{description}</p>
        )}
        {actions && (
          <div className="col-start-2 row-start-1 flex flex-wrap items-center justify-end gap-2 md:row-span-2 md:self-center">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
