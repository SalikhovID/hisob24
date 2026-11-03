"use client"

import { Menu } from "@base-ui/react/menu"
import { ArrowLeftIcon, BellIcon, CheckIcon, ChevronDownIcon, MapPinIcon } from "lucide-react"
import Link from "next/link"
import { useBackTarget } from "@/components/kit/back-target"
import { moveTo } from "@/lib/moves"
import { useLocation } from "@/lib/use-location"

// A menu of the bar: a floating white card of 30px rows, at the right under
// what opened it.
const popup = "z-50 min-w-[200px] rounded-lg bg-popover p-1 text-[13px] text-foreground shadow-float outline-none"

// TopBar stands over the page on a wide screen, as the prototype's web
// view: a 52px bar with a faint hairline under it. At its left «← Orqaga»,
// in grey, where the page's own way back leads (a phone's link, hidden
// here); at its right the location menu (two locations or more) and the
// bell, which says there are no notifications yet. The theme is the
// profile's to choose and the way out the sidebar's.
export function TopBar() {
  const back = useBackTarget()
  return (
    <div data-slot="top-bar" className="hidden h-[52px] shrink-0 items-center gap-2 border-b border-line-faint px-6 md:flex md:h-[calc(52px+var(--safe-top))] md:pt-safe">
      {back && (
        <Link
          href={back.href}
          onClick={() => moveTo("back")}
          className="inline-flex h-[30px] items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground no-underline outline-none hover:bg-ink-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeftIcon aria-hidden="true" strokeWidth={2} className="size-4" />
          Orqaga
        </Link>
      )}
      <span className="flex-1" />
      <LocationMenu />
      <Bell />
    </div>
  )
}

// LocationMenu is the way from one location to another (logic/locations.md,
// section 4) on a wide screen, as the prototype's: a ringed pill that says
// the current one and opens a menu of the ones the member may work in, the
// current one in the accent. It shows only when there are two or more.
function LocationMenu() {
  const { locations, current, choose } = useLocation()
  if (locations.length < 2 || !current) return null
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Lokatsiya: ${current.name}`}
        data-slot="location-pill"
        className="inline-flex h-[30px] max-w-[260px] items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium shadow-[0_0_0_1px_var(--border)] outline-none hover:bg-ink-1 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <MapPinIcon aria-hidden="true" strokeWidth={1.8} className="size-[15px] shrink-0 text-icon" />
        <span className="min-w-0 truncate">{current.name}</span>
        <ChevronDownIcon aria-hidden="true" strokeWidth={1.8} className="size-3.5 shrink-0 text-icon" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6}>
          <Menu.Popup className={popup}>
            <Menu.RadioGroup value={current.id} onValueChange={(id) => choose(Number(id))}>
              {locations.map((location) => (
                <Menu.RadioItem
                  key={location.id}
                  value={location.id}
                  className="flex h-[30px] cursor-default items-center gap-2 rounded-md px-2.5 outline-none data-highlighted:bg-ink-1 data-checked:font-medium data-checked:text-accent-text"
                >
                  <span className="min-w-0 flex-1 truncate">{location.name}</span>
                  <Menu.RadioItemIndicator>
                    <CheckIcon aria-hidden="true" strokeWidth={2} className="size-3.5" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

// Bell is the prototype's bell: there are no notifications in the app yet,
// and its menu says so.
function Bell() {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Bildirishnomalar"
        className="grid size-[30px] place-items-center rounded-lg text-icon outline-none hover:bg-ink-1 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BellIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6}>
          <Menu.Popup className={popup}>
            <Menu.Item disabled className="px-2.5 py-2 text-muted-foreground">
              Bildirishnomalar hozircha yo&apos;q
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
