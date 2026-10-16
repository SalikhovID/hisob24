"use client"

import { Group, Row } from "@/components/kit/group"
import { PageTitle } from "@/components/kit/page-title"
import { pageIcons } from "@/components/kit/tab-icons"
import { TileIcon } from "@/components/kit/tile-icon"
import { navItems } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { useGate } from "@/lib/use-gate"

const warehouse = navItems.find((item) => item.key === "warehouse")!
const tabs = warehouse.tabs ?? []

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
          // Each page wears its own mark, the tab bar's.
          const Icon = pageIcons[tab.key]
          return (
            <Row
              key={tab.href}
              href={tab.href}
              media={
                <TileIcon>
                  <Icon />
                </TileIcon>
              }
              title={tab.label}
            />
          )
        })}
      </Group>
    </>
  )
}
