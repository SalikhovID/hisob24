import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { ProductPicker } from "./pickers"

// open opens the product row's sheet.
async function open(user: { click: (element: Element) => Promise<void> }) {
  await user.click(screen.getByRole("button", { name: /^Mahsulot/ }))
  return screen.findByRole("dialog", { name: "Mahsulot" })
}
// offered is the names the sheet offers, in order.
const offered = (sheet: HTMLElement) =>
  within(sheet)
    .queryAllByRole("option")
    .map((option) => option.querySelector(".truncate")?.textContent)

test("with categories the product sheet offers their chips, «Hammasi» first and the rest in the settings' order; a chip keeps its products", async () => {
  const { olma } = seedCatalog()
  db.productCategories.push({ id: 7001, companyId: 1, name: "Mevalar", position: 2 }, { id: 7002, companyId: 1, name: "Ichimliklar", position: 1 })
  olma.categoryId = 7001
  await signIn(ALI)
  const { user } = renderWithProviders(<ProductPicker companyId={1} value={null} onChange={() => {}} />)

  const sheet = await open(user)
  const chips = await within(sheet).findByRole("radiogroup", { name: "Kategoriya" })
  expect(within(chips).getAllByRole("radio").map((chip) => chip.textContent)).toEqual(["Hammasi", "Ichimliklar", "Mevalar"])
  expect(within(chips).getByRole("radio", { name: "Hammasi" })).toHaveAttribute("aria-checked", "true")
  await waitFor(() => expect(offered(sheet)).toEqual(["Nok", "Olma"]))
  await user.click(within(chips).getByRole("radio", { name: "Mevalar" }))
  await waitFor(() => expect(offered(sheet)).toEqual(["Olma"]))
})

test("without categories the product sheet holds no chips", async () => {
  seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<ProductPicker companyId={1} value={null} onChange={() => {}} />)

  const sheet = await open(user)
  await waitFor(() => expect(offered(sheet)).toEqual(["Nok", "Olma"]))
  expect(within(sheet).queryByRole("radiogroup", { name: "Kategoriya" })).not.toBeInTheDocument()
})
