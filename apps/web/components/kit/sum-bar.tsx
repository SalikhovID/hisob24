import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

// SumBar is the prototype's bar at the foot of a document's form: it sticks
// to the bottom of the page while the lines scroll, a floating card with the
// total at the left (under its label) and the button that saves at the
// right. On a phone it stands over the tab bar.
export function SumBar({ label, total, children, className }: { label: string; total: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      data-slot="sum-bar"
      className={cn(
        "sticky bottom-0 z-[5] mb-4 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-float md:rounded-lg",
        className,
      )}
    >
      <span className="grid gap-px">
        <span className="text-[12px] text-muted-foreground">{label}</span>
        <b className="text-[18px] font-semibold tabular-nums">{total}</b>
      </span>
      {children}
    </div>
  )
}
