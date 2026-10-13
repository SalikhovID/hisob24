"use client"

import { ArrowLeftRightIcon, ClipboardCheckIcon, type LucideIcon, PackagePlusIcon, ReceiptIcon, TruckIcon } from "lucide-react"
import { Group, Row } from "@/components/kit/group"
import { PageTitle } from "@/components/kit/page-title"
import { TileIcon } from "@/components/kit/tile-icon"
import { navItems } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { useGate } from "@/lib/use-gate"

const warehouse = navItems.find((item) => item.key === "warehouse")!
const tabs = warehouse.tabs ?? []

// Each page of the warehouse wears its own tile icon.
const marks: Record<string, { icon: LucideIcon; color: string }> = {
  "/purchases": { icon: ReceiptIcon, color: "#AF52DE" },
  "/transfers": { icon: ArrowLeftRightIcon, color: "#007AFF" },
  "/inventories": { icon: ClipboardCheckIcon, color: "#FF9500" },
  "/opening-stock": { icon: PackagePlusIcon, color: "#34C759" },
  "/suppliers": { icon: TruckIcon, color: "#5856D6" },
}

// WarehouseHub is the warehouse's own page (logic/warehouse.md): its five
// pages are too many for a segmented control, so the section opens at a
// list of them, each a way in, for whoever may see it. Someone who may see
// none is sent home.
export function WarehouseHub() {
  const gate = useGate((me) => tabs.some((tab) => can(me.permissions, tab.permission)))
  if (!gate) return null
  const pages = tabs.filter((tab) => can(gate.permissions, tab.permission))
  return (
    <>
      <PageTitle title="Ombor" description="Xaridlar, qoldiq hujjatlari va ta'minotchilar" />
      <Group label="Ombor bo'limlari" inset="tile">
        {pages.map((tab) => {
          const mark = marks[tab.href]
          return <Row key={tab.href} href={tab.href} media={<TileIcon icon={mark.icon} color={mark.color} />} title={tab.label} />
        })}
      </Group>
    </>
  )
}
