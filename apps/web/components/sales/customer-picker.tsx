"use client"

import { useEffect, useState } from "react"
import { Picker, type PickerItem } from "@/components/picker"
import { customerName } from "@/lib/customers"
import { formatPhone } from "@/lib/phone"
import { useCustomerSearch, useCustomerTypes } from "@/lib/queries"

// useDebounced is the value once it has stood still for ms.
function useDebounced(value: string, ms = 300): string {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

// CustomerPicker finds a customer of the company by name or phone, for the
// sale form (logic/sales.md, 3.4); the one taken stands as a chip with
// their phone. None taken is a retail sale.
export function CustomerPicker({
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
  const suggestions = useCustomerSearch(companyId, settled)
  const types = useCustomerTypes(companyId)
  const items: PickerItem[] =
    settled.trim() === ""
      ? []
      : (suggestions.data?.items ?? []).map((c) => {
          const name = customerName(c, types.data?.find((type) => type.id === c.type_id))
          return name ? { id: c.id, name, meta: formatPhone(c.phone) } : { id: c.id, name: formatPhone(c.phone) }
        })
  return (
    <Picker
      label="Mijoz"
      placeholder="Nom yoki telefon"
      listLabel="Mijoz takliflari"
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
