"use client"

import { MapPinIcon } from "lucide-react"
import { SelectBox } from "@/components/select-field"
import { useLocation } from "@/lib/use-location"

// LocationSwitcher is the way from one location to another, in the top bar
// (logic/locations.md, section 4): the locations the member may work in,
// the current one chosen. It shows only when there are two or more; the
// tasks the app shows and enters are the current one's. The choice is kept
// in the browser for the next visit.
export function LocationSwitcher() {
  const { locations, current, choose } = useLocation()
  if (locations.length < 2 || !current) return null
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <MapPinIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <SelectBox
        aria-label="Lokatsiya"
        className="h-8 w-fit max-w-[8.5rem] bg-card sm:max-w-56"
        value={String(current.id)}
        onChange={(value) => choose(Number(value))}
        options={locations.map((l) => ({ value: String(l.id), label: l.name }))}
      />
    </div>
  )
}
