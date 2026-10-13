import { ClipboardListIcon } from "lucide-react"
import { Row } from "@/components/kit/group"
import { SoftIcon } from "@/components/kit/tile-icon"
import { shortName } from "@/lib/initials"
import { formatPhone } from "@/lib/phone"
import { colorValues } from "@/lib/stage-colors"
import { deadlineOf } from "@/lib/tasks"
import type { Task, TaskStage } from "@/lib/types"
import { cn } from "@/lib/utils"

// TaskRow is a task as the prototype lists it, a row to its page: its icon
// in its stage's color, its title, a line of what is told about it (its
// stage, its customer, its location, its assignee, as asked), and at the
// right the deadline's day over how far it is (red once past) or, done, the
// stage it was done in.
export function TaskRow({
  task,
  stage,
  showStage = false,
  showCustomer = false,
  locationName = null,
}: {
  task: Task
  stage: TaskStage | undefined
  showStage?: boolean
  showCustomer?: boolean
  locationName?: string | null
}) {
  const done = stage?.is_done ?? false
  const deadline = deadlineOf(task.deadline, done)
  const assignee = task.assignee && (task.assignee.full_name ? shortName(task.assignee.full_name) : formatPhone(task.assignee.phone))
  const sub = [
    showStage ? stage?.name : null,
    showCustomer ? (task.customer.name ?? formatPhone(task.customer.phone)) : null,
    locationName,
    assignee,
  ]
    .filter(Boolean)
    .join(" · ")
  const late = deadline.overdue
  return (
    <Row
      href={`/tasks/${task.id}`}
      media={<SoftIcon icon={ClipboardListIcon} color={stage ? colorValues[stage.color] : "var(--muted-foreground)"} />}
      title={task.title}
      sub={sub || undefined}
      end={<span className={cn(late && "text-destructive")}>{deadline.date.slice(0, 5)}</span>}
      endSub={<span className={cn(late && "text-destructive")}>{done ? stage?.name : deadline.relative}</span>}
      chevron={false}
    />
  )
}
