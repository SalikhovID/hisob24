"use client"

import { Group, Row } from "@/components/kit/group"
import { PageTitle } from "@/components/kit/page-title"
import { pageIcons } from "@/components/kit/tab-icons"
import { TileIcon } from "@/components/kit/tile-icon"
import { navItems } from "@/lib/nav"
import { can } from "@/lib/permissions"
import { useGate } from "@/lib/use-gate"
import { cn } from "@/lib/utils"
import { StockSummary } from "./stock-summary"

const warehouse = navItems.find((item) => item.key === "warehouse")!
const tabs = warehouse.tabs ?? []

// WarehouseHub is the warehouse's own page (logic/warehouse.md, section 5):
// to whoever sees the stock its «Qoldiq» table; its five parts a list of
// ways in, for whoever may see them (on the web the sidebar names them under
// the section, so there the list stands alone only without the table).
// Someone who may see none is sent home.
export function WarehouseHub() {
  const gate = useGate((me) => tabs.some((tab) => can(me.permissions, tab.permission)))
  if (!gate) return null
  const pages = tabs.filter((tab) => can(gate.permissions, tab.permission))
  const seesStock = can(gate.permissions, "stock.view")
  return (
    <>
      <PageTitle title="Ombor" description="Qoldiq, xaridlar, qoldiq hujjatlari va ta'minotchilar" />
      <div data-slot="warehouse-parts" className={cn(seesStock && "md:hidden")}>
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
      </div>
      {seesStock && <StockSummary companyId={gate.company.id} />}
    </>
  )
}
