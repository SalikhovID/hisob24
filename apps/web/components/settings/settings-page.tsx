"use client"

import { CoinsIcon, LayersIcon, ListIcon, ShieldIcon, TagIcon, UserIcon, WalletIcon } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"
import { Foot, Group, Row } from "@/components/kit/group"
import { PageTitle } from "@/components/kit/page-title"
import { TileIcon } from "@/components/kit/tile-icon"
import { useCustomerDropdowns, useCustomerTypes, useRoles, useTaskStages, useTaskTypes } from "@/lib/queries"
import { usePermission } from "@/lib/use-gate"
import { oldTabHref, settingsHref } from "./use-settings-tab"

// count is how many a part holds, at a row's end, once known.
const count = (items: unknown[] | undefined) => items && <span className="text-muted-foreground">{items.length}</span>

// SettingsPage is the settings' hub, for the owner or an employee whose
// role holds settings.view, as the prototype's: each part a tile row with
// how many it holds, leading to its page (the customer and task types, the
// stages, the dropdowns; the currency rates and the finance categories);
// the roles, the owner's alone, apart with what they are. An address of
// the old tabs (/settings?tab=x) leads to the part's page.
export function SettingsPage() {
  const gate = usePermission("settings.view")
  const companyId = gate?.company.id ?? null
  const isOwner = gate?.company.role === "owner"
  const customerTypes = useCustomerTypes(companyId)
  const taskTypes = useTaskTypes(companyId)
  const stages = useTaskStages(companyId)
  const dropdowns = useCustomerDropdowns(companyId)
  const roles = useRoles(isOwner ? companyId : null)
  const router = useRouter()
  const old = oldTabHref(useSearchParams().get("tab"))

  useEffect(() => {
    if (gate && old) router.replace(old)
  }, [gate, old, router])

  if (!gate) return null
  return (
    <>
      <PageTitle title="Sozlamalar" description="Mijozlar, vazifalar, valyutalar va moliya sozlamalari" />
      <Group label="Mijozlar va vazifalar" inset="tile">
        <Row href={settingsHref("customers")} media={<TileIcon icon={UserIcon} />} title="Mijoz turlari" end={count(customerTypes.data)} />
        <Row href={settingsHref("tasks")} media={<TileIcon icon={TagIcon} />} title="Vazifa turlari" end={count(taskTypes.data)} />
        <Row href={settingsHref("stages")} media={<TileIcon icon={LayersIcon} />} title="Bosqichlar" end={count(stages.data)} />
        <Row href={settingsHref("dropdowns")} media={<TileIcon icon={ListIcon} />} title="Dropdownlar" end={count(dropdowns.data)} />
      </Group>
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
  )
}
