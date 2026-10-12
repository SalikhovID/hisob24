import { screen, within } from "@testing-library/react"
import { useState } from "react"
import { expect, test, vi } from "vitest"
import type { PickerItem } from "@/components/picker"
import { ALI, seedCustomers } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { CustomerPicker } from "./customer-picker"

test("the customer picker offers the customers whose names or phones hold what was typed, after a pause", async () => {
  const { dilshod } = seedCustomers()
  await signIn(ALI)
  const onChange = vi.fn()
  function Harness() {
    const [value, setValue] = useState<PickerItem | null>(null)
    return (
      <CustomerPicker
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

  await user.type(screen.getByRole("combobox", { name: "Mijoz" }), "dil")
  const list = await screen.findByRole("listbox", { name: "Mijoz takliflari" })
  expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Dilshod Karimov+998 91 111 22 33"])
  await user.click(within(list).getByRole("option", { name: /Dilshod/ }))
  expect(onChange).toHaveBeenCalledWith({ id: dilshod.id, name: "Dilshod Karimov", meta: "+998 91 111 22 33" })
  expect(within(screen.getByRole("group", { name: "Mijoz" })).getByText("Dilshod Karimov")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Mijoz: bekor qilish" }))
  expect(onChange).toHaveBeenLastCalledWith(null)
  await user.type(screen.getByRole("combobox", { name: "Mijoz" }), "911")
  expect(within(await screen.findByRole("listbox", { name: "Mijoz takliflari" })).getAllByRole("option")).toHaveLength(1)
})
