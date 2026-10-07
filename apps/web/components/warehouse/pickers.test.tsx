import { screen, within } from "@testing-library/react"
import { useState } from "react"
import { expect, test, vi } from "vitest"
import type { PickerItem } from "@/components/picker"
import { ALI, seedCatalog, seedWarehouse } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { ProductPicker, type ProductPick, SupplierPicker } from "./pickers"

test("the supplier picker offers the active suppliers whose names hold what was typed, after a pause", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const onChange = vi.fn()
  function Harness() {
    const [value, setValue] = useState<PickerItem | null>(null)
    return (
      <SupplierPicker
        companyId={1}
        value={value}
        onChange={(item) => {
          setValue(item)
          onChange(item)
        }}
      />
    )
  }
  const { user } = renderWithProviders(<Harness />)

  await user.type(screen.getByRole("combobox", { name: "Ta'minotchi" }), "o")
  const list = await screen.findByRole("listbox", { name: "Ta'minotchi takliflari" })
  expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Bozor+998 90 123 45 67"])
  await user.click(within(list).getByRole("option", { name: /Bozor/ }))
  expect(onChange).toHaveBeenCalledWith({ id: bozor.id, name: "Bozor", meta: "+998 90 123 45 67" })
  expect(within(screen.getByRole("group", { name: "Ta'minotchi" })).getByText("Bozor")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Ta'minotchi: bekor qilish" }))
  expect(onChange).toHaveBeenLastCalledWith(null)
})

test("the product picker offers the active products by name or SKU, each with its unit and last price; services and inactive ones stay out", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  const onChange = vi.fn()
  function Harness() {
    const [value, setValue] = useState<ProductPick | null>(null)
    return (
      <ProductPicker
        companyId={1}
        value={value}
        onChange={(pick) => {
          setValue(pick)
          onChange(pick)
        }}
      />
    )
  }
  const { user } = renderWithProviders(<Harness />)

  const box = screen.getByRole("combobox", { name: "Mahsulot" })
  await user.type(box, "ol")
  let list = await screen.findByRole("listbox", { name: "Mahsulot takliflari" })
  expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Olmakg · 1\u00a0000"])
  // "e" is in Eski (inactive) and Yetkazish (a service) alone: nothing is offered.
  await user.clear(box)
  await user.type(box, "e")
  await new Promise((resolve) => setTimeout(resolve, 450))
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  await user.clear(box)
  await user.type(box, "n")
  list = await screen.findByRole("listbox", { name: "Mahsulot takliflari" })
  expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Nokdona · 2\u00a0500,50"])
  await user.click(within(list).getByRole("option", { name: /Nok/ }))
  expect(onChange).toHaveBeenCalledWith({ id: catalog.nok.id, name: "Nok", meta: "dona · 2\u00a0500,50", unit: "dona", last_price: "2500.50" })
})
