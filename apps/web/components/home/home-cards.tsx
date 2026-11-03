import { StageBar, StatCard, StatCards } from "@/components/kit/stat-cards"
import { count, formatAmount } from "@/lib/format"
import { colorValues } from "@/lib/stage-colors"
import type { Dashboard, OrderStage } from "@/lib/types"

// som is a sum of so'm as a card shows it: whole, grouped, with the unit.
const som = (amount: string) => `${formatAmount(amount.split(".")[0])} so'm`

// HomeCards are the home's figure cards, as the prototype's: the orders not
// done with a bar of their stages, what the customers owe and how many owe,
// the month's sales and how many, the products running low and the first
// two of them (or that all is enough), each the member's (logic/roles.md,
// section 8) and each leading to its section. The orders, the sales and
// the stock are the current location's: with none, their cards are out.
// month is the month's name ("noyabr").
export function HomeCards({ dashboard, stages, hasLocation, month }: { dashboard: Dashboard; stages: OrderStage[]; hasLocation: boolean; month: string }) {
  const { orders, debtors, sales, low_stock: low } = dashboard
  const cards = []
  if (orders && hasLocation) {
    const bar = orders.by_stage.flatMap((counted) => {
      const stage = stages.find((s) => s.id === counted.stage_id)
      return stage ? [{ name: stage.name, color: colorValues[stage.color], count: counted.count }] : []
    })
    cards.push(
      <StatCard key="orders" href="/orders" label="Faol buyurtmalar" value={orders.active}>
        {bar.length > 0 && <StageBar label="Bosqichlar" stages={bar} />}
      </StatCard>,
    )
  }
  if (debtors) {
    cards.push(<StatCard key="debtors" href="/customers" label="Mijozlar qarzi" value={som(debtors.debt)} sub={`${count(debtors.count)} mijozda`} />)
  }
  if (sales && hasLocation) {
    const label = `${month.charAt(0).toUpperCase()}${month.slice(1)} sotuvlari`
    cards.push(<StatCard key="sales" href="/sales" label={label} value={som(sales.month_total)} sub={`${count(sales.month_count)} sotuv`} />)
  }
  if (low && hasLocation) {
    cards.push(<StatCard key="low" href="/warehouse" label="Kam qolgan tovarlar" value={low.count} sub={low.names.slice(0, 2).join(", ") || "Hammasi yetarli"} />)
  }
  if (cards.length === 0) return null
  return <StatCards>{cards}</StatCards>
}
