"use client"

import { MainButton } from "@/components/kit/main-button"
import { StatCard, StatCards } from "@/components/kit/stat-cards"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatMoney } from "@/lib/format"
import type { Order } from "@/lib/types"

// OrderMoneyCard is an order's money on its page (logic/orders.md, 4.3), as
// the prototype's figure cards: its price, what was paid for it and what is
// left (red), or the advance when more was paid (green), in the order's
// currency; under them, to whoever may take a payment (onPay), the button
// that takes what is left. An order with neither a price nor a payment
// shows none of it.
export function OrderMoneyCard({ order, onPay }: { order: Order; onPay?: () => void }) {
  const currencies = useCurrencies()
  const amount = Number(order.amount)
  const paid = Number(order.paid)
  if (!(amount > 0) && !(paid > 0)) return null
  const currency = currencyOf(currencies, order.currency_id)
  const left = Math.round((amount - paid) * 100) / 100
  const rest = formatMoney(Math.abs(left).toFixed(2), currency)
  return (
    <section aria-label="Pul" className="mb-4">
      <StatCards three className="mb-3">
        <StatCard label="Narx" value={amount > 0 ? formatMoney(order.amount, currency) : "—"} />
        <StatCard label="To'langan" value={formatMoney(order.paid, currency)} />
        <StatCard label={left < 0 ? "Avans" : "Qoldiq"} value={rest} tone={left > 0 ? "red" : left < 0 ? "green" : undefined} />
      </StatCards>
      {left > 0 && onPay && <MainButton onClick={onPay}>{`${rest} qabul qilish`}</MainButton>}
    </section>
  )
}
