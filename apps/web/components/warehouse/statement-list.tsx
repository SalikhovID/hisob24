"use client"

import { BanknoteIcon, type LucideIcon, ReceiptIcon, ScaleIcon, ShoppingBagIcon } from "lucide-react"
import { useState } from "react"
import { ActionSheet } from "@/components/kit/action-sheet"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { SoftIcon } from "@/components/kit/tile-icon"
import { Pager } from "@/components/pager"
import { Failed, ListLoading } from "@/components/states"
import { currencyOf, useCurrencies, UZS } from "@/lib/currencies"
import { formatAmount, formatDateTime, formatMoney } from "@/lib/format"
import type { Party } from "@/lib/party"
import { useCustomerStatement, useStatement } from "@/lib/queries"
import { type OpeningFields, openingOfRow } from "@/lib/stock"
import type { StatementRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { type PaymentFields, paymentOfRow } from "@/lib/warehouse"
import { DeleteOpeningDialog } from "./delete-opening-button"
import { DeletePaymentDialog } from "./delete-payment-button"
import { OpeningDialog } from "./opening-dialog"
import { PaymentDialog } from "./payment-dialog"

const isOpening = (row: StatementRow) =>
  row.kind === "supplier_debt" || row.kind === "supplier_prepay" || row.kind === "customer_debt" || row.kind === "customer_prepay"
const isPayment = (row: StatementRow) => row.kind === "supplier_payment" || row.kind === "customer_payment"

// titleOf says what a row is: a purchase or a sale by its number, a payment
// (with the document it was entered with), an opening balance.
function titleOf(row: StatementRow): string {
  switch (row.kind) {
    case "purchase":
      return `Xarid № ${row.number}`
    case "sale":
      return `Sotuv № ${row.number}`
    case "supplier_payment":
      return row.linked_id === null ? "To'lov" : `To'lov · Xarid № ${row.linked_number}`
    case "customer_payment":
      return row.linked_id === null ? "To'lov" : `To'lov · Sotuv № ${row.linked_number}`
    case "supplier_debt":
    case "customer_debt":
      return "Boshlang'ich qarz"
    case "supplier_prepay":
    case "customer_prepay":
      return "Boshlang'ich avans"
  }
}

// hrefOf is where a document's row leads: a purchase or a sale to itself,
// a payment entered with one to that one; the rest are handled in a sheet.
function hrefOf(row: StatementRow): string | undefined {
  if (row.kind === "purchase") return `/purchases/${row.id}`
  if (row.kind === "sale") return `/sales/${row.id}`
  if (isPayment(row) && row.linked_id !== null) return row.kind === "supplier_payment" ? `/purchases/${row.linked_id}` : `/sales/${row.linked_id}`
  return undefined
}

// iconOf is a row's soft icon: a document in the accent, a payment in
// green, an opening balance in the warning's color.
function iconOf(row: StatementRow): { icon: LucideIcon; color?: string } {
  if (row.kind === "purchase") return { icon: ReceiptIcon }
  if (row.kind === "sale") return { icon: ShoppingBagIcon }
  if (isPayment(row)) return { icon: BanknoteIcon, color: "var(--positive)" }
  return { icon: ScaleIcon, color: "var(--warning)" }
}

// StatementList is a party's statement, on its page: a supplier's
// (logic/warehouse.md, section 6) or a customer's (logic/sales.md, section
// 5), as the prototype's rows: every live document in time, the newest
// first, its moment and account (its amount too when not in so'm) under its
// name, how it changed what is owed (in so'm, red when it grew, green when
// it shrank) and what was owed after it at its end. A purchase or a sale,
// and a payment entered with one, lead to that document; a payment or an
// opening balance entered on its own opens a sheet of its actions (editing,
// deleting); the heading adds an opening balance. A payment is the page's
// own tile.
export function StatementList({
  party,
  companyId,
  partyId,
  canAdd,
  canEdit,
  canDelete,
}: {
  party: Party
  companyId: number
  partyId: number
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}) {
  const [page, setPage] = useState(1)
  const suppliers = useStatement(party === "supplier" ? companyId : null, partyId, page)
  const customers = useCustomerStatement(party === "customer" ? companyId : null, partyId, page)
  const statement = party === "supplier" ? suppliers : customers
  const currencies = useCurrencies()
  const [acting, setActing] = useState<StatementRow | null>(null)
  // The sheets the actions open: a payment or an opening balance being
  // edited or deleted, a new opening balance (null).
  const [paying, setPaying] = useState<PaymentFields | null>(null)
  const [removing, setRemoving] = useState<PaymentFields | null>(null)
  const [opening, setOpening] = useState<OpeningFields | null | undefined>(undefined)
  const [dropping, setDropping] = useState<OpeningFields | null>(null)
  const data = statement.data

  const actionsOf = (row: StatementRow) => {
    const payment = isPayment(row)
    return [
      ...(canEdit ? [{ label: "Tahrirlash", onSelect: () => (payment ? setPaying(paymentOfRow(row)) : setOpening(openingOfRow(row))) }] : []),
      ...(canDelete ? [{ label: "O'chirish", danger: true, onSelect: () => (payment ? setRemoving(paymentOfRow(row)) : setDropping(openingOfRow(row))) }] : []),
    ]
  }
  const parties = { party, companyId, partyId }

  return (
    <section aria-labelledby="party-statement">
      <SectionHeading
        action={
          canAdd && (
            <button type="button" onClick={() => setOpening(null)}>
              Boshlang&apos;ich
            </button>
          )
        }
      >
        <span id="party-statement">Hisob harakati</span>
      </SectionHeading>
      {statement.isPending && <ListLoading rows={2} mark="none" />}
      {statement.isError && <Failed error={statement.error} onRetry={() => statement.refetch()} />}
      {data?.total === 0 && (
        <Group>
          <p className="px-4 py-3.5 text-md text-muted-foreground">{party === "supplier" ? "Bu ta'minotchida hujjat yo'q" : "Bu mijozda hujjat yo'q"}</p>
        </Group>
      )}
      {data && data.total > 0 && (
        <>
          <Group label="Hisob harakati" inset="icon">
            {data.items.map((row) => {
              const delta = Number(row.delta_uzs)
              const { icon, color } = iconOf(row)
              const own = isOpening(row) || (isPayment(row) && row.linked_id === null)
              const sub = [formatDateTime(row.at), row.account_name, row.currency_id !== UZS ? formatMoney(row.amount, currencyOf(currencies, row.currency_id)) : null]
              return (
                <Row
                  key={`${row.kind}-${row.id}`}
                  href={hrefOf(row)}
                  onClick={own && (canEdit || canDelete) ? () => setActing(row) : undefined}
                  media={<SoftIcon icon={icon} color={color} />}
                  title={titleOf(row)}
                  sub={sub.filter(Boolean).join(" · ")}
                  end={
                    <span className={cn("tabular-nums", delta > 0 && "text-destructive", delta < 0 && "text-positive")}>
                      {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                      {formatAmount(row.delta_uzs.replace("-", ""))}
                    </span>
                  }
                  endSub={`balans ${formatAmount(row.balance_uzs)}`}
                  chevron={false}
                />
              )
            })}
          </Group>
          {data.total > data.page_size && <Pager page={data.page} pageSize={data.page_size} total={data.total} onPage={setPage} />}
        </>
      )}
      <ActionSheet
        open={acting !== null}
        onOpenChange={(open) => !open && setActing(null)}
        title={acting ? `${titleOf(acting)} · ${formatMoney(acting.amount, currencyOf(currencies, acting.currency_id))}` : undefined}
        items={acting ? actionsOf(acting) : []}
      />
      {paying && <PaymentDialog {...parties} payment={paying} open onOpenChange={(open) => !open && setPaying(null)} />}
      {removing && <DeletePaymentDialog {...parties} payment={removing} open onOpenChange={(open) => !open && setRemoving(null)} />}
      {opening !== undefined && <OpeningDialog {...parties} opening={opening ?? undefined} open onOpenChange={(open) => !open && setOpening(undefined)} />}
      {dropping && <DeleteOpeningDialog {...parties} opening={dropping} open onOpenChange={(open) => !open && setDropping(null)} />}
    </section>
  )
}
