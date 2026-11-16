import { screen, waitFor, within } from "@testing-library/react"
import { useState } from "react"
import { expect, test, vi } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { signIn } from "@/test/session"
import { type PickerItem, ProductPicker, type ProductPick, SupplierPicker } from "./pickers"

// names are the options a sheet offers, as they read (the avatars are
// decoration, hidden from a screen reader).
const names = (sheet: HTMLElement) =>
  within(within(sheet).getByRole("listbox"))
    .queryAllByRole("option")
    .map((option) => {
      const read = option.cloneNode(true) as HTMLElement
      read.querySelectorAll("[aria-hidden=true]").forEach((hidden) => hidden.remove())
      return read.textContent?.replace(/\s+/g, " ").trim()
    })

test("the supplier is a row that opens a sheet of the active suppliers, found by name as it is typed", async () => {
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

  const row = screen.getByRole("button", { name: /^Ta'minotchi/ })
  expect(row).toHaveTextContent("Tanlang")
  await user.click(row)
  const sheet = await screen.findByRole("dialog", { name: "Ta'minotchi" })
  // Before anything is typed the active ones are there; Dehqon is not active.
  await waitFor(() => expect(names(sheet)).toEqual(["Bozor +998 90 123 45 67"]))
  await user.type(within(sheet).getByRole("searchbox"), "xyz")
  await waitFor(() => expect(within(sheet).getByText("Ta'minotchi topilmadi")).toBeInTheDocument())
  await user.clear(within(sheet).getByRole("searchbox"))
  await user.type(within(sheet).getByRole("searchbox"), "bo")
  await user.click(await within(sheet).findByRole("option", { name: /Bozor/ }))

  expect(onChange).toHaveBeenCalledWith({ id: bozor.id, name: "Bozor", meta: "+998 90 123 45 67" })
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(screen.getByRole("button", { name: /^Ta'minotchi/ })).toHaveTextContent("Bozor")
})

test("the product is a row that opens a sheet of the active products by name or SKU, each with its unit and last price; services and inactive ones stay out", async () => {
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

  await user.click(screen.getByRole("button", { name: /^Mahsulot/ }))
  const sheet = await screen.findByRole("dialog", { name: "Mahsulot" })
  await waitFor(() => expect(names(sheet)).toEqual(["Nok dona · 2 500,50 so'm", "Olma kg · 1 000 so'm"]))
  // "e" is in Eski (inactive) and Yetkazish (a service) alone: nothing is offered.
  await user.type(within(sheet).getByRole("searchbox"), "e")
  await waitFor(() => expect(within(sheet).getByText("Mahsulot topilmadi")).toBeInTheDocument())
  await user.clear(within(sheet).getByRole("searchbox"))
  await user.type(within(sheet).getByRole("searchbox"), "n")
  await waitFor(() => expect(names(sheet)).toEqual(["Nok dona · 2 500,50 so'm"]))
  await user.click(within(sheet).getByRole("option", { name: /Nok/ }))

  expect(onChange).toHaveBeenCalledWith({ id: catalog.nok.id, name: "Nok", meta: "dona · 2 500,50 so'm", unit: "dona", last_price: { amount: "2500.50", currency_id: 1 }, price: null })
  expect(screen.getByRole("button", { name: /^Mahsulot/ })).toHaveTextContent("Nok")
})

test("asked for services too and the sale price, the sheet offers both kinds with the price each is sold at; a product of another line is marked and not taken", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  const onChange = vi.fn()
  const { user } = renderWithProviders(<ProductPicker companyId={1} kinds={["product", "service"]} offer="price" used={[catalog.olma.id]} value={null} onChange={onChange} />)

  await user.click(screen.getByRole("button", { name: /^Mahsulot/ }))
  const sheet = await screen.findByRole("dialog", { name: "Mahsulot" })
  await user.type(within(sheet).getByRole("searchbox"), "e")
  await waitFor(() => expect(names(sheet)).toEqual(["Yetkazish 50 000 so'm"]))
  await user.click(within(sheet).getByRole("option", { name: /Yetkazish/ }))
  expect(onChange).toHaveBeenCalledWith({ id: catalog.yetkazish.id, name: "Yetkazish", meta: "50 000 so'm", unit: null, last_price: null, price: { amount: "50000.00", currency_id: 1 } })

  await user.click(screen.getByRole("button", { name: /^Mahsulot/ }))
  const again = await screen.findByRole("dialog", { name: "Mahsulot" })
  await user.type(within(again).getByRole("searchbox"), "ol")
  const olma = await within(again).findByRole("option", { name: /Olma/ })
  expect(olma).toHaveAttribute("aria-disabled", "true")
  expect(olma).toHaveTextContent("qo'shilgan")
})

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

test("every opening of the product sheet starts from «Hammasi»", async () => {
  const { olma } = seedCatalog()
  db.productCategories.push({ id: 7001, companyId: 1, name: "Mevalar", position: 1 })
  olma.categoryId = 7001
  await signIn(ALI)
  const { user } = renderWithProviders(<ProductPicker companyId={1} value={null} onChange={() => {}} />)

  let sheet = await open(user)
  await user.click(await within(sheet).findByRole("radio", { name: "Mevalar" }))
  await waitFor(() => expect(offered(sheet)).toEqual(["Olma"]))
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Mahsulot" })).not.toBeInTheDocument())

  sheet = await open(user)
  expect(await within(sheet).findByRole("radio", { name: "Hammasi" })).toHaveAttribute("aria-checked", "true")
  await waitFor(() => expect(offered(sheet)).toEqual(["Nok", "Olma"]))
})

test("in a sale's sheet the services follow the products; a chip keeps its category's products, the services not even asked", async () => {
  const { olma } = seedCatalog()
  db.productCategories.push({ id: 7001, companyId: 1, name: "Mevalar", position: 1 })
  olma.categoryId = 7001
  await signIn(ALI)
  const asked: string[] = []
  const listen = ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    if (url.pathname.endsWith("/app/products")) asked.push(url.search)
  }
  server.events.on("request:start", listen)
  const { user } = renderWithProviders(<ProductPicker companyId={1} kinds={["product", "service"]} offer="price" value={null} onChange={() => {}} />)

  const sheet = await open(user)
  await waitFor(() => expect(offered(sheet)).toEqual(["Nok", "Olma", "Yetkazish"]))
  asked.length = 0
  await user.click(await within(sheet).findByRole("radio", { name: "Mevalar" }))
  await waitFor(() => expect(offered(sheet)).toEqual(["Olma"]))
  expect(asked.filter((query) => query.includes("kind=service"))).toEqual([])
  server.events.removeListener("request:start", listen)
})
