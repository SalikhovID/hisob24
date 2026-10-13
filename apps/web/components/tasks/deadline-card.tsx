import { Badge } from "@/components/ui/badge"
import { deadlineOf } from "@/lib/tasks"

// DeadlineCard is the task's deadline, as the prototype's card: the day at
// the left under «Muddat», and at the right how far it is (red once past,
// amber today) or, done, «Bajarilgan» in green.
export function DeadlineCard({ deadline, done }: { deadline: string; done: boolean }) {
  const info = deadlineOf(deadline, done)
  const variant = done ? "green" : info.overdue ? "red" : info.relative === "Bugun" ? "warn" : "accent"
  return (
    <section aria-label="Muddat" className="mb-3 flex items-center justify-between gap-3 rounded-[20px] bg-card px-4 py-3.5">
      <span>
        <small className="mb-0.5 block text-xs text-muted-foreground">Muddat</small>
        <b className="text-base font-semibold tabular-nums">{info.date}</b>
      </span>
      <Badge variant={variant} data-variant={variant} className="h-7 text-md font-semibold">
        {done ? "Bajarilgan" : info.relative}
      </Badge>
    </section>
  )
}
