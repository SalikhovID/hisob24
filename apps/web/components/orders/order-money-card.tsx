"use client"

import { Group, KeyValue, SectionHeading } from "@/components/kit/group"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatMoney } from "@/lib/format"
import type { Order } from "@/lib/types"
import { cn } from "@/lib/utils"

// OrderMoneyCard is an order's money on its page (logic/orders.md, 4.3):
// its price, what was paid for it and what is left (an advance when more
// was paid), in the order's currency. An order with neither a price nor
// a payment shows no card.
export function OrderMoneyCard({ order }: { order: Order }) {
  const currencies = useCurrencies()
  const amount = Number(order.amount)
  const paid = Number(order.paid)
  if (!(amount > 0) && !(paid > 0)) return null
  const currency = currencyOf(currencies, order.currency_id)
  const left = Math.round((amount - paid) * 100) / 100
  return (
    <section aria-label="Pul">
      <SectionHeading>Pul</SectionHeading>
      <Group as="dl">
        <KeyValue label="Narx" value={amount > 0 ? formatMoney(order.amount, currency) : undefined} />
        <KeyValue label="To'langan" value={formatMoney(order.paid, currency)} />
        <KeyValue
          label={left < 0 ? "Avans" : "Qolgan"}
          value={<span className={cn("font-semibold", left > 0 ? "text-destructive" : "text-positive")}>{formatMoney(Math.abs(left).toFixed(2), currency)}</span>}
        />
      </Group>
    </section>
  )
}
