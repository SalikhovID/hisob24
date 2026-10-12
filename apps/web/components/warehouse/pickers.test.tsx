import { screen, waitFor, within } from "@testing-library/react"
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
  expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Olmakg · 1\u00a0000 so'm"])
  // "e" is in Eski (inactive) and Yetkazish (a service) alone: nothing is offered.
  await user.clear(box)
  await user.type(box, "e")
  await new Promise((resolve) => setTimeout(resolve, 450))
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  await user.clear(box)
  await user.type(box, "n")
  list = await screen.findByRole("listbox", { name: "Mahsulot takliflari" })
  expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Nokdona · 2\u00a0500,50 so'm"])
  await user.click(within(list).getByRole("option", { name: /Nok/ }))
  expect(onChange).toHaveBeenCalledWith({ id: catalog.nok.id, name: "Nok", meta: "dona · 2\u00a0500,50 so'm", unit: "dona", last_price: { amount: "2500.50", currency_id: 1 }, price: null })
})

test("asked for services too and the sale price, the picker offers both kinds with the price each is sold at", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  const onChange = vi.fn()
  function Harness() {
    const [value, setValue] = useState<ProductPick | null>(null)
    return (
      <ProductPicker
        companyId={1}
        kinds={["product", "service"]}
        offer="price"
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
  await user.type(box, "e")
  const list = await screen.findByRole("listbox", { name: "Mahsulot takliflari" })
  expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Yetkazish50\u00a0000 so'm"])
  await user.click(within(list).getByRole("option", { name: /Yetkazish/ }))
  expect(onChange).toHaveBeenCalledWith({ id: catalog.yetkazish.id, name: "Yetkazish", meta: "50\u00a0000 so'm", unit: null, last_price: null, price: { amount: "50000.00", currency_id: 1 } })
  await user.click(screen.getByRole("button", { name: "Mahsulot: bekor qilish" }))
  // The chip gave way to a fresh input: find it again. The list shows the
  // last answer until the new one lands.
  await user.type(screen.getByRole("combobox", { name: "Mahsulot" }), "ol")
  await waitFor(() =>
    expect(within(screen.getByRole("listbox", { name: "Mahsulot takliflari" })).getAllByRole("option").map((o) => o.textContent)).toEqual(["Olmakg · 12\u00a0000 so'm"]),
  )
})
