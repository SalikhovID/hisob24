"use client"

import { ChevronRightIcon, CoinsIcon, LayersIcon, ListIcon, ShieldIcon, SlidersHorizontalIcon, TagIcon, UserIcon, WalletIcon } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { PageTitle } from "@/components/kit/page-title"
import { pageIcons } from "@/components/kit/tab-icons"
import { TileIcon } from "@/components/kit/tile-icon"
import { Badge } from "@/components/ui/badge"
import { moveTo } from "@/lib/moves"
import { barPages, type NavPage, pageGroups, pagesFor } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { useCustomerDropdowns, useCustomerTypes, useMe, useRoles, useTaskStages, useTaskTypes } from "@/lib/queries"
import { useGate } from "@/lib/use-gate"
import { oldTabHref, settingsHref } from "./use-settings-tab"

// count is how many a part holds, at a row's end, once known.
const count = (items: unknown[] | undefined) => items && <span className="text-muted-foreground">{items.length}</span>

// SettingsPage is «Sozlamalar», the tab bar's last button, as the
// prototype's: every page the member may open, in its block (the sections'
// only pages, then the products, the warehouse and the finance), each a way
// to it, those the tab bar holds marked on a phone; under them, on a phone,
// the way to the choice of the bar's pages; then, for the owner or an
// employee whose role holds settings.view, the settings: each part a tile
// row with how many it holds (the customer and task types, the stages, the
// dropdowns; the currency rates and the finance categories), the roles,
// the owner's alone, apart with what they are. An address of the old tabs
// (/settings?tab=x) leads to the part's page.
export function SettingsPage() {
  const gate = useGate(() => true)
  const me = useMe()
  const settings = gate !== null && can(gate.permissions, "settings.view")
  const companyId = settings ? gate.company.id : null
  const isOwner = gate?.company.role === "owner"
  const customerTypes = useCustomerTypes(companyId)
  const taskTypes = useTaskTypes(companyId)
  const stages = useTaskStages(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const roles = useRoles(isOwner ? companyId : null)
  const router = useRouter()
  const old = oldTabHref(useSearchParams().get("tab"))

  useEffect(() => {
    if (settings && old) router.replace(old)
  }, [settings, old, router])

  if (!gate) return null
  const pins = barPages(gate.permissions, me.data?.tab_bar)
  const pinned = new Set(pins.map((page) => page.key))
  return (
    <>
      <PageTitle title="Sozlamalar" description="Barcha bo'limlar va sozlamalar" />
      {pageGroups(pagesFor(gate.permissions)).map((group) => (
        <section key={group.label}>
          <SectionHeading>{group.heading ?? group.label}</SectionHeading>
          <Group label={group.label} inset="tile">
            {group.pages.map((page) => (
              <PageRow key={page.key} page={page} pinned={pinned.has(page.key)} />
            ))}
          </Group>
        </section>
      ))}
      <BarCard pins={pins} />
      {settings && (
        <>
          <SectionHeading>Mijozlar va vazifalar</SectionHeading>
          <Group label="Mijozlar va vazifalar" inset="tile">
            <Row href={settingsHref("customers")} media={<TileIcon icon={UserIcon} />} title="Mijoz turlari" end={count(customerTypes.data)} />
            <Row href={settingsHref("tasks")} media={<TileIcon icon={TagIcon} />} title="Vazifa turlari" end={count(taskTypes.data)} />
            <Row href={settingsHref("stages")} media={<TileIcon icon={LayersIcon} />} title="Bosqichlar" end={count(stages.data)} />
            <Row href={settingsHref("dropdowns")} media={<TileIcon icon={ListIcon} />} title="Dropdownlar" end={count(dropdowns.data)} />
          </Group>
          <SectionHeading>Valyuta va moliya</SectionHeading>
          <Group label="Valyuta va moliya" inset="tile">
            <Row href={settingsHref("currencies")} media={<TileIcon icon={CoinsIcon} />} title="Valyuta kurslari" />
            <Row href={settingsHref("finance")} media={<TileIcon icon={WalletIcon} />} title="Moliya kategoriyalari" />
          </Group>
          {isOwner && (
            <>
              <Group label="Rollar" inset="tile">
                <Row href={settingsHref("roles")} media={<TileIcon icon={ShieldIcon} />} title="Rollar" end={count(roles.data)} />
              </Group>
              <Foot className="-mt-4">Rol xodimga qaysi bo&apos;limlarda nima qilishi mumkinligini belgilaydi. Rollar faqat kompaniya egasiga ko&apos;rinadi.</Foot>
            </>
          )}
        </>
      )}
    </>
  )
}

// PageRow is a page of the menu: its mark and name, the way to it; on a
// phone, «Panelda» when the tab bar holds it.
function PageRow({ page, pinned }: { page: NavPage; pinned: boolean }) {
  const Icon = pageIcons[page.key]
  return (
    <Row
      href={page.href}
      media={
        <TileIcon>
          <Icon />
        </TileIcon>
      }
      title={page.label}
      end={pinned ? <Badge className="md:hidden">Panelda</Badge> : undefined}
    />
  )
}

// BarCard is the way to the choice of the tab bar's pages, on a phone (a
// wide screen has no bar): the prototype's card of frosted glass with the
// glossy sliders, its name and the bar's pages under it.
function BarCard({ pins }: { pins: NavPage[] }) {
  return (
    <Link
      href="/settings/tab-bar"
      onClick={() => moveTo("forward")}
      className="-mt-2.5 mb-6 flex items-center gap-3.5 rounded-[24px] surface px-4 py-3.5 text-left no-underline outline-none transition-transform duration-150 ease-out-expo active:scale-[.98] focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
    >
      <span aria-hidden="true" className="grid size-[42px] shrink-0 place-items-center rounded-[14px] glossy">
        <SlidersHorizontalIcon strokeWidth={2} className="size-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-base font-semibold">Pastki panelni sozlash</b>{" "}
        <small className="mt-0.5 block truncate text-[13.5px] text-muted-foreground">{pins.map((page) => page.label).join(" · ")}</small>
      </span>
      <ChevronRightIcon aria-hidden="true" strokeWidth={2.6} className="size-[18px] shrink-0 text-muted-foreground opacity-60" />
    </Link>
  )
}
