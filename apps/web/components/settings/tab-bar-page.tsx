"use client"

import { CheckIcon, LockIcon, PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { MainBar, MainButton } from "@/components/kit/main-button"
import { PageTitle } from "@/components/kit/page-title"
import { pageIcons, tabIcons } from "@/components/kit/tab-icons"
import { TileIcon } from "@/components/kit/tile-icon"
import { Refusal } from "@/components/refusal"
import { SortableList } from "@/components/sortable-list"
import { Badge } from "@/components/ui/badge"
import { moving } from "@/lib/moves"
import { BAR_LIMIT, barOrder, type NavPage, type PageKey } from "@/lib/nav"
import { useMe, useSetTabBar } from "@/lib/queries"
import type { Me } from "@/lib/types"
import { cn } from "@/lib/utils"

const SettingsMark = tabIcons.settings

// TabBarPage is «Pastki panel», the choice of the tab bar's pages
// (logic/roles.md, section 8), as the prototype's: a picture of the bar,
// «Sozlamalar» locked at its end; every page the member may open in the
// bar's order, the first four on the bar and a line of words before the
// rest. A page is dragged by its handle (or moved with the arrow keys), or
// swapped across the line: ✓ takes it off the bar for the first page past
// it, + puts it on in the last one's place. «Standart holat» puts the
// default bar back; nothing is kept before «Saqlash», which keeps the
// first four (none of the member's own when the default was chosen and
// left so) and goes back to the settings.
export function TabBarPage() {
  const me = useMe()
  return (
    <>
      <PageTitle back={{ href: "/settings", label: "Sozlamalar" }} title="Pastki panel" description={me.data && `${Math.min(BAR_LIMIT, barOrder(me.data.permissions).length)} ta tugmani o'zingizga moslang. Sozlamalar doim oxirida.`} />
      {me.data?.company && <BarEditor me={me.data} />}
    </>
  )
}

// BarEditor is the choice itself: it mounts once the session is known, so
// it starts from the bar as it is.
function BarEditor({ me }: { me: Me }) {
  const router = useRouter()
  const save = useSetTabBar()
  const [order, setKeys] = useState<PageKey[]>(() => barOrder(me.permissions, me.tab_bar).map((page) => page.key))
  // standard: the order is the default one, of nobody's choosing.
  const [standard, setStandard] = useState(me.tab_bar === null)
  const setOrder = (keys: PageKey[]) => {
    setKeys(keys)
    setStandard(false)
  }
  const open = barOrder(me.permissions)
  const pages = order.flatMap((key) => open.find((page) => page.key === key) ?? [])
  const n = Math.min(BAR_LIMIT, pages.length)

  // swap moves a page across the line: off the bar for the first page past
  // it, on the bar in its last page's place.
  const swap = (key: PageKey) => {
    const at = order.indexOf(key)
    const to = at < n ? n : n - 1
    if (to >= order.length || to < 0) {
      toast.error("Almashtirish uchun boshqa sahifa yo'q")
      return
    }
    const next = [...order]
    ;[next[at], next[to]] = [next[to], next[at]]
    setOrder(next)
  }

  return (
    <>
      <Preview pages={pages.slice(0, n)} />
      <SectionHeading hint={`${n} / ${n}`}>Paneldagi tugmalar</SectionHeading>
      <SortableList
        label="Paneldagi tugmalar"
        items={pages}
        getId={(page) => page.key}
        getLabel={(page) => page.label}
        onReorder={(keys) => setOrder(keys as PageKey[])}
        divider={{ before: n, label: "Panelda emas · Sozlamalar sahifasida" }}
        className="mb-6 overflow-hidden rounded-group surface [--inset:56px]"
        renderItem={(page, handle) => <PageItem page={page} handle={handle} on={pages.indexOf(page) < n} onSwap={() => swap(page.key)} />}
      />
      <Group className="-mt-3">
        <li data-slot="row-item">
          <div data-slot="row" className="flex min-h-12 items-center gap-3 px-4">
            <TileIcon>
              <SettingsMark />
            </TileIcon>
            <span className="min-w-0 flex-1 truncate text-base">Sozlamalar</span>
            <Badge>Doim oxirida</Badge>
            <LockIcon aria-hidden="true" strokeWidth={2} className="size-5 text-muted-foreground" />
          </div>
        </li>
      </Group>
      <Group>
        <Row
          variant="accent"
          disabled={standard}
          onClick={() => {
            setKeys(barOrder(me.permissions, null).map((page) => page.key))
            setStandard(true)
          }}
          title="Standart holat"
        />
      </Group>
      <Foot>Tutqichdan sudrab tartibini o&apos;zgartiring yoki ✓ / + tugmasi bilan almashtiring. Panelga sig&apos;magan sahifalar Sozlamalar sahifasida turadi.</Foot>
      {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
      <MainBar>
        <MainButton
          pending={save.isPending}
          onClick={() =>
            save.mutate(standard ? null : order.slice(0, n), {
              onSuccess: () => {
                toast.success("Pastki panel saqlandi")
                moving("back", () => router.push("/settings"))
              },
            })
          }
        >
          Saqlash
        </MainButton>
      </MainBar>
    </>
  )
}

// Preview is the picture of the bar: its pages' marks and names, and
// «Sozlamalar» last, locked, in the hint's grey.
function Preview({ pages }: { pages: NavPage[] }) {
  return (
    <ul aria-label="Ko'rinishi" className="mb-[22px] flex justify-around rounded-[30px] surface px-1.5 py-2">
      {pages.map((page) => {
        const Icon = pageIcons[page.key]
        return <PreviewItem key={page.key} icon={<Icon />} name={page.label} />
      })}
      <PreviewItem icon={<SettingsMark />} name="Sozlamalar" locked />
    </ul>
  )
}

function PreviewItem({ icon, name, locked = false }: { icon: ReactNode; name: string; locked?: boolean }) {
  return (
    <li className={cn("flex w-1/5 min-w-0 flex-col items-center gap-[3px] text-[10.5px] font-medium [&_svg]:size-6", locked ? "text-muted-foreground" : "text-foreground")}>
      {icon}
      <span data-slot="preview-name" className="max-w-full truncate">
        {name}
      </span>
    </li>
  )
}

// PageItem is a page of the choice: its handle, mark and name, and the way
// across the line, ✓ on the bar (the glossy accent), + past it (a glass).
function PageItem({ page, handle, on, onSwap }: { page: NavPage; handle: ReactNode; on: boolean; onSwap: () => void }) {
  const Icon = pageIcons[page.key]
  return (
    <div data-slot="row" className="flex min-h-12 items-center gap-3 pr-2.5 pl-4">
      {handle}
      <TileIcon>
        <Icon />
      </TileIcon>
      <span data-slot="row-title" className="min-w-0 flex-1 truncate text-base">
        {page.label}
      </span>
      <button
        type="button"
        aria-label={on ? `Paneldan olib tashlash: ${page.label}` : `Panelga qo'shish: ${page.label}`}
        onClick={onSwap}
        className={cn(
          "grid size-[34px] shrink-0 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-[17px]",
          on ? "glossy" : "glass-chip text-muted-foreground",
        )}
      >
        {on ? <CheckIcon aria-hidden="true" strokeWidth={2.6} /> : <PlusIcon aria-hidden="true" strokeWidth={2.6} />}
      </button>
    </div>
  )
}
