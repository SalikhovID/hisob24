"use client"

import { useDraggable } from "@dnd-kit/core"
import Link from "next/link"
import { Avatar } from "@/components/kit/avatar"
import { Badge } from "@/components/ui/badge"
import { shortName } from "@/lib/initials"
import { formatPhone } from "@/lib/phone"
import { deadlineOf } from "@/lib/tasks"
import type { Task, TaskStage, TaskType } from "@/lib/types"
import { cn } from "@/lib/utils"
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

// CardContent is the card's face, as the prototype's: the title, the
// customer, and a line of the deadline (the day and how far it is, red once
// past; «bajarildi» in a done stage), the assignee with their avatar and,
// under every type, the type. The copy that follows the pointer during a
// drag shows it too, so it is apart from the card.
export function CardContent({ task, stage, type }: Pick<CardProps, "task" | "stage" | "type">) {
  const deadline = deadlineOf(task.deadline, stage.is_done)
  const assignee = task.assignee
  return (
    <>
      <span data-slot="card-title" className="block text-base leading-tight font-semibold [overflow-wrap:anywhere]">
        {task.title}
      </span>{" "}
      <span className="mt-0.5 block text-md text-muted-foreground [overflow-wrap:anywhere]">{task.customer.name ?? formatPhone(task.customer.phone)}</span>{" "}
      <span className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs font-medium text-muted-foreground">
        <span className={cn(deadline.overdue && "text-destructive")}>
          {deadline.date.slice(0, 5)} · {stage.is_done ? "bajarildi" : deadline.relative}
        </span>{" "}
        {assignee && (
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={assignee.full_name} className="size-[18px] text-[8.5px]" />
            {assignee.full_name ? shortName(assignee.full_name) : formatPhone(assignee.phone)}
          </span>
        )}{" "}
        {type && <Badge className="h-5 text-xs">{type.name}</Badge>}
      </span>
    </>
  )
}

// A card is frosted glass; the copy that follows a dragging finger is a
// sheet's glass over a blur, lifted high above the board.
export const cardClass = "relative rounded-[20px] surface"
export const ghostClass = "relative rounded-[20px] bg-sheet-cell backdrop-blur-[20px] shadow-[var(--rim),0_22px_46px_rgba(60,40,120,.22)]"

// TaskCard is a task on the board: the way into it, a card that a pointer
// drags to another column (a press that moves a little, or a finger that
// rests a moment), with the ⋯ stage menu for everyone else. While it is
// dragged the card itself fades, and a copy follows the pointer.
export function TaskCard({ task, stage, stages, type, onMove }: CardProps) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: task.id, data: { task }, disabled: onMove === undefined })
  return (
    <li ref={setNodeRef} {...listeners} data-slot="task-card" className={cn(cardClass, "touch-manipulation select-none", isDragging && "opacity-35")}>
      <Link
        href={`/tasks/${task.id}`}
        draggable={false}
        className={cn("block rounded-[20px] py-3 pl-3.5 outline-none active:bg-press focus-visible:ring-3 focus-visible:ring-ring/50", onMove ? "pr-11" : "pr-3.5")}
      >
        <CardContent task={task} stage={stage} type={type} />
      </Link>
      {onMove && <StageMenu task={task} stages={stages} onMove={onMove} />}
    </li>
  )
}
