import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { formatDate } from "@/lib/format"
import { addLocation } from "@/test/locations"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { chooseCompany, signIn } from "@/test/session"
import { CatalogPage } from "./catalog-page"

// The list is the records' rows, a list on any screen.
const list = (name: string) => screen.findByRole("list", { name })
const rows = (list: HTMLElement) => within(list).getAllByRole("listitem").map((item) => item.firstElementChild as HTMLElement)
// parts are a row's title, line and end, the spaces as one plain space.
const parts = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
  const { title, sub, end } = rowParts(row)
  return { title: plain(title), sub: plain(sub), end: plain(end) }
}

test("the owner's products: a row each by name, the unit, SKU and the current location's stock under it, the price per unit at its end", async () => {
  const catalog = seedCatalog()
  const { olma, nok } = catalog
  seedWarehouse(catalog)
  await signIn(ALI)
  setLocation("/products")
  renderWithProviders(<CatalogPage kind="product" />)

  const products = await list("Mahsulotlar")
  expect(screen.getByRole("heading", { level: 1, name: "Mahsulotlar" })).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz mahsulotlari · 2 ta")).toBeInTheDocument()
  const tabs = screen.getByRole("navigation", { name: "Mahsulotlar bo'limi" })
  expect(within(tabs).getByRole("link", { name: "Mahsulotlar" })).toHaveAttribute("aria-current", "page")
  expect(within(tabs).getByRole("link", { name: "Xizmatlar" })).toHaveAttribute("href", "/services")
  const [nokRow, olmaRow] = rows(products)
  expect(parts(olmaRow)).toEqual({ title: "Olma", sub: "kg · OL-1 · qoldiq 12,5 kg", end: "12 000 so'm / kg" })
  expect(olmaRow).toHaveAttribute("href", `/products/${olma.id}`)
  // A product with no price says so at its end.
  expect(parts(nokRow)).toEqual({ title: "Nok", sub: "dona · qoldiq 3 dona", end: "—" })
  expect(nokRow).toHaveAttribute("href", `/products/${nok.id}`)
  expect(within(products).queryByText("Eski mahsulot")).not.toBeInTheDocument()
  expect(screen.getByText("Jami: 2")).toBeInTheDocument()
})

test("the chips say how many are active and how many are not; the inactive ones are under their own", async () => {
  seedCatalog()
  await signIn(ALI)
  setLocation("/products")
  const { user } = renderWithProviders(<CatalogPage kind="product" />)
  await list("Mahsulotlar")

  const status = screen.getByRole("radiogroup", { name: "Holat" })
  await waitFor(() => expect(within(status).getAllByRole("radio").map((chip) => chip.textContent)).toEqual(["Faol 2", "Nofaol 1"]))
  expect(within(status).getByRole("radio", { name: "Faol 2" })).toHaveAttribute("aria-checked", "true")

  await user.click(within(status).getByRole("radio", { name: "Nofaol 1" }))
  await waitFor(() => expect(currentUrl()).toBe("/products?status=inactive"))
  expect(await within(await list("Mahsulotlar")).findByText("Eski mahsulot")).toBeInTheDocument()
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

  const [, olmaRow] = rows(await list("Mahsulotlar"))
  expect(parts(olmaRow).sub).toBe("kg · OL-1 · qoldiq 0 kg")
})

test("a search looks in the names and the SKUs", async () => {
  seedCatalog()
  await signIn(ALI)
  setLocation("/products")
  const { user } = renderWithProviders(<CatalogPage kind="product" />)
  await list("Mahsulotlar")

  const search = screen.getByRole("searchbox", { name: "Qidirish" })
  expect(search).toHaveAttribute("placeholder", "Nom yoki artikul")
  await user.type(search, "ol-1")
  await waitFor(() => expect(currentUrl()).toBe("/products?search=ol-1"))

  await waitFor(async () => expect(rows(await list("Mahsulotlar")).map((row) => parts(row).title)).toEqual(["Olma"]))
})

test("the services: a row each with its note or its day, the price at its end; a press offers what may be done with it", async () => {
  const { yetkazish } = seedCatalog()
  await signIn(ALI)
  setLocation("/services")
  const { user } = renderWithProviders(<CatalogPage kind="service" />)

  const services = await list("Xizmatlar")
  expect(screen.getByRole("heading", { level: 1, name: "Xizmatlar" })).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz xizmatlari · 1 ta")).toBeInTheDocument()
  expect(screen.getByRole("searchbox", { name: "Qidirish" })).toHaveAttribute("placeholder", "Nom")
  const [row] = rows(services)
  expect(parts(row)).toEqual({ title: "Yetkazish", sub: `Qo'shilgan ${formatDate(yetkazish.createdAt)}`, end: "50 000 so'm" })

  await user.click(row)
  const sheet = await screen.findByRole("menu")
  expect(within(sheet).getByText("Yetkazish · 50 000 so'm")).toBeInTheDocument()
  expect(within(sheet).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Tahrirlash", "Nofaol qilish", "O'chirish"])

  await user.click(within(sheet).getByRole("menuitem", { name: "Nofaol qilish" }))
  await waitFor(() => expect(db.products.find((p) => p.id === yetkazish.id)?.active).toBe(false))
  expect(await screen.findByText("Xizmat nofaol qilindi")).toBeInTheDocument()
})

test("a service's sheet edits it and asks before deleting it", async () => {
  seedCatalog()
  await signIn(ALI)
  setLocation("/services")
  const { user } = renderWithProviders(<CatalogPage kind="service" />)
  const [row] = rows(await list("Xizmatlar"))

  await user.click(row)
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Tahrirlash" }))
  const dialog = await screen.findByRole("dialog", { name: "Xizmatni tahrirlash" })
  expect(within(dialog).getByLabelText("Nomi")).toHaveValue("Yetkazish")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Xizmatni tahrirlash" })).not.toBeInTheDocument())

  await user.click(row)
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "O'chirish" }))
  expect(await screen.findByRole("alertdialog", { name: "Xizmatni o'chirasizmi?" })).toBeInTheDocument()
})

test("the round + adds a product, or a service on the services' page", async () => {
  await signIn(ALI)
  setLocation("/services")
  const { user } = renderWithProviders(<CatalogPage kind="service" />)

  await user.click(await screen.findByRole("button", { name: "Xizmat qo'shish" }))

  expect(await screen.findByRole("dialog", { name: "Xizmat qo'shish" })).toBeInTheDocument()
})

test("an employee with the view alone sees no way to add, edit or delete", async () => {
  seedCatalog()
  giveRole(VALI, 1, "Kuzatuvchi", ["products.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/services")
  renderWithProviders(<CatalogPage kind="service" />)

  const services = await list("Xizmatlar")
  expect(within(services).getByText("Yetkazish")).toBeInTheDocument()
  expect(within(services).queryAllByRole("button")).toHaveLength(0)
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
