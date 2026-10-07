import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { CatalogPage } from "./catalog-page"

const table = (name: string) => screen.findByRole("table", { name })
// titles are the records' names in the table's order: the first cell of
// each row, the link's text where the record has a page.
const titles = (table: HTMLElement) =>
  within(table)
    .getAllByRole("rowheader")
    .map((cell) => within(cell).queryByRole("link")?.textContent ?? cell.textContent)

test("the owner's products: by name, with the SKU, the unit, the price and the stock of the current location; the inactive ones under their own tab", async () => {
  const catalog = seedCatalog()
  const { olma, nok } = catalog
  seedWarehouse(catalog)
  await signIn(ALI)
  setLocation("/products")
  const { user } = renderWithProviders(<CatalogPage kind="product" />)

  const list = await table("Mahsulotlar")
  expect(screen.getByRole("heading", { level: 1, name: "Mahsulotlar" })).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz mahsulotlari · 2 ta")).toBeInTheDocument()
  const tabs = screen.getByRole("navigation", { name: "Mahsulotlar bo'limi" })
  expect(within(tabs).getByRole("link", { name: "Mahsulotlar" })).toHaveAttribute("aria-current", "page")
  expect(within(tabs).getByRole("link", { name: "Xizmatlar" })).toHaveAttribute("href", "/services")
  expect(within(list).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Mahsulot", "Artikul", "Birlik", "Narx", "Qoldiq", "Qo'shgan", "Qo'shilgan"])
  expect(titles(list)).toEqual(["Nok", "Olma"])
  expect(within(list).getByRole("link", { name: "Olma" })).toHaveAttribute("href", `/products/${olma.id}`)
  expect(within(list).getByRole("link", { name: "Nok" })).toHaveAttribute("href", `/products/${nok.id}`)
  const olmaRow = within(list).getByRole("link", { name: "Olma" }).closest("tr")!
  expect(within(olmaRow).getByText("OL-1")).toBeInTheDocument()
  expect(within(olmaRow).getByText("kg")).toBeInTheDocument()
  expect(within(olmaRow).getByText("12 000")).toBeInTheDocument()
  expect(within(olmaRow).getByText("12,5 kg")).toBeInTheDocument()
  expect(within(olmaRow).getByText("Ali Valiyev")).toBeInTheDocument()
  const nokRow = within(list).getByRole("link", { name: "Nok" }).closest("tr")!
  expect(within(nokRow).getByText("dona")).toBeInTheDocument()
  expect(within(nokRow).getByText("3 dona")).toBeInTheDocument()
  expect(within(list).queryByText("Eski mahsulot")).not.toBeInTheDocument()

  await user.click(screen.getByRole("tab", { name: "Nofaol" }))
  await waitFor(() => expect(currentUrl()).toBe("/products?status=inactive"))
  expect(await within(await table("Mahsulotlar")).findByText("Eski mahsulot")).toBeInTheDocument()
  expect(screen.queryByText("Olma")).not.toBeInTheDocument()
})

test("the stock shown is the current location's: Chilonzor holds none of what Asosiy got", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const chilonzor = addLocation(1, "Chilonzor")
  localStorage.setItem(`location:1:${ALI}`, String(chilonzor.id))
  await signIn(ALI)
  setLocation("/products")
  renderWithProviders(<CatalogPage kind="product" />)

  const list = await table("Mahsulotlar")
  const olmaRow = within(list).getByRole("link", { name: "Olma" }).closest("tr")!
  expect(within(olmaRow).getByText("0 kg")).toBeInTheDocument()
})

test("a search looks in the names and the SKUs", async () => {
  seedCatalog()
  await signIn(ALI)
  setLocation("/products")
  const { user } = renderWithProviders(<CatalogPage kind="product" />)
  await table("Mahsulotlar")

  await user.type(screen.getByRole("searchbox", { name: "Qidirish" }), "ol-1")
  await waitFor(() => expect(currentUrl()).toBe("/products?search=ol-1"))

  await waitFor(() => expect(titles(screen.getByRole("table", { name: "Mahsulotlar" }))).toEqual(["Olma"]))
})

test("the services: their own columns, and the actions in the row for whoever may edit and delete", async () => {
  seedCatalog()
  await signIn(ALI)
  setLocation("/services")
  renderWithProviders(<CatalogPage kind="service" />)

  const list = await table("Xizmatlar")
  expect(screen.getByRole("heading", { level: 1, name: "Xizmatlar" })).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz xizmatlari · 1 ta")).toBeInTheDocument()
  expect(within(screen.getByRole("navigation", { name: "Mahsulotlar bo'limi" })).getByRole("link", { name: "Xizmatlar" })).toHaveAttribute("aria-current", "page")
  expect(within(list).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Xizmat", "Narx", "Qo'shgan", "Qo'shilgan", "Amallar"])
  expect(within(list).getByText("Yetkazish")).toBeInTheDocument()
  expect(within(list).getByText("50 000")).toBeInTheDocument()
  expect(within(list).getByRole("button", { name: "Tahrirlash: Yetkazish" })).toBeInTheDocument()
  expect(within(list).getByRole("button", { name: "Nofaol qilish: Yetkazish" })).toBeInTheDocument()
  expect(within(list).getByRole("button", { name: "O'chirish: Yetkazish" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Xizmat qo'shish" })).toBeInTheDocument()
})

test("an employee with the view alone sees no way to add, edit or delete", async () => {
  seedCatalog()
  giveRole(VALI, 1, "Kuzatuvchi", ["products.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/services")
  renderWithProviders(<CatalogPage kind="service" />)

  const list = await table("Xizmatlar")
  expect(within(list).getByText("Yetkazish")).toBeInTheDocument()
  expect(within(list).queryAllByRole("button")).toHaveLength(0)
  expect(screen.queryByRole("button", { name: "Xizmat qo'shish" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("without the permission the page sends the member home", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<CatalogPage kind="product" />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})

test("with no product yet the page says so, and what to do", async () => {
  await signIn(ALI)
  setLocation("/products")
  renderWithProviders(<CatalogPage kind="product" />)

  expect(await screen.findByText("Hali mahsulot yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi mahsulotni «Mahsulot qo'shish» tugmasi orqali qo'shing.")).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz mahsulotlari · 0 ta")).toBeInTheDocument()
})
