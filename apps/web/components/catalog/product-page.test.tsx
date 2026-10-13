import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { chooseCompany, signIn } from "@/test/session"
import { ProductPage } from "./product-page"

// facts reads the "Ma'lumot" list: each name with its value (the stock
// list holds terms of its own).
const facts = () =>
  Object.fromEntries(
    within(screen.getByRole("region", { name: "Ma'lumot" }))
      .getAllByRole("term")
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
  )
// parts are a row's title, line and end, the spaces as one plain space.
const parts = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
  const { title, sub, end } = rowParts(row)
  return { title: plain(title), sub: plain(sub), end: plain(end) }
}
// stock reads the "Qoldiq" cards: each location with its quantity (the
// current one marked «Joriy» beside its name).
const stock = () =>
  Object.fromEntries(
    within(screen.getByRole("region", { name: "Qoldiq" }))
      .getAllByRole("term")
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
  )

test("the product page: its name, unit and SKU, its facts, its stock in every location, its purchases, and the actions for whoever may edit and delete", async () => {
  const catalog = seedCatalog()
  const { olma } = catalog
  const { purchase } = seedWarehouse(catalog)
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<ProductPage id={olma.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Olma" })).toBeInTheDocument()
  expect(screen.getByText("kg · OL-1")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Mahsulotlar" })).toHaveAttribute("href", "/products")
  // The sale price stands large under the head.
  const price = document.querySelector("[data-slot=hero]")!
  expect(price.textContent?.replace(/\s+/g, " ")).toBe("Sotuv narxi 12 000 so'm")
  // What may be done with it are the tiles; a purchase of it is entered from here.
  const tiles = screen.getByRole("group", { name: "Amallar" })
  expect(Array.from(tiles.querySelectorAll("[data-slot=tile]"), (tile) => tile.textContent)).toEqual(["Tahrirlash", "Xarid", "Nofaol qilish"])
  expect(within(tiles).getByRole("link", { name: "Xarid" })).toHaveAttribute("href", `/purchases/new?product=${olma.id}`)
  expect(facts()).toEqual({
    Birlik: "kg",
    Narx: "12 000 so'm",
    "Oxirgi xarid narxi": "1 000 so'm",
    Artikul: "OL-1",
    Izoh: "Qizil",
    "Qo'shgan": "Ali Valiyev",
    "Qo'shilgan": "02.10.2026",
  })
  expect(screen.getByRole("button", { name: "Mahsulotni o'chirish" })).toBeInTheDocument()
  expect(screen.queryByText("Nofaol")).not.toBeInTheDocument()
  expect(stock()).toEqual({ "Asosiy Joriy": "12,5 kg", Chilonzor: "0 kg" })
  // The purchases it is in are rows: the way into each, the moment, the
  // location (with two or more), how much at what price, and the sum.
  const purchases = await screen.findByRole("list", { name: "Xaridlar" })
  const [line] = within(purchases).getAllByRole("link")
  expect(line).toHaveAttribute("href", `/purchases/${purchase!.id}`)
  expect(parts(line)).toEqual({ title: "№ 1 · Bozor", sub: "01.10.2026 09:00 · Asosiy · 12,5 kg × 1 000 so'm", end: "12 500 so'm" })
  // The moves come with the stock documents' permission.
  expect(await screen.findByRole("list", { name: "Harakatlar" })).toBeInTheDocument()
})

test("without the stock documents' permission the moves are not shown", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  giveRole(VALI, 1, "Sotuvchi", ["products.view", "purchases.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<ProductPage id={catalog.olma.id} />)

  expect(await screen.findByRole("list", { name: "Xaridlar" })).toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Harakatlar" })).not.toBeInTheDocument()
})

test("a product in a purchase is kept: the API's refusal is told", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  const { user } = renderWithProviders(<ProductPage id={catalog.olma.id} />)

  await user.click(await screen.findByRole("button", { name: "Mahsulotni o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog", { name: "Mahsulotni o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Bu mahsulot 1 ta hujjatda bor")).toBeInTheDocument()
  expect(db.products.find((p) => p.id === catalog.olma.id)?.deleted).toBeUndefined()
  expect(router.replace).not.toHaveBeenCalled()
})

test("an inactive product says so and offers to turn it on; what it lacks is a dash", async () => {
  const { eski } = seedCatalog()
  await signIn(ALI)
  renderWithProviders(<ProductPage id={eski.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Eski mahsulot" })).toBeInTheDocument()
  expect(screen.getByText("Nofaol")).toBeInTheDocument()
  // Nothing is bought of an inactive product; with no price there is no figure.
  const tiles = screen.getByRole("group", { name: "Amallar" })
  expect(Array.from(tiles.querySelectorAll("[data-slot=tile]"), (tile) => tile.textContent)).toEqual(["Tahrirlash", "Faollashtirish"])
  expect(screen.queryByText("Sotuv narxi")).not.toBeInTheDocument()
  expect(facts()).toMatchObject({ Narx: "—", "Oxirgi xarid narxi": "—", Artikul: "—", Izoh: "—" })
  expect(stock()).toEqual({ "Asosiy Joriy": "0 dona" })
  expect(await screen.findByText("Bu mahsulot hali xarid qilinmagan")).toBeInTheDocument()
})

test("deleting the product leads back to the list", async () => {
  const { nok } = seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<ProductPage id={nok.id} />)

  await user.click(await screen.findByRole("button", { name: "Mahsulotni o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog", { name: "Mahsulotni o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/products", { transitionTypes: ["nav-back"] }))
  expect(await screen.findByText("Mahsulot o'chirildi")).toBeInTheDocument()
})

test("an employee with the view alone sees the facts and no action", async () => {
  const { olma } = seedCatalog()
  giveRole(VALI, 1, "Kuzatuvchi", ["products.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<ProductPage id={olma.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Olma" })).toBeInTheDocument()
  expect(screen.queryAllByRole("button")).toHaveLength(0)
  expect(screen.queryByRole("group", { name: "Amallar" })).not.toBeInTheDocument()
  expect(screen.getByRole("region", { name: "Qoldiq" })).toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Xaridlar" })).not.toBeInTheDocument()
})

test("a product that is gone, or another company's, is not found", async () => {
  await signIn(ALI)
  renderWithProviders(<ProductPage id={999} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Mahsulot topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Mahsulotlar" })).toHaveAttribute("href", "/products")
})

test("a service opened by its id leads back to the services", async () => {
  const { yetkazish } = seedCatalog()
  await signIn(ALI)
  renderWithProviders(<ProductPage id={yetkazish.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yetkazish" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Xizmatlar" })).toHaveAttribute("href", "/services")
  expect(screen.getByText("Xizmat")).toBeInTheDocument()
  expect(within(screen.getByRole("group", { name: "Amallar" })).queryByRole("link", { name: "Xarid" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Xizmatni o'chirish" })).toBeInTheDocument()
  expect(facts()).toEqual({ Narx: "50 000 so'm", Izoh: "—", "Qo'shgan": "Ali Valiyev", "Qo'shilgan": "02.10.2026" })
  expect(screen.queryByRole("region", { name: "Qoldiq" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Xaridlar" })).not.toBeInTheDocument()
})

test("an edit or a switch on the page keeps the stock on screen (the answer carries no stock)", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  const { user } = renderWithProviders(<ProductPage id={catalog.olma.id} />)
  await screen.findByRole("heading", { level: 1, name: "Olma" })

  await user.click(screen.getByRole("button", { name: "Tahrirlash" }))
  const dialog = await screen.findByRole("dialog", { name: "Mahsulotni tahrirlash" })
  await user.clear(within(dialog).getByLabelText("Nomi"))
  await user.type(within(dialog).getByLabelText("Nomi"), "Qizil olma")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByRole("heading", { level: 1, name: "Qizil olma" })).toBeInTheDocument()
  expect(stock()).toEqual({ "Asosiy Joriy": "12,5 kg" })

  await user.click(screen.getByRole("button", { name: "Nofaol qilish" }))
  expect(await screen.findByRole("button", { name: "Faollashtirish" })).toBeInTheDocument()
  expect(stock()).toEqual({ "Asosiy Joriy": "12,5 kg" })
})
