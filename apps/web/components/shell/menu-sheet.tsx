"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { SectionHeading } from "@/components/kit/group"
import { pageIcons } from "@/components/kit/tab-icons"
import { pageColors, TileIcon } from "@/components/kit/tile-icon"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { navItems, pagesFor, settingsPagesFor } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import type { Me } from "@/lib/types"

// MenuTile is a page as «Sozlama» shows it: its address, name and tile icon.
interface MenuTile {
  href: string
  label: string
  media: ReactNode
}

// MenuSection is a block of tiles: label names it for assistive technology,
// heading shows over it (the sections' only pages stand first, unheaded).
interface MenuSection {
  label: string
  heading?: string
  tiles: MenuTile[]
}

// sectionsOf is the pages someone may open as «Sozlama» shows them: the
// sections' only pages first, then every section with several under its
// name, the settings' pages last (theirs alone: never in the bar).
function sectionsOf(me: Me): MenuSection[] {
  const open = pagesFor(me.permissions)
  const tile = (page: (typeof open)[number]): MenuTile => {
    const Icon = pageIcons[page.key]
    return {
      href: page.href,
      label: page.label,
      media: (
        <TileIcon color={pageColors[page.key]} className="size-10 rounded-[11px] [&_svg]:size-6">
          <Icon />
        </TileIcon>
      ),
    }
  }
  const several = navItems.filter((item) => item.tabs)
  const sections: MenuSection[] = [
    { label: "Bo'limlar", tiles: open.filter((page) => !several.some((item) => item.key === page.section)).map(tile) },
    ...several.map((item) => ({ label: item.label, heading: item.label, tiles: open.filter((page) => page.section === item.key).map(tile) })),
    {
      label: "Sozlamalar",
      heading: "Sozlamalar",
      tiles: settingsPagesFor(me.permissions, me.company?.role === "owner").map((page) => ({
        href: page.href,
        label: page.label,
        media: <TileIcon icon={page.icon} color={page.color} className="size-10 rounded-[11px] [&_svg]:size-[22px]" />,
      })),
    },
  ]
  return sections.filter((section) => section.tiles.length > 0)
}

// MenuSheet is «Sozlama» of the tab bar (as enwin's «⋯»): the pages the
// member may open, as tiles under their sections.
export function MenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void; onCustomize: () => void }) {
  const me = useMe()
  const data = me.data
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Sozlama</DialogTitle>
          {data?.company && <DialogDescription>{data.company.name}</DialogDescription>}
        </DialogHeader>
        {data &&
          sectionsOf(data).map((section) => (
            <section key={section.label} className="mb-5">
              {section.heading && <SectionHeading>{section.heading}</SectionHeading>}
              <ul role="list" aria-label={section.label} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {section.tiles.map((tile) => (
                  <li key={tile.href}>
                    <Link
                      href={tile.href}
                      className="flex h-full min-h-[92px] flex-col items-center justify-center gap-2 rounded-tile bg-card px-1 py-3 text-center text-xs leading-tight font-medium no-underline outline-none transition-transform duration-150 ease-out-expo active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {tile.media}
                      <span className="line-clamp-2">{tile.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </DialogContent>
    </Dialog>
  )
}
