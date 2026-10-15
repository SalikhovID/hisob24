"use client"

import { CircleMinusIcon, CirclePlusIcon } from "lucide-react"
import { useState } from "react"
import { Group, SectionHeading } from "@/components/kit/group"
import { pageIcons } from "@/components/kit/tab-icons"
import { pageColors, TileIcon } from "@/components/kit/tile-icon"
import { SortableList } from "@/components/sortable-list"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BAR_LIMIT, barPages, type NavPage, type PageKey, pageGroups, pagesFor } from "@/lib/nav"
import { useMe } from "@/lib/queries"
import type { Me } from "@/lib/types"

// tile is a page's tile icon, as the bar's button wears it.
function tile(page: NavPage) {
  const Icon = pageIcons[page.key]
  return (
    <TileIcon color={pageColors[page.key]}>
      <Icon className="size-5" />
    </TileIcon>
  )
}

// TabBarSheet is «Pastki panel» (enwin's «Panelni sozlash»): the choice of
// the tab bar's pages (logic/roles.md, section 8). On top, the bar's pages
// in their order; under «Qo'shish», the rest of the pages the member may
// open, under their sections.
export function TabBarSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const me = useMe()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Pastki panel</DialogTitle>
          <DialogDescription>Panelda 4 tagacha sahifa turadi, qolganlari «Sozlama» ichida. Tartibini tutqichdan sudrab o&apos;zgartiring.</DialogDescription>
        </DialogHeader>
        {me.data && <BarForm me={me.data} />}
      </DialogContent>
    </Dialog>
  )
}

// BarForm is the open sheet's choice: it mounts with every opening (the
// closed sheet holds nothing), so each one starts from the bar as it is.
function BarForm({ me }: { me: Me }) {
  const [draft] = useState<PageKey[]>(() => barPages(me.permissions, me.tab_bar).map((page) => page.key))
  const open = pagesFor(me.permissions)
  const pinned = draft.flatMap((key) => open.find((page) => page.key === key) ?? [])
  const rest = open.filter((page) => !draft.includes(page.key))

  return (
    <>
      <SectionHeading>
        Panelda · {pinned.length}/{BAR_LIMIT}
      </SectionHeading>
      <SortableList
        label="Panelda"
        items={pinned}
        getId={(page) => page.key}
        getLabel={(page) => page.label}
        onReorder={() => {}}
        className="mb-6 overflow-hidden rounded-group bg-card [--inset:100px]"
        renderItem={(page, handle) => (
          <div data-slot="row" className="flex min-h-12 items-center gap-3 pr-1 pl-4">
            {handle}
            {tile(page)}
            <span data-slot="row-title" className="min-w-0 flex-1 truncate text-base">
              {page.label}
            </span>
            <button type="button" aria-label={`Olib tashlash: ${page.label}`} className="grid size-11 shrink-0 place-items-center text-destructive">
              <CircleMinusIcon aria-hidden="true" className="size-[22px]" />
            </button>
          </div>
        )}
      />
      <SectionHeading>Qo&apos;shish</SectionHeading>
      {pageGroups(rest).map((group) => (
        <div key={group.label}>
          {group.heading && <p className="px-4 pb-1.5 text-xs text-muted-foreground uppercase">{group.heading}</p>}
          <Group label={group.label} inset="tile">
            {group.pages.map((page) => (
              <li key={page.key} data-slot="row-item">
                <div data-slot="row" className="flex min-h-12 items-center gap-3 pr-1 pl-4">
                  {tile(page)}
                  <span data-slot="row-title" className="min-w-0 flex-1 truncate text-base">
                    {page.label}
                  </span>
                  <button type="button" aria-label={`Qo'shish: ${page.label}`} className="grid size-11 shrink-0 place-items-center text-primary">
                    <CirclePlusIcon aria-hidden="true" className="size-[22px]" />
                  </button>
                </div>
              </li>
            ))}
          </Group>
        </div>
      ))}
    </>
  )
}
