import { screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { expect, test, vi } from "vitest"
import type { PickerItem } from "@/components/warehouse/pickers"
import { ALI, seedCustomers } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { CustomerPicker } from "./customer-picker"

// names are the options the sheet offers, as they read (the avatars hidden).
const names = (sheet: HTMLElement) =>
  within(within(sheet).getByRole("listbox"))
    .queryAllByRole("option")
    .map((option) => {
      const read = option.cloneNode(true) as HTMLElement
      read.querySelectorAll("[aria-hidden=true]").forEach((hidden) => hidden.remove())
      return read.textContent?.replace(/\s+/g, " ").trim()
    })

test("the sale's customer is a row that opens a sheet: «Chakana» first, then the customers, found by name or phone as it is typed", async () => {
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

  // None taken is a retail sale.
  const row = screen.getByRole("button", { name: /^Mijoz/ })
  expect(row).toHaveTextContent("Chakana")
  await user.click(row)
  let sheet = await screen.findByRole("dialog", { name: "Mijoz" })
  await waitFor(() => expect(names(sheet)[0]).toBe("Chakana Mijozsiz sotuv"))
  expect(names(sheet)).toContain("Dilshod Karimov +998 91 111 22 33")
  await user.type(within(sheet).getByRole("searchbox"), "dil")
  await waitFor(() => expect(names(sheet)).toEqual(["Dilshod Karimov +998 91 111 22 33"]))
  await user.click(within(sheet).getByRole("option", { name: /Dilshod/ }))
  expect(onChange).toHaveBeenCalledWith({ id: dilshod.id, name: "Dilshod Karimov", meta: "+998 91 111 22 33" })
  expect(screen.getByRole("button", { name: /^Mijoz/ })).toHaveTextContent("Dilshod Karimov")

  // Back to retail; a phone finds a customer too.
  await user.click(screen.getByRole("button", { name: /^Mijoz/ }))
  sheet = await screen.findByRole("dialog", { name: "Mijoz" })
  await user.click(await within(sheet).findByRole("option", { name: /^Chakana/ }))
  expect(onChange).toHaveBeenLastCalledWith(null)
  await user.click(screen.getByRole("button", { name: /^Mijoz/ }))
  sheet = await screen.findByRole("dialog", { name: "Mijoz" })
  await user.type(within(sheet).getByRole("searchbox"), "911")
  await waitFor(() => expect(names(sheet)).toEqual(["Dilshod Karimov +998 91 111 22 33"]))
})
