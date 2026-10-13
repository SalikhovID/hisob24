import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { nowLocal } from "@/lib/warehouse"
import { ALI, db, seedCatalog, seedCustomers, seedWarehouse, VALI } from "@/mocks/data"
import { stockOf } from "@/mocks/ledger"
import { asosiyOf } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { pick } from "@/test/pick"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { enterSale } from "@/test/stock"
import { EditSalePage } from "./edit-sale-page"
import { NewSalePage } from "./new-sale-page"

const line = (n: number) => screen.getByRole("group", { name: `${n}-qator` })
const paymentLine = (n: number) => screen.getByRole("group", { name: `${n}-to'lov` })

test("a sale to a customer out of the current location: the customer found by name, the product and the service with their sale prices, a payment with it", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const { dilshod } = seedCustomers()
  await signIn(ALI)
  setLocation("/sales/new")
  const { user } = renderWithProviders(<NewSalePage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yangi sotuv" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sotuvlar" })).toHaveAttribute("href", "/sales")
  expect((screen.getByLabelText("Vaqt") as HTMLInputElement).value).toMatch(new RegExp(`^${nowLocal().slice(0, 13)}`))
  expect(screen.getByText("Chakana sotuv: to'liq to'langan bo'lishi shart")).toBeInTheDocument()

  await user.type(screen.getByRole("combobox", { name: "Mijoz" }), "dil")
  await user.click(within(await screen.findByRole("listbox", { name: "Mijoz takliflari" })).getByRole("option", { name: /Dilshod/ }))
  expect(within(screen.getByRole("group", { name: "Mijoz" })).getByText("Dilshod Karimov")).toBeInTheDocument()
  expect(screen.queryByText("Chakana sotuv: to'liq to'langan bo'lishi shart")).not.toBeInTheDocument()

  const first = line(1)
  await pick(user, first, "Mahsulot", "ol", /Olma/)
  expect(within(first).getByLabelText("Narx")).toHaveValue("12000.00")
  await user.type(within(first).getByLabelText("Miqdor"), "2")
  await user.click(screen.getByRole("button", { name: "Qator qo'shish" }))
  const second = line(2)
  await pick(user, second, "Mahsulot", "yet", /Yetkazish/)
  expect(within(second).getByLabelText("Narx")).toHaveValue("50000.00")
  await user.type(within(second).getByLabelText("Miqdor"), "1")
  expect(screen.getByText("74 000 so'm")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  await user.type(within(paymentLine(1)).getByLabelText("Summa"), "50000")
  await user.type(screen.getByLabelText("Izoh"), " Kechqurun ")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "sale")).toBeTruthy())
  const saved = db.transactions.find((t) => t.kind === "sale")!
  expect(saved).toMatchObject({ number: 1, locationId: asosiyOf(1).id, customerId: dilshod.id, total: 74000, note: "Kechqurun" })
  expect(db.items.filter((i) => i.transactionId === saved.id).map((i) => [i.productId, i.quantity, i.price])).toEqual([
    [catalog.olma.id, 2, 12000],
    [catalog.yetkazish.id, 1, 50000],
  ])
  expect(db.transactions.find((t) => t.linkedId === saved.id)).toMatchObject({ kind: "customer_payment", customerId: dilshod.id, total: 50000 })
  expect(stockOf(catalog.olma.id, [asosiyOf(1).id])).toBe(10.5)
  expect(await screen.findByText("Sotuv qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/sales/${saved.id}`))
})

test("a retail sale is paid in full with «To'liq»; the form tells the API's refusals", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  seedCustomers()
  await signIn(ALI)
  setLocation("/sales/new")
  const { user } = renderWithProviders(<NewSalePage />)
  await screen.findByRole("heading", { level: 1, name: "Yangi sotuv" })

  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await within(line(1)).findByText("Mahsulotni tanlang")).toBeInTheDocument()
  await pick(user, line(1), "Mahsulot", "n", /Nok/)
  expect(within(line(1)).getByLabelText("Narx")).toHaveValue("")
  await user.type(within(line(1)).getByLabelText("Narx"), "2000")
  await user.type(within(line(1)).getByLabelText("Miqdor"), "1")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("Mijozsiz sotuv to'liq to'langan bo'lsin")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  await user.click(within(paymentLine(1)).getByRole("button", { name: "To'liq" }))
  expect(within(paymentLine(1)).getByLabelText("Summa")).toHaveValue("2000")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(db.transactions.find((t) => t.kind === "sale")).toMatchObject({ customerId: null, total: 2000 }))
  // The toast of the earlier test in this file may still stand beside it.
  expect((await screen.findAllByText("Sotuv qo'shildi")).length).toBeGreaterThan(0)
})

test("without a way to the customers the sale is retail alone; without the products there is no form", async () => {
  db.cooldown = false
  seedWarehouse(seedCatalog())
  giveRole(VALI, 1, "Sotuvchi", ["sales.view", "sales.create", "products.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/sales/new")
  const { unmount } = renderWithProviders(<NewSalePage />)
  await screen.findByRole("heading", { level: 1, name: "Yangi sotuv" })
  expect(screen.queryByRole("combobox", { name: "Mijoz" })).not.toBeInTheDocument()
  expect(screen.getByText("Chakana sotuv: to'liq to'langan bo'lishi shart")).toBeInTheDocument()
  unmount()

  giveRole(VALI, 1, "Kassir", ["sales.view", "sales.create"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/sales/new")
  renderWithProviders(<NewSalePage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/sales"))
})

test("editing: the sale comes filled in with its customer and payment, and is saved with another quantity", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const { dilshod } = seedCustomers()
  const asosiy = asosiyOf(1).id
  await signIn(ALI)
  const cash = db.accounts[1][0].id
  const sale = await enterSale({ location_id: asosiy, customer_id: dilshod.id, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: catalog.olma.id, quantity: "4", price: "3000" }], payments: [{ bank_account_id: cash, amount: "5000" }] })
  setLocation(`/sales/${sale.id}/edit`)
  const { user } = renderWithProviders(<EditSalePage id={sale.id} />)

  expect(await screen.findByText("№ 1 · Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 1, name: "Sotuvni tahrirlash" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sotuv № 1" })).toHaveAttribute("href", `/sales/${sale.id}`)
  expect(within(screen.getByRole("group", { name: "Mijoz" })).getByText("Dilshod Karimov")).toBeInTheDocument()
  expect(within(line(1)).getByLabelText("Miqdor")).toHaveValue("4.000")
  expect(within(paymentLine(1)).getByLabelText("Summa")).toHaveValue("5000.00")
  await user.clear(within(line(1)).getByLabelText("Miqdor"))
  await user.type(within(line(1)).getByLabelText("Miqdor"), "2")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.items.find((i) => i.transactionId === sale.id)?.quantity).toBe(2))
  expect(stockOf(catalog.olma.id, [asosiy])).toBe(10.5)
  expect(await screen.findByText("Sotuv saqlandi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/sales/${sale.id}`))
})
