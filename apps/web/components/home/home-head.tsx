"use client"

import { ChevronDownIcon } from "lucide-react"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { useLocation } from "@/lib/use-location"

// HomeHead heads the home, as the prototype's title: on a wide screen the
// greeting («Salom, Ism», the page's heading) and the company with the
// current location under it; on a phone the company's name big, and who is
// signed in, their role and the location under it (the greeting stays the
// page's heading for a screen reader). With two locations or more the
// phone's location is the way to another (logic/locations.md, section 4):
// a sheet of them; a wide screen has its switch in the top bar.
export function HomeHead({ name, company, role }: { name: string; company: string; role: string }) {
  const { locations, current, choose } = useLocation()
  const [open, setOpen] = useState(false)
  const place = current?.name ?? null
  const switchable = current !== null && locations.length > 1

  return (
    <div data-slot="home-head" className="mb-4 pt-1.5 md:mb-5 md:pt-0">
      <h1 className="text-[20px] leading-[1.3] font-semibold max-md:sr-only">Salom, {name}</h1>
      <p className="hidden text-[13px] text-muted-foreground md:block">{place ? `${company} · ${place}` : company}</p>
      <div data-slot="home-head-phone" className="md:hidden">
        <p className="text-[32px] leading-[1.15] font-bold tracking-[-0.02em]">{company}</p>
        <p className="mt-1 text-md text-muted-foreground">
          {switchable ? (
            <>
              {`${name} · ${role} · `}
              <button
                type="button"
                aria-label={`Lokatsiya: ${place}`}
                aria-haspopup="dialog"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-0.5 rounded font-medium text-accent-text outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {place}
                <ChevronDownIcon aria-hidden="true" strokeWidth={2.2} className="size-4" />
              </button>
            </>
          ) : place ? (
            `${name} · ${role} · ${place}`
          ) : (
            `${name} · ${role}`
          )}
        </p>
      </div>
      {switchable && (
        <ActionSheet
          open={open}
          onOpenChange={setOpen}
          title="Lokatsiya"
          items={locations.map((location) => ({ label: location.name, checked: location.id === current.id, onSelect: () => choose(location.id) }))}
        />
      )}
    </div>
  )
}
