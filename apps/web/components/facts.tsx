import type { ReactNode } from "react"

// Fact is one line of a record's facts: what it is, and the value, a dash
// where there is none. The lines stand in a <dl>.
export function Fact({ name, value }: { name: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "" || value === false
  return (
    <div className="grid gap-x-4 gap-y-0.5 px-4 py-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
      <dt className="text-[0.8125rem] leading-5 text-muted-foreground [overflow-wrap:anywhere]">{name}</dt>
      <dd className="min-w-0 text-sm [overflow-wrap:anywhere]">{empty ? <span className="text-muted-foreground">—</span> : value}</dd>
    </div>
  )
}
