"use client"

import { ChevronDownIcon, MapPinIcon } from "lucide-react"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { useLocation } from "@/lib/use-location"
import { cn } from "@/lib/utils"

// LocationSwitcher is the way from one location to another
// (logic/locations.md, section 4), as the prototype draws it: a pill that
// says the current location and opens a sheet of the ones the member may
// work in, the current one marked. It shows only when there are two or
// more; the orders and the documents the app shows and enters are the
// current one's. The choice is kept in the browser for the next visit.
export function LocationSwitcher({ className }: { className?: string }) {
  const { locations, current, choose } = useLocation()
  const [open, setOpen] = useState(false)
  if (locations.length < 2 || !current) return null
  return (
    <>
      <button
        type="button"
        aria-label={`Lokatsiya: ${current.name}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        data-slot="location-pill"
        className={cn(
          "inline-flex h-10 max-w-full shrink-0 items-center gap-1.5 rounded-full surface pr-3.5 pl-3 text-md font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        <MapPinIcon aria-hidden="true" strokeWidth={2.3} className="size-[17px] shrink-0 text-primary" />
        <span className="min-w-0 truncate">{current.name}</span>
        <ChevronDownIcon aria-hidden="true" strokeWidth={2.8} className="size-[15px] shrink-0 text-muted-foreground" />
      </button>
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title="Lokatsiya"
        items={locations.map((location) => ({ label: location.name, checked: location.id === current.id, onSelect: () => choose(location.id) }))}
      />
    </>
  )
}
