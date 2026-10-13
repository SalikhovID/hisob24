"use client"

import { LockIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { MainBar, MainButton } from "@/components/kit/main-button"
import { PageTitle } from "@/components/kit/page-title"
import { tabIcons } from "@/components/kit/tab-icons"
import { sectionColors, TileIcon } from "@/components/kit/tile-icon"
import { Refusal } from "@/components/refusal"
import { SortableList } from "@/components/sortable-list"
import { ListLoading } from "@/components/states"
import { Badge } from "@/components/ui/badge"
import { BAR_SECTIONS, type NavItem, type NavKey, navFor } from "@/lib/nav"
import { useMe, useSetNavOrder } from "@/lib/queries"
import type { Me } from "@/lib/types"
import { moving } from "@/lib/moves"

// MenuOrderPage is where a member puts the sections in their own order
// (logic/roles.md, section 8), as the prototype's «Pastki menyu»: the home
// locked first, then the sections to drag; the first four stand in the tab
// bar, the rest on the profile page. The sidebar follows the same order. The
// order is the membership's: the same on every device, in this company.
export function MenuOrderPage() {
  const me = useMe()
  return (
    <>
      <PageTitle
        title="Pastki menyu"
        description="Birinchi to'rttasi pastki menyuda turadi, qolganlari profil sahifasida."
        back={{ href: "/profile", label: "Profil" }}
      />
      {me.data ? <OrderForm me={me.data} /> : <ListLoading rows={4} mark="square" />}
    </>
  )
}

// OrderForm starts from the session as it is known, so every visit starts
// from the order as it is now.
function OrderForm({ me }: { me: Me }) {
  const router = useRouter()
  // null is the default order.
  const [order, setOrder] = useState<NavKey[] | null>((me.nav_order as NavKey[] | null) ?? null)
  const items = navFor(me.permissions, order).filter((item) => item.key !== "home")
  const save = useSetNavOrder()
  const HomeIcon = tabIcons.home

  const tile = (item: NavItem) => {
    const Icon = tabIcons[item.key]
    return (
      <TileIcon color={sectionColors[item.key]}>
        <Icon className="size-5" />
      </TileIcon>
    )
  }

  return (
    <>
      <Group inset="tile">
        <Row
          compact
          media={
            <TileIcon color={sectionColors.home}>
              <HomeIcon className="size-5" />
            </TileIcon>
          }
          title="Bosh sahifa"
          end={<LockIcon aria-label="Qulflangan" className="size-[18px] text-muted-foreground" />}
        />
      </Group>
      <SectionHeading hint="Sudrab tartiblang">Bo&apos;limlar</SectionHeading>
      <SortableList
        label="Bo'limlar tartibi"
        items={items}
        getId={(item) => item.key}
        getLabel={(item) => item.label}
        onReorder={(ids) => setOrder(ids as NavKey[])}
        className="mb-6 overflow-hidden rounded-group bg-card [--inset:100px]"
        renderItem={(item, handle) => {
          const index = items.indexOf(item)
          return (
            <>
              {index === BAR_SECTIONS && <div className="bg-background px-4 pt-3.5 pb-1.5 text-xs text-muted-foreground">Profil sahifasida</div>}
              <div data-slot="row" className="flex min-h-12 items-center gap-3 px-4">
                {handle}
                {tile(item)}
                <span data-slot="row-title" className="min-w-0 flex-1 truncate text-base">
                  {item.label}
                </span>
                {index < BAR_SECTIONS && <Badge variant="accent">Menyuda</Badge>}
              </div>
            </>
          )
        }}
      />
      <Group>
        <Row variant="accent" onClick={() => setOrder(null)} disabled={order === null} title="Standart holat" />
      </Group>
      <Foot>Tartib shu kompaniyada hamma qurilmangizda bir xil saqlanadi.</Foot>
      {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
      <MainBar>
        <MainButton
          pending={save.isPending}
          onClick={() =>
            save.mutate(order, {
              onSuccess: () => {
                toast.success("Menyu tartibi saqlandi")
                moving("back", () => router.push("/profile"))
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
