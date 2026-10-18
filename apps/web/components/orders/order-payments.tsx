"use client"

import { BanknoteIcon } from "lucide-react"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { SoftIcon } from "@/components/kit/tile-icon"
import { DeletePaymentDialog } from "@/components/warehouse/delete-payment-button"
import { PaymentDialog } from "@/components/warehouse/payment-dialog"
import { currencyOf, useCurrencies, UZS } from "@/lib/currencies"
import { formatDateTime, formatMoney } from "@/lib/format"
import { orderName } from "@/lib/orders"
import type { OrderDetail, OrderPayment } from "@/lib/types"
import type { PaymentFields } from "@/lib/warehouse"

// paymentOf is a payment as the dialog that edits it and the one that
// deletes it take it.
const paymentOf = (p: OrderPayment): PaymentFields => ({ id: p.id, bank_account_id: p.bank_account_id, amount: p.amount, currency_id: p.currency_id, at: p.at, rate: p.rate, note: p.note })

// OrderPayments is the payments entered for an order on its page
// (logic/orders.md, 4.3): the newest first, each its account and moment
// under its amount; a row opens its actions (editing, deleting) for
// whoever may change the order. An order with no payment shows nothing.
export function OrderPayments({ companyId, order, canEdit }: { companyId: number; order: OrderDetail; canEdit: boolean }) {
  const currencies = useCurrencies()
  const [acting, setActing] = useState<OrderPayment | null>(null)
  const [editing, setEditing] = useState<PaymentFields | null>(null)
  const [removing, setRemoving] = useState<PaymentFields | null>(null)
  if (order.payments.length === 0) return null
  const dialog = { party: "customer" as const, companyId, partyId: order.customer.id, orderId: order.id }
  return (
    <section aria-label="To'lovlar">
      <SectionHeading hint={`${order.payments.length} ta`}>To&apos;lovlar</SectionHeading>
      <Group label="To'lovlar" inset="icon">
        {order.payments.map((p) => {
          const currency = currencyOf(currencies, p.currency_id)
          const sub = [p.account_name, formatDateTime(p.at), p.currency_id !== UZS ? formatMoney(p.amount_uzs, currencyOf(currencies, UZS)) : null, p.note]
          return (
            <Row
              key={p.id}
              onClick={canEdit ? () => setActing(p) : undefined}
              media={<SoftIcon icon={BanknoteIcon} color="var(--positive)" />}
              title={p.created_by_name ?? "To'lov"}
              sub={sub.filter(Boolean).join(" · ")}
              end={<span className="tabular-nums text-positive">{formatMoney(p.amount, currency)}</span>}
              chevron={false}
            />
          )
        })}
      </Group>
      <ActionSheet
        open={acting !== null}
        onOpenChange={(open) => !open && setActing(null)}
        title={acting ? `To'lov · ${formatMoney(acting.amount, currencyOf(currencies, acting.currency_id))}` : undefined}
        items={
          acting
            ? [
                { label: "Tahrirlash", onSelect: () => setEditing(paymentOf(acting)) },
                { label: "O'chirish", danger: true, onSelect: () => setRemoving(paymentOf(acting)) },
              ]
            : []
        }
      />
      {editing && <PaymentDialog {...dialog} partyName={orderName(order.number)} payment={editing} open onOpenChange={(open) => !open && setEditing(null)} />}
      {removing && <DeletePaymentDialog {...dialog} payment={removing} open onOpenChange={(open) => !open && setRemoving(null)} />}
    </section>
  )
}
