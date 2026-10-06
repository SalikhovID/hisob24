"use client"

import { EllipsisVerticalIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { colorClasses } from "@/lib/stage-colors"
import type { Task, TaskStage } from "@/lib/types"
import { cn } from "@/lib/utils"

// StageMenu moves a task to another stage from a menu of the stages, the
// one it stands in marked: the way for a keyboard, and for a thumb that
// does not want to drag. It is named by the task, since a board holds many.
export function StageMenu({ task, stages, onMove }: { task: Task; stages: TaskStage[]; onMove: (task: Task, stage: TaskStage) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Bosqich: ${task.title}`}
            className="-mt-1 -mr-1.5 shrink-0 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <EllipsisVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuRadioGroup
          value={String(task.stage_id)}
          onValueChange={(value) => {
            const stage = stages.find((candidate) => String(candidate.id) === String(value))
            if (stage) onMove(task, stage)
          }}
        >
          {stages.map((stage) => (
            <DropdownMenuRadioItem key={stage.id} value={String(stage.id)}>
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", colorClasses[stage.color].dot)} />
              {stage.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
