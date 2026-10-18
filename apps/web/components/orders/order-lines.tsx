"use client"

import { PackageIcon, WrenchIcon } from "lucide-react"
import { Group, KeyValue, Row, SectionHeading } from "@/components/kit/group"
import { SoftIcon } from "@/components/kit/tile-icon"
import { som } from "@/lib/currencies"
import { formatMoney, formatQuantity } from "@/lib/format"
import type { OrderDetail } from "@/lib/types"

// OrderLines is the goods of an order on its page (logic/orders.md, 4.3):
// each product or service with its quantity and, for whoever sees the
// purchases, its FIFO cost in so'm; under them the cost in all and the
// profit or the loss against the price (4.4). An order with no goods
// shows nothing.
export function OrderLines({ order }: { order: OrderDetail }) {
  if (order.items.length === 0) return null
  const costed = order.cost_uzs !== null
  const profit = order.profit_uzs === null ? null : Number(order.profit_uzs)
  return (
    <section aria-label="Mahsulotlar">
      <SectionHeading hint={`${order.items.length} qator`}>Mahsulotlar</SectionHeading>
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
