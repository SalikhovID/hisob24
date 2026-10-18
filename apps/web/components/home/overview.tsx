import { CheckIcon, ReceiptIcon, ShoppingBagIcon, UserIcon } from "lucide-react"
import { SectionHeading } from "@/components/kit/group"
import { Bars, Sparkline, StatCard } from "@/components/kit/stat-card"
import { Badge } from "@/components/ui/badge"
import { compactAmount } from "@/lib/format"
import { colorValues } from "@/lib/stage-colors"
import type { Dashboard, OrderStage } from "@/lib/types"

// Overview is the home's «Umumiy holat», as the prototype's cards: the
// orders not done (how many are late, the stages as bars), this month's
// purchases (or, to whoever does not see them, the customers) and sales,
// each a figure with a chart along the bottom and the way to its section.
// The orders and the documents are the current location's: with none, they
// are out. month is the month's name, for the cards' line ("oktabr").
export function Overview({ dashboard, stages, hasLocation, month }: { dashboard: Dashboard; stages: OrderStage[]; hasLocation: boolean; month: string }) {
  const { orders, purchases, sales, customers } = dashboard
  const cards = []
  if (orders && hasLocation) {
    const bars = orders.by_stage.flatMap((count) => {
      const stage = stages.find((s) => s.id === count.stage_id)
      return stage ? [{ label: stage.name, value: count.count, color: colorValues[stage.color] }] : []
    })
    cards.push(
      <StatCard
        key="orders"
        href="/orders"
        icon={CheckIcon}
        title="Buyurtmalar"
        value={String(orders.active)}
        unit="ta faol"
        meta={orders.late > 0 ? <Badge variant="red">{orders.late} kechikkan</Badge> : <Badge variant="green">Vaqtida</Badge>}
        chart={bars.length > 0 && <Bars items={bars} label="Bosqichlar bo'yicha" />}
      />,
    )
  }
  if (purchases && hasLocation) {
    cards.push(
      <StatCard
        key="purchases"
        href="/purchases"
        icon={ReceiptIcon}
        title="Xaridlar"
        value={compactAmount(purchases.month_total)}
        unit="so'm"
        meta={
          <>
            <Badge variant="accent">{purchases.month_count} ta</Badge>
            <span className="font-medium text-muted-foreground">{month}</span>
          </>
        }
        chart={<Sparkline values={purchases.by_day.map(Number)} />}
      />,
    )
  } else if (customers) {
    cards.push(
      <StatCard
        key="customers"
        href="/customers"
        icon={UserIcon}
        title="Mijozlar"
        value={String(customers.total)}
        unit="ta"
        meta={
          <Badge variant="accent">
            +{customers.added_this_month} {month}
          </Badge>
        }
        chart={<Sparkline values={customers.by_day} />}
      />,
    )
  }
  if (sales && hasLocation) {
    cards.push(
      <StatCard
        key="sales"
        href="/sales"
        icon={ShoppingBagIcon}
        title="Sotuv"
        value={compactAmount(sales.month_total)}
        unit="so'm"
        meta={
          <>
            <Badge variant="accent">{sales.month_count} ta</Badge>
            <span className="font-medium text-muted-foreground">{month}</span>
          </>
        }
        chart={<Sparkline values={sales.by_day.map(Number)} />}
      />,
    )
  }
  if (cards.length === 0) return null
  return (
    <>
      <SectionHeading>Umumiy holat</SectionHeading>
      <div className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">{cards}</div>
    </>
  )
}
