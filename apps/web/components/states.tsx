import { InboxIcon, type LucideIcon, RotateCwIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// Placeholder is what stands in while something loads: a status named
// "Yuklanmoqda", which it also says in words for a screen reader passing by.
// The bars are for the eyes only. It is not marked busy: a busy status is
// not announced.
function Placeholder({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-label="Yuklanmoqda">
      <span className="sr-only">Yuklanmoqda</span>
      <div aria-hidden="true" className={className}>
        {children}
      </div>
    </div>
  )
}

// Loading holds the place of a page or a part of it while it loads.
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <Placeholder className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </Placeholder>
  )
}

// ListLoading holds the place of a list of records while it loads, in the
// shape the records will have: an avatar and two lines each, framed as the
// table is on wide screens and as cards on phones. It is not a table itself:
// the table on screen is the sign that the list has come.
export function ListLoading({ rows = 3 }: { rows?: number }) {
  return (
    <Placeholder className="grid gap-3 md:gap-0 md:divide-y md:rounded-xl md:border md:bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          data-slot="list-loading-row"
          className="flex items-center gap-3 rounded-xl border bg-card p-4 md:rounded-none md:border-0 md:bg-transparent md:px-4 md:py-3"
        >
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-28 max-w-full" />
          </div>
          <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
        </div>
      ))}
    </Placeholder>
  )
}

// Failed says why something did not load, aloud too (an alert is announced
// when it appears), and offers to try again.
export function Failed({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm">
      <p role="alert" className="text-destructive">
        {error.message}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCwIcon />
        Qayta urinish
      </Button>
    </div>
  )
}

// EmptyState says there is nothing to show yet and, when it helps, what would
// change that. It is a note inside its section, so it has no heading.
export function EmptyState({
  icon: Icon = InboxIcon,
  title,
  description,
}: {
  icon?: LucideIcon
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center">
      <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
