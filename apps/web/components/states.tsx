import { RotateCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

// Loading holds a list's place while it loads.
export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-label="Yuklanmoqda" aria-busy="true" className="grid gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

// Failed says why something did not load and offers to try again.
export function Failed({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center text-sm">
      <p className="text-destructive">{error.message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCwIcon />
        Qayta urinish
      </Button>
    </div>
  )
}
