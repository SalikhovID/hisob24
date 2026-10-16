"use client"

import { useState } from "react"
import { Avatar } from "@/components/kit/avatar"
import { PickRow } from "@/components/kit/form-row"
import { SearchPickerSheet } from "@/components/kit/picker-sheet"
import { Badge } from "@/components/ui/badge"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatMoney, unitLabel } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { useProductSuggestions, useSupplierSuggestions } from "@/lib/queries"
import type { LastPrice, ProductKind, Unit } from "@/lib/types"

// PickerItem is a record a picker takes: its id, its name and what is said
// under it (a phone, a unit and a price).
export interface PickerItem {
  id: number
  name: string
  meta?: string
}

// SupplierPicker is the purchase form's supplier as the prototype's row: it
// opens a sheet of the active suppliers, found by name as it is typed, each
// with its phone; the one taken stands in the row.
export function SupplierPicker({
  companyId,
  value,
  onChange,
  error,
  disabled,
}: {
  companyId: number
  value: PickerItem | null
  onChange: (item: PickerItem | null) => void
  error?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  // Every opening starts with nothing typed.
  const show = (next: boolean) => {
    setOpen(next)
    if (next) setQuery("")
  }
  // The sheet asks once it is open.
  const suggestions = useSupplierSuggestions(open ? companyId : null, query)
  const items: PickerItem[] = (suggestions.data?.items ?? []).map((s) => (s.phone ? { id: s.id, name: s.name, meta: formatPhone(s.phone) } : { id: s.id, name: s.name }))
  return (
    <>
      <PickRow label="Ta'minotchi" value={value?.name} placeholder="Tanlang" onClick={() => show(true)} error={error} disabled={disabled} />
      <SearchPickerSheet
        open={open}
        onOpenChange={show}
        title="Ta'minotchi"
        placeholder="Nom bo'yicha qidiring"
        query={query}
        onQuery={setQuery}
        options={items.map((item) => ({
          value: String(item.id),
          label: item.name,
          sub: item.meta ?? "Telefon yo'q",
          media: <Avatar name={item.name} square className="size-8 text-xs" />,
        }))}
        value={value ? String(value.id) : ""}
        onChange={(id) => onChange(items.find((item) => String(item.id) === id) ?? null)}
        loading={suggestions.isPending}
        emptyText="Ta'minotchi topilmadi"
      />
    </>
  )
}

// ProductPick is a product or a service as a document's form takes it:
// with its unit (for the quantity), its last purchase price and its sale
// price, each in its currency (for the price field).
export interface ProductPick extends PickerItem {
  unit: Unit | null
  last_price: LastPrice | null
  price: LastPrice | null
}

// Offer is the price a picker shows and a form offers: what the product was
// last bought at (a purchase) or what it is sold at (a sale).
export type Offer = "last_price" | "price"

// ProductPicker is a document line's product as the prototype's row: it
// opens a sheet of the active products (or services too, when kinds says
// so), found by name or SKU as it is typed, each with its unit and the
// price offered; one already in another line (used) is marked and not taken.
export function ProductPicker({
  companyId,
  kinds = ["product"],
  offer = "last_price",
  used = [],
  value,
  onChange,
  error,
  disabled,
}: {
  companyId: number
  kinds?: readonly ProductKind[]
  offer?: Offer
  used?: readonly number[]
  value: ProductPick | null
  onChange: (pick: ProductPick | null) => void
  error?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  // Every opening starts with nothing typed.
  const show = (next: boolean) => {
    setOpen(next)
    if (next) setQuery("")
  }
  // The sheet asks once it is open.
  const suggestions = useProductSuggestions(open ? companyId : null, query, kinds)
  const currencies = useCurrencies()
  const picks: ProductPick[] = (suggestions.data?.items ?? []).map((p) => {
    const price = p.price === null ? null : { amount: p.price, currency_id: p.currency_id }
    const offered = offer === "price" ? price : p.last_price
    return {
      id: p.id,
      name: p.name,
      meta: [p.unit && unitLabel(p.unit), offered && formatMoney(offered.amount, currencyOf(currencies, offered.currency_id))].filter(Boolean).join(" · "),
      unit: p.unit,
      last_price: p.last_price,
      price,
    }
  })
  return (
    <>
      <PickRow label="Mahsulot" value={value?.name} placeholder="Tanlang" onClick={() => show(true)} error={error} disabled={disabled} />
      <SearchPickerSheet
        open={open}
        onOpenChange={show}
        title="Mahsulot"
        placeholder="Nom yoki artikul"
        query={query}
        onQuery={setQuery}
        options={picks.map((pick) => {
          const taken = used.includes(pick.id) && pick.id !== value?.id
          return {
            value: String(pick.id),
            label: pick.name,
            sub: pick.meta || undefined,
            media: <Avatar name={pick.name} square letter className="size-8 text-xs" />,
            disabled: taken,
            badge: taken ? <Badge>qo&apos;shilgan</Badge> : undefined,
          }
        })}
        value={value ? String(value.id) : ""}
        onChange={(id) => onChange(picks.find((pick) => String(pick.id) === id) ?? null)}
        loading={suggestions.isPending}
        emptyText="Mahsulot topilmadi"
      />
    </>
  )
}
