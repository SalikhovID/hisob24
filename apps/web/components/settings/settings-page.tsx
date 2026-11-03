"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { Avatar } from "@/components/kit/avatar"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { PageTitle } from "@/components/kit/page-title"
import { tabIcons } from "@/components/kit/tab-icons"
import { TileIcon } from "@/components/kit/tile-icon"
import { barPages, navFor } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { formatPhone } from "@/lib/phone"
import { useCustomerDropdowns, useCustomerTypes, useMe, useRoles, useOrderStages, useOrderTypes } from "@/lib/queries"
import { roleLabels } from "@/lib/roles"
import { useGate } from "@/lib/use-gate"
import { oldTabHref, settingsHref } from "./use-settings-tab"

// count is how many a part holds, at a row's end, once known.
const count = (items: unknown[] | undefined) => items && <span className="text-muted-foreground">{items.length}</span>

// SettingsPage is the settings page as the prototype's: on a phone
// «Sozlama», the tab bar's last button, with the company and who is signed
// in (the way to the profile), the sections the bar does not hold (each a
// way to it) and the settings; on a wide screen «Sozlamalar», the settings
// alone (the sections are the sidebar's). The settings are each part with
// how many it holds (the customer and order types, the stages, the
// dropdowns; the currency rates and the finance categories; the roles, the
// owner's alone) for the owner or an employee whose role holds
// settings.view, and the choice of the tab bar's pages for everyone. An
// address of the old tabs (/settings?tab=x) leads to the part's page.
export function SettingsPage() {
  const gate = useGate(() => true)
  const me = useMe()
  const settings = gate !== null && can(gate.permissions, "settings.view")
  const companyId = settings ? gate.company.id : null
  const isOwner = gate?.company.role === "owner"
  const customerTypes = useCustomerTypes(companyId)
  const orderTypes = useOrderTypes(companyId)
  const stages = useOrderStages(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const roles = useRoles(isOwner ? companyId : null)
  const router = useRouter()
  const old = oldTabHref(useSearchParams().get("tab"))

  useEffect(() => {
    if (settings && old) router.replace(old)
  }, [settings, old, router])

  if (!gate) return null
  const pins = barPages(gate.permissions, me.data?.tab_bar)
  const pinned = new Set<string>(pins.map((page) => page.href))
  // The sections the bar does not hold: the home and the settings are
  // there always.
  const sections = navFor(gate.permissions).filter((item) => item.key !== "home" && item.key !== "settings" && !pinned.has(item.href))
  const user = me.data?.user
  const name = user ? (user.full_name ?? formatPhone(user.phone)) : null
  const role = gate.company.role === "owner" ? roleLabels.owner : (gate.company.role_name ?? roleLabels.user)

  return (
    <>
      <div data-slot="phone-only" className="md:hidden">
        <PageTitle title="Sozlama" />
        {name && (
          <Group>
            <Row
              href="/profile"
              media={<Avatar name={user?.full_name ?? gate.company.name} />}
              title={gate.company.name}
              sub={`${name} · ${role}`}
            />
          </Group>
        )}
        {sections.length > 0 && (
          <section>
            <SectionHeading>Bo&apos;limlar</SectionHeading>
            <Group label="Bo'limlar">
              {sections.map((item) => {
                const Icon = tabIcons[item.key]
                return (
                  <Row
                    key={item.key}
                    href={item.href}
                    media={
                      <TileIcon>
                        <Icon />
                      </TileIcon>
                    }
                    title={item.label}
                  />
                )
              })}
            </Group>
          </section>
        )}
      </div>
      <div data-slot="web-only" className="hidden md:block">
        <PageTitle title="Sozlamalar" description="Faqat egasi va sozlash ruxsatli xodimlar uchun" />
      </div>
      <section>
        <SectionHeading className="md:hidden">Sozlamalar</SectionHeading>
        <Group label="Sozlamalar">
          {settings && (
            <>
              <Row href={settingsHref("customers")} title="Mijoz turlari" end={count(customerTypes.data)} />
              <Row href={settingsHref("orders")} title="Buyurtma turlari" end={count(orderTypes.data)} />
              <Row href={settingsHref("stages")} title="Bosqichlar" end={count(stages.data)} />
              <Row href={settingsHref("dropdowns")} title="Dropdownlar" end={count(dropdowns.data)} />
              <Row href={settingsHref("currencies")} title="Valyuta kurslari" />
              <Row href={settingsHref("finance")} title="Moliya kategoriyalari" />
              {isOwner && <Row href={settingsHref("roles")} title="Rollar" end={count(roles.data)} />}
            </>
          )}
          <Row href="/settings/tab-bar" title="Pastki panel" />
        </Group>
      </section>
    </>
  )
}
