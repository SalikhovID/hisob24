"use client"

import { useState } from "react"
import { Chip } from "@/components/kit/chips"
import { PickerSheet } from "@/components/kit/picker-sheet"
import { useProductCategories } from "@/lib/queries"

// CategoryChoice is what a list of products is narrowed to: a category's
// id, the products with none ("none"), or every product (null).
export type CategoryChoice = number | "none" | null

// CategoryFilter is the «Kategoriya» chip of a list of products and the
// sheet it opens (logic/products.md, section 5): every category, one of the
// company's in the settings' order, or the products with none. The chip
// says the choice and is pressed while there is one.
export function CategoryFilter({ companyId, value, onChange }: { companyId: number | null; value: CategoryChoice; onChange: (value: CategoryChoice) => void }) {
  const [open, setOpen] = useState(false)
  const categories = useProductCategories(companyId).data ?? []
  const label = value === "none" ? "Kategoriyasiz" : value === null ? "Kategoriya" : (categories.find((c) => c.id === value)?.name ?? "Kategoriya")
  return (
    <>
      <Chip pressed={value !== null} chevron onClick={() => setOpen(true)}>
        {label}
      </Chip>
      <PickerSheet
        open={open}
        onOpenChange={setOpen}
        title="Kategoriya"
        options={[...categories.map((c) => ({ value: String(c.id), label: c.name })), { value: "none", label: "Kategoriyasiz" }]}
        value={value === null ? "" : String(value)}
        onChange={(next) => onChange(next === "" ? null : next === "none" ? "none" : Number(next))}
        none="Hamma kategoriyalar"
      />
    </>
  )
}
