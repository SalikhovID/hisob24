"use client"

import { useState } from "react"
import { Avatar } from "@/components/kit/avatar"
import { PickRow } from "@/components/kit/form-row"
import { SearchPickerSheet } from "@/components/kit/picker-sheet"
import type { PickerItem } from "@/components/warehouse/pickers"
import { customerName } from "@/lib/customers"
import { formatPhone } from "@/lib/phone"
import { useCustomerSearch, useCustomerTypes } from "@/lib/queries"

// CustomerPicker is the sale form's customer (logic/sales.md, 3.4) as the
// prototype's row: it opens a sheet of the company's customers, found by
// name or phone as it is typed, each with their phone; «Chakana» stands
// first, a retail sale that names nobody (none taken).
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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  // The sheet asks once it is open; every opening starts with nothing typed.
  const suggestions = useCustomerSearch(open ? companyId : null, query)
  const types = useCustomerTypes(companyId)
  const show = (next: boolean) => {
    setOpen(next)
    if (next) setQuery("")
  }
  const items: PickerItem[] = (suggestions.data?.items ?? []).map((c) => {
    const name = customerName(c, types.data?.find((type) => type.id === c.type_id))
    return name ? { id: c.id, name, meta: formatPhone(c.phone) } : { id: c.id, name: formatPhone(c.phone) }
  })
  const retail = { value: "", label: "Chakana", sub: "Mijozsiz sotuv" }
  return (
    <>
      <PickRow label="Mijoz" value={value?.name ?? "Chakana"} onClick={() => show(true)} error={error} disabled={disabled} />
      <SearchPickerSheet
        open={open}
        onOpenChange={show}
        title="Mijoz"
        placeholder="Nom yoki telefon"
        query={query}
        onQuery={setQuery}
        options={[
          ...(query.trim() === "" ? [retail] : []),
          ...items.map((item) => ({
            value: String(item.id),
            label: item.name,
            sub: item.meta,
            media: <Avatar name={item.meta ? item.name : null} seed={item.id} className="size-8 text-xs" />,
          })),
        ]}
        value={value ? String(value.id) : ""}
        onChange={(id) => onChange(id === "" ? null : (items.find((item) => String(item.id) === id) ?? null))}
        loading={suggestions.isPending}
        emptyText="Mijoz topilmadi"
      />
    </>
  )
}
