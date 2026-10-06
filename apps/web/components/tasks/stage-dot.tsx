import { colorClasses, colorLabels } from "@/lib/stage-colors"
import type { StageColor } from "@/lib/types"
import { cn } from "@/lib/utils"

// StageDot is a stage's color as a dot, named for a screen reader.
export function StageDot({ color, className }: { color: StageColor; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", colorClasses[color].dot)} />
      <span className="sr-only">{colorLabels[color]}</span>
    </span>
  )
}
