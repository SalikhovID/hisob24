import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedCustomers, seedWarehouse, VALI } from "@/mocks/data"
import { asosiyOf, restrictTo } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { enterSale } from "@/test/stock"
import { SalesPage } from "./sales-page"

// parts are a row's title, line and end, the spaces as one plain space.
const parts = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
  const { title, sub, end } = rowParts(row)
  return { title: plain(title), sub: plain(sub), end: plain(end) }
}

test("the owner's sales of the current location, the newest first, each by its number and customer, with what it came to and what was paid", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const { dilshod } = seedCustomers()
  const asosiy = asosiyOf(1).id
  await signIn(ALI)
  const cash = db.accounts[1][0].id
  const sale = await enterSale({ location_id: asosiy, customer_id: dilshod.id, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: catalog.olma.id, quantity: "4", price: "3000" }], payments: [{ bank_account_id: cash, amount: "5000" }] })
  const retail = await enterSale({ location_id: asosiy, customer_id: null, at: "2026-10-06T09:00:00+05:00", items: [{ product_id: catalog.nok.id, quantity: "1", price: "2000" }], payments: [{ bank_account_id: cash, amount: "2000" }] })
  setLocation("/sales")
  renderWithProviders(<SalesPage />)

  const list = await screen.findByRole("region", { name: "Sotuvlar" })
  expect(screen.getByRole("heading", { level: 1, name: "Sotuvlar" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy · 2 ta")).toBeInTheDocument()
  // Each day heads its sales; a sale is a row by its number and customer (or retail).
  const [retailRow] = within(within(list).getByRole("list", { name: "6-oktabr, seshanba" })).getAllByRole("link")
  expect(retailRow).toHaveAttribute("href", `/sales/${retail.id}`)
  expect(parts(retailRow)).toEqual({ title: "№ 2 · Chakana", sub: "1 ta mahsulot · Ali V.", end: "2 000 so'm To'langan" })
  const [saleRow] = within(within(list).getByRole("list", { name: "5-oktabr, dushanba" })).getAllByRole("link")
  expect(saleRow).toHaveAttribute("href", `/sales/${sale.id}`)
  expect(parts(saleRow)).toEqual({ title: "№ 1 · Dilshod Karimov", sub: "1 ta mahsulot · Ali V.", end: "12 000 so'm 5 000 to'langan" })
  expect(screen.getByText("Jami: 2")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sotuv qo'shish" })).toHaveAttribute("href", "/sales/new")
})

test("none yet; a member with no location is told so; one without the permission is sent home", async () => {
  db.cooldown = false
  seedWarehouse(seedCatalog())
  await signIn(ALI)
  setLocation("/sales")
  const { unmount } = renderWithProviders(<SalesPage />)
  expect(await screen.findByText("Hali sotuv yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi sotuvni «Sotuv qo'shish» tugmasi orqali kiriting.")).toBeInTheDocument()
  unmount()

  restrictTo(VALI, 1, [])
  await signIn(VALI)
  await chooseCompany(1)
  const second = renderWithProviders(<SalesPage />)
  expect(await screen.findByText("Sizga lokatsiya biriktirilmagan")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Sotuv qo'shish" })).not.toBeInTheDocument()
  second.unmount()

  restrictTo(VALI, 1, null)
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/sales")
  renderWithProviders(<SalesPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})
