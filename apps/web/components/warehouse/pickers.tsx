"use client"

import { useEffect, useState } from "react"
import { Picker, type PickerItem } from "@/components/picker"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatMoney, unitLabel } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { useProductSuggestions, useSupplierSuggestions } from "@/lib/queries"
import type { LastPrice, ProductKind, Unit } from "@/lib/types"

// useDebounced is the value once it has stood still for ms.
function useDebounced(value: string, ms = 300): string {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

// SupplierPicker finds an active supplier of the company by its name, for
// the purchase form; the one taken stands as a chip with its phone.
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
  const [typed, setTyped] = useState("")
  const settled = useDebounced(typed)
  const suggestions = useSupplierSuggestions(companyId, settled)
  const items: PickerItem[] =
    settled.trim() === ""
      ? []
      : (suggestions.data?.items ?? []).map((s) => (s.phone ? { id: s.id, name: s.name, meta: formatPhone(s.phone) } : { id: s.id, name: s.name }))
  return (
    <Picker
      label="Ta'minotchi"
      placeholder="Nom bo'yicha qidiring"
      listLabel="Ta'minotchi takliflari"
      typed={typed}
      onTyped={setTyped}
      items={items}
      selected={value}
      onSelect={(item) => onChange(item)}
      onClear={() => onChange(null)}
      error={error}
      disabled={disabled}
    />
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

// ProductPicker finds an active product (or service, when kinds says so) of
// the company by its name or SKU, for a line of a document's form; each is
// offered with its unit and the price offered.
export function ProductPicker({
  companyId,
  kinds = ["product"],
  offer = "last_price",
  value,
  onChange,
  error,
  disabled,
}: {
  companyId: number
  kinds?: readonly ProductKind[]
  offer?: Offer
  value: ProductPick | null
  onChange: (pick: ProductPick | null) => void
  error?: string
  disabled?: boolean
}) {
  const [typed, setTyped] = useState("")
  const settled = useDebounced(typed)
  const suggestions = useProductSuggestions(companyId, settled, kinds)
  const currencies = useCurrencies()
  const picks: ProductPick[] =
    settled.trim() === ""
      ? []
      : (suggestions.data?.items ?? []).map((p) => {
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
    <Picker
      label="Mahsulot"
      placeholder="Nom yoki artikul"
      listLabel="Mahsulot takliflari"
      typed={typed}
      onTyped={setTyped}
      items={picks}
      selected={value}
      onSelect={(item) => onChange(picks.find((p) => p.id === item.id) ?? null)}
      onClear={() => onChange(null)}
      error={error}
      disabled={disabled}
    />
  )
}
