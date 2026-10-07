"use client"

import { useEffect, useState } from "react"
import { Picker, type PickerItem } from "@/components/picker"
import { formatAmount, unitLabel } from "@/lib/format"
import { formatPhone } from "@/lib/phone"
import { useProductSuggestions, useSupplierSuggestions } from "@/lib/queries"
import type { Unit } from "@/lib/types"

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

// ProductPick is a product as the purchase form takes it: with its unit
// (for the quantity) and its last purchase price (for the price field).
export interface ProductPick extends PickerItem {
  unit: Unit | null
  last_price: string | null
}

// ProductPicker finds an active product of the company by its name or SKU,
// for a line of the purchase form; each is offered with its unit and the
// price it was last bought at.
export function ProductPicker({
  companyId,
  value,
  onChange,
  error,
  disabled,
}: {
  companyId: number
  value: ProductPick | null
  onChange: (pick: ProductPick | null) => void
  error?: string
  disabled?: boolean
}) {
  const [typed, setTyped] = useState("")
  const settled = useDebounced(typed)
  const suggestions = useProductSuggestions(companyId, settled)
  const picks: ProductPick[] =
    settled.trim() === ""
      ? []
      : (suggestions.data?.items ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          meta: [p.unit && unitLabel(p.unit), p.last_price && formatAmount(p.last_price)].filter(Boolean).join(" · "),
          unit: p.unit,
          last_price: p.last_price,
        }))
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
