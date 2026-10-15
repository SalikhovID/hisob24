"use client"

import { PinIcon, SlidersHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type ReactNode, useId, useState } from "react"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { SearchBox } from "@/components/kit/search-box"
import { pageIcons } from "@/components/kit/tab-icons"
import { pageColors, TileIcon } from "@/components/kit/tile-icon"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { barPages, type NavPage, pageGroups, pagesFor, settingsPagesFor } from "@/lib/nav"
import { moveTo } from "@/lib/moves"
import { useMe } from "@/lib/queries"
import type { Me } from "@/lib/types"
import { cn, norm } from "@/lib/utils"

// MenuTile is a page as «Sozlama» shows it: its address, name and tile
// icon, and whether it stands in the tab bar.
interface MenuTile {
  href: string
  label: string
  media: ReactNode
  pinned?: boolean
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
  const pins = new Set(barPages(me.permissions, me.tab_bar).map((page) => page.key))
  const tile = (page: NavPage): MenuTile => {
    const Icon = pageIcons[page.key]
    return {
      href: page.href,
      label: page.label,
      pinned: pins.has(page.key),
      media: (
        <TileIcon color={pageColors[page.key]} className="size-10 rounded-[11px] [&_svg]:size-6">
          <Icon />
        </TileIcon>
      ),
    }
  }
  const sections: MenuSection[] = [
    ...pageGroups(open).map((group) => ({ label: group.label, heading: group.heading, tiles: group.pages.map(tile) })),
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
// member may open, as tiles under their sections, the page's own marked
// and the bar's pages pinned, with a search over their names. A page
// chosen closes it and is switched to at once, as from the bar. Under them
// stands the way to choose the bar's pages (onCustomize).
export function MenuSheet({ open, onOpenChange, onCustomize }: { open: boolean; onOpenChange: (open: boolean) => void; onCustomize: () => void }) {
  const me = useMe()
  const data = me.data
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Sozlama</DialogTitle>
          {data?.company && <DialogDescription>{data.company.name}</DialogDescription>}
        </DialogHeader>
        {data && <MenuBody me={data} onClose={() => onOpenChange(false)} />}
        <Group className="mt-1 mb-0">
          <Row onClick={onCustomize} media={<TileIcon icon={SlidersHorizontalIcon} color="#8E8E93" />} title="Pastki panelni sozlash" />
        </Group>
      </DialogContent>
    </Dialog>
  )
}

// MenuBody is the open sheet's search and tiles: it mounts with every
// opening (the closed sheet holds nothing), so each one starts unsearched.
function MenuBody({ me, onClose }: { me: Me; onClose: () => void }) {
  const pathname = usePathname()
  const pinHint = useId()
  const [query, setQuery] = useState("")
  const sections = sectionsOf(me)
    .map((section) => ({ ...section, tiles: section.tiles.filter((tile) => norm(tile.label).includes(norm(query))) }))
    .filter((section) => section.tiles.length > 0)
  return (
    <>
      <span id={pinHint} hidden>
        Pastki panelda
      </span>
      <SearchBox value={query} onSearch={setQuery} placeholder="Sahifani qidirish" delay={0} />
      {sections.length === 0 && <p className="py-10 text-center text-md text-muted-foreground">Hech narsa topilmadi</p>}
      {sections.map((section) => (
        <section key={section.label} className="mb-5">
          {section.heading && <SectionHeading>{section.heading}</SectionHeading>}
          <ul role="list" aria-label={section.label} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {section.tiles.map((tile) => {
              const current = tile.href === pathname
              return (
                <li key={tile.href}>
                  <Link
                    href={tile.href}
                    aria-current={current ? "page" : undefined}
                    aria-describedby={tile.pinned ? pinHint : undefined}
                    onClick={() => {
                      // A page from «Sozlama» is switched to at once (lib/moves.ts).
                      moveTo(undefined)
                      onClose()
                    }}
                    className={cn(
                      "relative flex h-full min-h-[92px] flex-col items-center justify-center gap-2 rounded-tile bg-card px-1 py-3 text-center text-xs leading-tight font-medium no-underline outline-none transition-transform duration-150 ease-out-expo active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50",
                      current && "bg-primary-soft text-primary",
                    )}
                  >
                    {tile.pinned && <PinIcon aria-hidden="true" strokeWidth={2.2} className="absolute top-2 right-2 size-3.5 text-muted-foreground" />}
                    {tile.media}
                    <span className="line-clamp-2">{tile.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
