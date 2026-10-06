import { deadlineOf } from "@/lib/tasks"
import { cn } from "@/lib/utils"

// Deadline is a task's deadline as people read it: the day and how far off
// it is ("Bugun", "3 kun qoldi", "2 kun kechikdi"). A task past its day and
// not done is late, and its deadline says so in red; in a done stage the
// day is all that is said.
export function Deadline({ value, done, className }: { value: string; done: boolean; className?: string }) {
  const { date, relative, overdue } = deadlineOf(value, done)
  return (
    <span data-slot="deadline" className={cn("whitespace-nowrap", overdue && "font-medium text-destructive", className)}>
      <time dateTime={value}>{date}</time>
      {relative && (
        <>
          <span aria-hidden="true"> · </span>
          <span>{relative}</span>
        </>
      )}
    </span>
  )
}
