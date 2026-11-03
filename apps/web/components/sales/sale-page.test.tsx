import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog, seedCustomers, seedWarehouse, VALI } from "@/mocks/data"
import { stockOf } from "@/mocks/ledger"
import { addLocation, asosiyOf, restrictTo } from "@/test/locations"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { chooseCompany, signIn } from "@/test/session"
import { enterSale } from "@/test/stock"
import { SalePage } from "./sale-page"
import { moved } from "@/test/moves"

const facts = () =>
  Object.fromEntries(
    within(screen.getByRole("region", { name: "Ma'lumot" }))
      .getAllByRole("term")
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]),
  )

// sold enters Dilshod's sale of 4 Olma at 3 000 and the delivery, 5 000 paid.
async function sold() {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const { dilshod } = seedCustomers()
  const asosiy = asosiyOf(1).id
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  const cash = db.accounts[1][0].id
  const sale = await enterSale({ location_id: asosiy, customer_id: dilshod.id, at: "2026-10-05T09:00:00+05:00", note: "Kechqurun", items: [{ product_id: catalog.olma.id, quantity: "4", price: "3000" }, { product_id: catalog.yetkazish.id, quantity: "1", price: "10000" }], payments: [{ bank_account_id: cash, amount: "5000" }] })
  return { catalog, asosiy, dilshod, sale }
}

test("the sale page: its facts, its lines summed, its payments, and the actions for whoever may edit and delete", async () => {
  const { catalog, dilshod, sale } = await sold()
  renderWithProviders(<SalePage id={sale.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Sotuv № 1" })).toBeInTheDocument()
  expect(screen.getByText("05.10.2026 09:00 · Ali Valiyev")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sotuvlar" })).toHaveAttribute("href", "/sales")
  // The actions are what may be done.
  const actions = screen.getByRole("group", { name: "Amallar" })
  expect(Array.from(actions.querySelectorAll("a, button"), (action) => action.textContent)).toEqual(["Tahrirlash", "Mijoz", "O'chirish"])
  expect(within(actions).getByRole("link", { name: "Tahrirlash" })).toHaveAttribute("href", `/sales/${sale.id}/edit`)
  expect(within(actions).getByRole("link", { name: "Mijoz" })).toHaveAttribute("href", `/customers/${dilshod.id}`)
  expect(facts()).toEqual({
    Mijoz: "Dilshod Karimov",
    Vaqt: "05.10.2026 09:00",
    Lokatsiya: "Asosiy",
    Jami: "22 000 so'm",
    "To'langan": "5 000 so'm",
    Izoh: "Kechqurun",
    "Qo'shgan": "Ali Valiyev",
    "Qo'shilgan": expect.any(String),
  })
  expect(screen.getByRole("link", { name: "Dilshod Karimov" })).toHaveAttribute("href", `/customers/${dilshod.id}`)
  // The lines are rows that lead to their products: how much at what price, and the sum.
  const lines = within(screen.getByRole("list", { name: "Mahsulotlar" })).getAllByRole("link")
  expect(lines.map((line) => rowParts(line).title)).toEqual(["Olma", "Yetkazish"])
  expect(lines[0]).toHaveAttribute("href", `/products/${catalog.olma.id}`)
  expect(rowParts(lines[0]).sub?.replace(/\s+/g, " ")).toBe("4 kg × 3 000")
  expect(screen.getByText("Jami: 22 000 so'm")).toBeInTheDocument()
  const [payment] = within(screen.getByRole("list", { name: "To'lovlar" })).getAllByRole("listitem")
  expect(payment).toHaveTextContent("Naqd")
  expect(payment).toHaveTextContent("5 000 so'm")
})

test("a retail sale names nobody", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  const cash = db.accounts[1][0].id
  const sale = await enterSale({ location_id: asosiyOf(1).id, customer_id: null, at: "2026-10-06T09:00:00+05:00", items: [{ product_id: catalog.nok.id, quantity: "1", price: "2000" }], payments: [{ bank_account_id: cash, amount: "2000" }] })
  renderWithProviders(<SalePage id={sale.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Sotuv № 1" })).toBeInTheDocument()
  expect(screen.getByText("06.10.2026 09:00 · Ali Valiyev")).toBeInTheDocument()
  expect(facts()).toMatchObject({ Mijoz: "Chakana" })
  expect(screen.queryByRole("link", { name: "Mijoz" })).not.toBeInTheDocument()
  expect(facts()).not.toHaveProperty("Lokatsiya")
})

test("deleting the sale gives the products back and leads to the list", async () => {
  const { catalog, asosiy, sale } = await sold()
  const { user } = renderWithProviders(<SalePage id={sale.id} />)

  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  const dialog = await screen.findByRole("alertdialog", { name: "Sotuvni o'chirasizmi?" })
  expect(within(dialog).getByText("№ 1 sotuvi o'chiriladi, tovar qoldiqqa qaytadi, to'lovlari yo'qoladi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === sale.id)?.deleted).toBe(true))
  expect(stockOf(catalog.olma.id, [asosiy])).toBe(12.5)
  expect(await screen.findByText("Sotuv o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/sales"))
  expect(moved()).toBe("back")
})

test("a sale that is gone, or of a location the member does not work in, is not found", async () => {
  const { sale } = await sold()
  const chilonzor = addLocation(1, "Qo'yliq")
  restrictTo(VALI, 1, [chilonzor.id])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<SalePage id={sale.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Sotuv topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sotuvlar" })).toHaveAttribute("href", "/sales")
})

test("the sale's page is headed as the prototype's: «Sotuv № N» over the moment, who entered it and what is left to pay; its actions at the title's right, deleting a danger one", async () => {
  const { sale } = await sold()
  renderWithProviders(<SalePage id={sale.id} />)

  const title = (await screen.findByRole("heading", { level: 1, name: "Sotuv № 1" })).closest<HTMLElement>('[data-slot="page-title"]')
  expect(title).not.toBeNull()
  if (!title) return
  expect(within(title).getByText("05.10.2026 09:00 · Ali Valiyev")).toBeInTheDocument()
  expect(within(title).getByText("Qoldi 17 000")).toBeInTheDocument()
  const actions = within(title).getByRole("group", { name: "Amallar" })
  expect(actions).toHaveAttribute("data-slot", "page-actions")
  expect(Array.from(actions.querySelectorAll("a, button"), (action) => action.textContent)).toEqual(["Tahrirlash", "Mijoz", "O'chirish"])
  expect(within(actions).getByRole("button", { name: "O'chirish" })).toHaveAttribute("data-slot", "page-action")
  expect(document.querySelector("[data-slot=hero]")).toBeNull()
})
