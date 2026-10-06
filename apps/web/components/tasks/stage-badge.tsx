import { Badge } from "@/components/ui/badge"
import { colorClasses } from "@/lib/stage-colors"
import type { TaskStage } from "@/lib/types"
import { cn } from "@/lib/utils"

// StageBadge is the stage a task stands in: its name in the stage's color.
export function StageBadge({ stage, className }: { stage: Pick<TaskStage, "name" | "color">; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(colorClasses[stage.color].badge, className)}>
      {stage.name}
    </Badge>
  )
}
