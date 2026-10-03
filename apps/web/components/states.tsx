import { RotateCwIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

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

// The mark that opens a row: round for a person, square for a company, none
// for a record that has no avatar (a payment).
const marks = { round: "rounded-full", square: "rounded-lg" }

// ListLoading holds the place of a list of records while it loads, in the
// list's own shape and size, so nothing moves when the records come: on wide
// screens the frame with its header and footer bands and a row per record,
// on phones a card each, with the line under the title. It is not a table
// itself: the table on screen is the sign that the list has come. The whole
// placeholder pulses as one, and only for those who have not asked for less
// motion.
export function ListLoading({ rows = 3, mark = "round" }: { rows?: number; mark?: "round" | "square" | "none" }) {
  return (
    <Placeholder className="motion-safe:animate-pulse md:rounded-xl md:border md:bg-card">
      <div className="hidden h-10 rounded-t-xl border-b bg-muted/50 md:block" />
      <div className="grid gap-3 md:gap-0">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            data-slot="list-loading-row"
            className={cn(
              // The height is the row's content, as a table row's is: the
              // line under it comes on top.
              "rounded-xl border bg-card p-4 md:box-content md:flex md:items-center md:gap-3 md:rounded-none md:border-0 md:border-b md:bg-transparent md:px-4 md:py-0 md:last:border-b-0",
              mark === "none" ? "md:h-11" : "md:h-16",
            )}
          >
            <div className={cn("flex flex-1 items-center gap-3", mark === "none" ? "min-h-5" : "min-h-10")}>
              {mark !== "none" && <Skeleton className={cn("size-9 shrink-0 animate-none", marks[mark])} />}
              <div className="grid flex-1 gap-2">
                <Skeleton className={cn("h-3.5 max-w-full animate-none", nameWidths[i % nameWidths.length])} />
                {mark !== "none" && <Skeleton className="h-3 w-24 max-w-full animate-none" />}
              </div>
            </div>
            <Skeleton className="mt-3 h-5 w-40 max-w-full animate-none rounded-full md:mt-0 md:w-16" />
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

// EmptyState says there is nothing to show and, under that, what would
// change it. It takes the list's place, in the list's frame: a note inside
// its section, so it has no heading, and no button either (what to do next
// is already on the page).
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm">
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 text-pretty text-muted-foreground">{description}</p>}
    </div>
  )
}
