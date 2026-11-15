"use client"

import { PackageIcon, PlusIcon, WrenchIcon } from "lucide-react"
import { Group, KeyValue, Row, SectionHeading } from "@/components/kit/group"
import { SoftIcon } from "@/components/kit/tile-icon"
import { EmptyState } from "@/components/states"
import { som } from "@/lib/currencies"
import { formatMoney, formatQuantity } from "@/lib/format"
import type { OrderDetail } from "@/lib/types"

// OrderLines is the goods of an order on its page (logic/orders.md, 4.3):
// each product or service with its quantity and, for whoever sees the
// purchases, its FIFO cost in so'm; under them the cost in all and the
// profit or the loss against the price (4.4). An order with no goods says
// there are none (its tab stands always, 2026-11-15); with onAdd, a row under
// them adds a product or a service.
export function OrderLines({ order, onAdd }: { order: OrderDetail; onAdd?: () => void }) {
  const costed = order.items.length > 0 && order.cost_uzs !== null
  const profit = order.profit_uzs === null ? null : Number(order.profit_uzs)
  return (
    <section aria-label="Mahsulotlar">
      <SectionHeading hint={`${order.items.length} qator`}>Mahsulotlar</SectionHeading>
      {order.items.length === 0 ? (
        <EmptyState icon={PackageIcon} title="Tovar yo'q" />
      ) : (
        <Group label="Mahsulotlar" inset="icon">
          {order.items.map((line) => (
            <Row
              key={line.product_id}
              media={<SoftIcon icon={line.kind === "service" ? WrenchIcon : PackageIcon} />}
              title={line.name}
              sub={formatQuantity(line.quantity, line.unit)}
              end={costed && line.cost_uzs !== null ? <span className="tabular-nums">{formatMoney(line.cost_uzs, som)}</span> : undefined}
              chevron={false}
            />
          ))}
        </Group>
      )}
      {onAdd && (
        <Group className="mb-3.5">
          <Row
            variant="link"
            onClick={onAdd}
            title={
              <span className="flex items-center gap-2">
                <PlusIcon aria-hidden="true" strokeWidth={2.6} className="size-5" />
                Tovar qo&apos;shish
              </span>
            }
          />
        </Group>
      )}
      {costed && (
        <Group as="dl">
          <KeyValue label="Tan narxi" value={formatMoney(order.cost_uzs!, som)} />
          {profit !== null && (
            <KeyValue
              label={profit < 0 ? "Zarar" : "Foyda"}
              value={<span className={profit < 0 ? "font-semibold text-destructive" : "font-semibold text-positive"}>{formatMoney(Math.abs(profit).toFixed(2), som)}</span>}
            />
          )}
        </Group>
      )}
    </section>
  )
}
