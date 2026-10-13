import { type LucideIcon, RotateCwIcon } from "lucide-react"
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
        <Skeleton key={i} className="h-16 w-full rounded-group" />
      ))}
    </Placeholder>
  )
}

// Names differ in length, and so do the bars that stand for them.
const nameWidths = ["w-36", "w-44", "w-28"]

// The mark that opens a row: round for a person, square for a company, none
// for a record that has no avatar (a payment).
const marks = { round: "rounded-full", square: "rounded-[12px]" }

// ListLoading holds the place of a group of rows while it loads, in the
// group's own shape and size, so nothing moves when the records come: a
// row per record, the mark, the name and the line under it. The whole
// placeholder pulses as one, and only for those who have not asked for less
// motion.
export function ListLoading({ rows = 3, mark = "round" }: { rows?: number; mark?: "round" | "square" | "none" }) {
  return (
    <Placeholder className="mb-6 overflow-hidden rounded-group bg-card motion-safe:animate-pulse">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          data-slot="list-loading-row"
          className={cn("flex items-center gap-3 px-4 not-first:border-t-[0.5px] not-first:border-border", mark === "none" ? "h-12" : "h-14")}
        >
          {mark !== "none" && <Skeleton className={cn("size-10 shrink-0 animate-none", marks[mark])} />}
          <div className="grid flex-1 gap-2">
            <Skeleton className={cn("h-3.5 max-w-full animate-none", nameWidths[i % nameWidths.length])} />
            {mark !== "none" && <Skeleton className="h-3 w-24 max-w-full animate-none" />}
          </div>
          <Skeleton className="h-3.5 w-14 animate-none" />
        </div>
      ))}
    </Placeholder>
  )
}

// Failed says why something did not load, aloud too (an alert is announced
// when it appears), and offers to try again. It takes the list's place, in
// the list's frame.
export function Failed({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="mb-6 flex flex-col items-center gap-3 rounded-group bg-card px-6 py-8 text-center">
      <p role="alert" className="text-md text-balance text-destructive">
        {error.message}
      </p>
      <Button variant="secondary" size="lg" onClick={onRetry}>
        <RotateCwIcon />
        Qayta urinish
      </Button>
    </div>
  )
}

// EmptyState says there is nothing to show and, under that, what would
// change it: with an icon in the accent tint, and the way forward (a
// button) when there is one. It takes the list's place, in the list's
// frame: a note inside its section, so it has no heading.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div data-slot="empty-state" className={cn("mb-6 rounded-group bg-card px-6 py-7 text-center", className)}>
      {Icon && (
        <span aria-hidden="true" className="mx-auto mb-3.5 grid size-16 place-items-center rounded-[20px] bg-primary-soft text-primary">
          <Icon aria-hidden="true" strokeWidth={1.9} className="size-[30px]" />
        </span>
      )}
      <p className="text-[18px] font-semibold">{title}</p>
      {description && <p className="mt-1.5 text-md text-pretty text-muted-foreground">{description}</p>}
      {action && <div className="mt-4 inline-flex">{action}</div>}
    </div>
  )
}

// NotFound is a record that is gone (or another company's): the page's
// heading says so, a line under it says why.
export function NotFound({ title, description, icon: Icon }: { title: string; description: string; icon?: LucideIcon }) {
  return (
    <div data-slot="not-found" className="mt-10 rounded-group bg-card px-6 py-7 text-center">
      {Icon && (
        <span aria-hidden="true" className="mx-auto mb-3.5 grid size-16 place-items-center rounded-[20px] bg-muted text-muted-foreground">
          <Icon aria-hidden="true" strokeWidth={1.9} className="size-[30px]" />
        </span>
      )}
      <h1 className="text-[18px] font-semibold">{title}</h1>
      <p className="mt-1.5 text-md text-pretty text-muted-foreground">{description}</p>
    </div>
  )
}

// Splash is the app's opening screen while Telegram signs the user in: the
// pulsing mark (Hisob24's, named so for a screen reader), a loading line
// and a word on what is going on.
export function Splash({ children }: { children: ReactNode }) {
  return (
    <div role="status" data-slot="splash" className="flex flex-1 flex-col items-center justify-center px-7 pt-6 pb-[140px] text-center">
      <span
        role="img"
        aria-label="Hisob24"
        className="grid size-[84px] place-items-center rounded-[26px] bg-brand-panel text-[30px] font-extrabold tracking-[-0.05em] text-brand-panel-foreground italic shadow-[0_10px_30px_rgba(23,68,73,.3)] motion-safe:animate-[pulse-mark_1.4s_ease-in-out_infinite]"
      >
        H24
      </span>
      <span aria-hidden="true" className="mt-7 h-1 w-[120px] overflow-hidden rounded-sm bg-muted">
        <span className="block h-full w-2/5 rounded-sm bg-primary motion-safe:animate-[load-line_1.1s_ease-in-out_infinite]" />
      </span>
      <p className="mt-3.5 text-md text-muted-foreground">{children}</p>
    </div>
  )
}

const tones = {
  accent: "bg-primary-soft text-primary",
  red: "bg-destructive-soft text-destructive",
  warn: "bg-warning-soft text-warning",
}

// StateScreen is a screen with one message and one way out, with no shell
// around it (the subscription expired, the phone not shared, no access):
// an icon in its tone, a heading, a line and, under them, the main button.
export function StateScreen({
  icon: Icon,
  tone = "accent",
  title,
  description,
  children,
}: {
  icon: LucideIcon
  tone?: keyof typeof tones
  title: string
  description?: ReactNode
  children?: ReactNode
}) {
  return (
    <div data-slot="state-screen" className="flex min-h-full flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-7 pt-6 pb-[140px] text-center">
        <span aria-hidden="true" className={cn("grid size-[84px] place-items-center rounded-[28px]", tones[tone])}>
          <Icon strokeWidth={1.9} className="size-10" />
        </span>
        <h1 className="mt-[18px] text-[26px] leading-[1.2] font-bold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-2 max-w-[300px] text-[16px] leading-[1.45] text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}
