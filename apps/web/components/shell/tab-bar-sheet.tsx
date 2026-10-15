"use client"

import { CircleMinusIcon, CirclePlusIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Foot, Group, SectionHeading } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { pageIcons } from "@/components/kit/tab-icons"
import { pageColors, TileIcon } from "@/components/kit/tile-icon"
import { SortableList } from "@/components/sortable-list"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BAR_LIMIT, barPages, type NavPage, type PageKey, pageGroups, pagesFor } from "@/lib/nav"
import { useMe, useSetTabBar } from "@/lib/queries"
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
// in their order, each with the way out; under «Qo'shish», the rest of the
// pages the member may open, under their sections, each with the way in
// while the bar has room. Nothing is kept before «Saqlash»: the member's
// own, on every device in this company.
export function TabBarSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const me = useMe()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Pastki panel</DialogTitle>
          <DialogDescription>Panelda 4 tagacha sahifa turadi, qolganlari «Sozlama» ichida. Tartibini tutqichdan sudrab o&apos;zgartiring.</DialogDescription>
        </DialogHeader>
        {me.data && <BarForm me={me.data} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

// BarForm is the open sheet's choice: it mounts with every opening (the
// closed sheet holds nothing), so each one starts from the bar as it is.
function BarForm({ me, onDone }: { me: Me; onDone: () => void }) {
  const [draft, setDraft] = useState<PageKey[]>(() => barPages(me.permissions, me.tab_bar).map((page) => page.key))
  const open = pagesFor(me.permissions)
  const pinned = draft.flatMap((key) => open.find((page) => page.key === key) ?? [])
  const rest = open.filter((page) => !draft.includes(page.key))
  const full = pinned.length >= BAR_LIMIT
  const save = useSetTabBar()

  return (
    <>
      <SectionHeading>
        Panelda · {pinned.length}/{BAR_LIMIT}
      </SectionHeading>
      {pinned.length === 0 ? (
        <Foot className="rounded-group bg-card py-3.5 text-md">Panelda sahifa yo&apos;q — pastdagi ro&apos;yxatdan qo&apos;shing.</Foot>
      ) : (
        <SortableList
          label="Panelda"
          items={pinned}
          getId={(page) => page.key}
          getLabel={(page) => page.label}
          onReorder={(keys) => setDraft(keys as PageKey[])}
          className="mb-6 overflow-hidden rounded-group bg-card [--inset:100px]"
          renderItem={(page, handle) => (
            <div data-slot="row" className="flex min-h-12 items-center gap-3 pr-1 pl-4">
              {handle}
              {tile(page)}
              <span data-slot="row-title" className="min-w-0 flex-1 truncate text-base">
                {page.label}
              </span>
              <button
                type="button"
                aria-label={`Olib tashlash: ${page.label}`}
                onClick={() => setDraft((keys) => keys.filter((key) => key !== page.key))}
                className="grid size-11 shrink-0 place-items-center text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <CircleMinusIcon aria-hidden="true" className="size-[22px]" />
              </button>
            </div>
          )}
        />
      )}
      <SectionHeading>Qo&apos;shish</SectionHeading>
      {full && <Foot>Ko&apos;pi bilan 4 ta sahifa — yangisini qo&apos;shish uchun avval birini olib tashlang.</Foot>}
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
                  <button
                    type="button"
                    aria-label={`Qo'shish: ${page.label}`}
                    disabled={full}
                    onClick={() => setDraft((keys) => (keys.length < BAR_LIMIT ? [...keys, page.key] : keys))}
                    className="grid size-11 shrink-0 place-items-center text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-35"
                  >
                    <CirclePlusIcon aria-hidden="true" className="size-[22px]" />
                  </button>
                </div>
              </li>
            ))}
          </Group>
        </div>
      ))}
      <DialogFooter>
        <MainButton
          pending={save.isPending}
          onClick={() =>
            save.mutate(draft, {
              onSuccess: () => {
                toast.success("Pastki panel saqlandi")
                onDone()
              },
            })
          }
        >
          Saqlash
        </MainButton>
      </DialogFooter>
    </>
  )
}
