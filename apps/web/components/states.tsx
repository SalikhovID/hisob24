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
