"use client"

import { useDraggable } from "@dnd-kit/core"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { formatPhone } from "@/lib/phone"
import type { Task, TaskStage, TaskType } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Deadline } from "./deadline"
import { StageMenu } from "./stage-menu"

// What a card on the board says of its task.
export interface CardProps {
  task: Task
  // stage is the one the task stands in; stages are all of them, for the
  // menu; type is said only under every type.
  stage: TaskStage
  stages: TaskStage[]
  type?: TaskType
  // onMove is undefined where the member may not move tasks: then there is
  // no stage menu and no drag.
  onMove?: (task: Task, stage: TaskStage) => void
}

// CardContent is the card's face: the title as the way into the task, the
// customer, the deadline, the assignee and the type. The copy that follows
// the pointer during a drag shows it too, so it is apart from the card.
export function CardContent({ task, stage, stages, type, onMove }: CardProps) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/tasks/${task.id}`} className="min-w-0 font-medium underline-offset-4 [overflow-wrap:anywhere] hover:underline">
          {task.title}
        </Link>
        {onMove && <StageMenu task={task} stages={stages} onMove={onMove} />}
      </div>
      <p className="mt-0.5 text-[0.8125rem] leading-5 text-muted-foreground [overflow-wrap:anywhere]">
        {task.customer.name ?? formatPhone(task.customer.phone)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] leading-5 text-muted-foreground">
        <Deadline value={task.deadline} done={stage.is_done} />
        {task.assignee && <span>{task.assignee.full_name ?? formatPhone(task.assignee.phone)}</span>}
        {type && <Badge variant="secondary">{type.name}</Badge>}
      </div>
    </>
  )
}

export const cardClass = "rounded-xl border bg-card p-3 text-sm shadow-xs"

// TaskCard is a task on the board: a card that a pointer drags to another
// column (a press that moves a little, or a finger that rests first), with
// the stage menu for everyone else. While it is dragged the card itself
// fades, and a copy follows the pointer.
export function TaskCard(props: CardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: props.task.id, data: { task: props.task }, disabled: props.onMove === undefined })
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      data-slot="task-card"
      className={cn(cardClass, "touch-manipulation", isDragging && "opacity-40")}
    >
      <CardContent {...props} />
    </li>
  )
}
