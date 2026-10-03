import { RotateCwIcon } from "lucide-react"
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

// Names differ in length, and so do the bars that stand for them.
const nameWidths = ["w-36", "w-44", "w-28"]

// ListLoading holds the place of a list of records while it loads, in the
// list's own shape, so nothing moves when the records come: on wide screens
// the frame with its header and footer bands and a row per record (an avatar
// and two lines), on phones a card each. It is not a table itself: the table
// on screen is the sign that the list has come. The whole placeholder pulses
// as one, and only for those who have not asked for less motion.
export function ListLoading({ rows = 3 }: { rows?: number }) {
  return (
    <Placeholder className="motion-safe:animate-pulse md:rounded-xl md:border md:bg-card">
      <div className="hidden h-10 rounded-t-xl border-b bg-muted/50 md:block" />
      <div className="grid gap-3 md:gap-0 md:divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            data-slot="list-loading-row"
            className="flex items-center gap-3 rounded-xl border bg-card p-4 md:h-[3.75rem] md:rounded-none md:border-0 md:bg-transparent md:px-4 md:py-0"
          >
            <Skeleton className="size-9 shrink-0 animate-none rounded-full" />
            <div className="grid flex-1 gap-2">
              <Skeleton className={`h-3.5 max-w-full animate-none ${nameWidths[i % nameWidths.length]}`} />
              <Skeleton className="h-3 w-24 max-w-full animate-none" />
            </div>
            <Skeleton className="hidden h-5 w-16 animate-none rounded-full md:block" />
          </div>
        ))}
      </div>
      <div className="hidden h-11 rounded-b-xl border-t bg-muted/50 md:block" />
    </Placeholder>
  )
}

// Failed says why something did not load, aloud too (an alert is announced
// when it appears), and offers to try again. It takes the list's place, in
// the list's frame.
export function Failed({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-4 py-10 text-center text-sm">
      <p role="alert" className="text-destructive">
        {error.message}
      </p>
      <Button variant="outline" size="lg" onClick={onRetry}>
        <RotateCwIcon />
        Qayta urinish
      </Button>
    </div>
  )
}

// EmptyState says there is nothing to show and, when it helps, what would
// change that. It takes the list's place, in the list's frame: a note inside
// its section, so it has no heading, and no button either (what to do next
// is already on the page).
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
      <p>{title}</p>
      {description && <p className="mt-1 text-[0.8125rem] leading-5">{description}</p>}
    </div>
  )
}
