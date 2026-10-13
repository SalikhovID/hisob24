import { CircleCheckIcon, ClipboardListIcon, MapPinIcon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { EmptyState } from "@/components/states"
import { shortName } from "@/lib/initials"
import { formatPhone } from "@/lib/phone"
import { colorValues } from "@/lib/stage-colors"
import { deadlineOf } from "@/lib/tasks"
import type { Dashboard, TaskStage } from "@/lib/types"
import { cn } from "@/lib/utils"

// UpcomingTasks is the home's «Yaqin muddatlar», as the prototype's: the
// tasks not done that are due soonest, each a row to its page (its icon in
// its stage's color, its customer and assignee, the deadline and how far
// it is, red once past), then the way to them all; the heading leads to the
// list too and says how many are open. With none open it says so (and
// offers to add one); a member with no location is told why there are none.
export function UpcomingTasks({
  tasks,
  stages,
  hasLocation,
  canAdd,
  onAdd,
}: {
  tasks: NonNullable<Dashboard["tasks"]>
  stages: TaskStage[]
  hasLocation: boolean
  canAdd: boolean
  onAdd: () => void
}) {
  const heading = (
    <SectionHeading hint={hasLocation ? `Jami: ${tasks.active}` : undefined}>
      <Link href="/tasks?view=list" className="rounded outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        Yaqin muddatlar
      </Link>
    </SectionHeading>
  )
  if (!hasLocation) {
    return (
      <>
        {heading}
        <EmptyState icon={MapPinIcon} title="Sizga lokatsiya biriktirilmagan" description="Kompaniya egasi lokatsiya biriktirishi kerak." />
      </>
    )
  }
  if (tasks.upcoming.length === 0) {
    return (
      <>
        {heading}
        <EmptyState
          icon={CircleCheckIcon}
          title="Faol vazifa yo'q"
          action={
            canAdd && (
              <MainButton onClick={onAdd} className="px-5">
                <PlusIcon className="size-5" />
                Vazifa qo&apos;shish
              </MainButton>
            )
          }
        />
      </>
    )
  }
  return (
    <>
      {heading}
      <Group label="Yaqin muddatlar" inset="icon">
        {tasks.upcoming.map((task) => {
          const stage = stages.find((s) => s.id === task.stage_id)
          const deadline = deadlineOf(task.deadline, false)
          const assignee = task.assignee && (task.assignee.full_name ? shortName(task.assignee.full_name) : formatPhone(task.assignee.phone))
          const who = [task.customer.name ?? formatPhone(task.customer.phone), assignee].filter(Boolean).join(" · ")
          return (
            <Row
              key={task.id}
              href={`/tasks/${task.id}`}
              media={
                <span
                  aria-hidden="true"
                  style={{ color: stage ? colorValues[stage.color] : undefined }}
                  className="grid size-9 place-items-center rounded-[11px] bg-[color-mix(in_srgb,currentColor_14%,transparent)]"
                >
                  <ClipboardListIcon className="size-5" />
                </span>
              }
              title={task.title}
              sub={who}
              end={<span className={cn(deadline.overdue && "text-destructive")}>{deadline.date.slice(0, 5)}</span>}
              endSub={<span className={cn(deadline.overdue && "text-destructive")}>{deadline.relative}</span>}
              chevron={false}
            />
          )
        })}
        <Row variant="link" href="/tasks?view=list" title="Barcha vazifalar" chevron />
      </Group>
    </>
  )
}
