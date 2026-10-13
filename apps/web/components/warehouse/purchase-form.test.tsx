import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { nowLocal } from "@/lib/warehouse"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { router, setLocation } from "@/test/navigation"
import { pick } from "@/test/pick"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { choose } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
import { momentIn } from "@/test/moment"
import { NewPurchasePage } from "./new-purchase-page"

const line = (n: number) => screen.getByRole("group", { name: `${n}-qator` })
const paymentLine = (n: number) => screen.getByRole("group", { name: `${n}-to'lov` })

test("a purchase is entered into the current location: the supplier and the products found by name, the last price offered, the lines summed, a payment out of the cash", async () => {
  const catalog = seedCatalog()
  const { bozor } = seedWarehouse(catalog)
  await signIn(ALI)
  setLocation("/purchases/new")
  const { user } = renderWithProviders(<NewPurchasePage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yangi xarid" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Xaridlar" })).toHaveAttribute("href", "/purchases")
  expect(momentIn(document.body)).toMatch(new RegExp(`^${nowLocal().slice(0, 13)}`))
  expect(screen.queryByLabelText("Valyuta")).not.toBeInTheDocument()
  // The form says what saving does, and saves from the bar at the bottom.
  expect(screen.getByText("Saqlangach mahsulotlar «Asosiy» qoldig'iga qo'shiladi, to'lanmagan qismi ta'minotchi qarziga yoziladi.")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Saqlash" }).closest("[data-slot=main-bar]")).not.toBeNull()

  await pick(user, document.body, "Ta'minotchi", "bo", /Bozor/)
  expect(screen.getByRole("button", { name: /^Ta'minotchi/ })).toHaveTextContent("Bozor")

  const first = line(1)
  await pick(user, first, "Mahsulot", "ol", /Olma/)
  expect(within(first).getByLabelText("Narx")).toHaveValue("1000.00")
  await user.type(within(first).getByLabelText("Miqdor"), "2")
  expect(within(first).getByText("2 000")).toBeInTheDocument()
  expect(within(first).getByText("kg")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Qator qo'shish" }))
  const second = line(2)
  await pick(user, second, "Mahsulot", "n", /Nok/)
  expect(within(second).getByLabelText("Narx")).toHaveValue("2500.50")
  await user.type(within(second).getByLabelText("Miqdor"), "3")
  expect(within(second).getByText("7 501,5")).toBeInTheDocument()
  expect(screen.getByText("9 501,5 so'm")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  const payment = paymentLine(1)
  expect(within(payment).getByRole("button", { name: /^Akkaunt/ })).toHaveTextContent("Naqd (so'm)")
  await user.click(within(payment).getByRole("button", { name: "To'liq" }))
  expect(within(payment).getByLabelText("Summa")).toHaveValue("9501.5")
  expect(screen.getByText(/^Qolgan:/)).toHaveTextContent("Qolgan: 0 so'm")
  await user.clear(within(payment).getByLabelText("Summa"))
  await user.type(within(payment).getByLabelText("Summa"), "5 000")
  expect(screen.getByText(/^Qolgan:/)).toHaveTextContent("Qolgan: 4 501,5 so'm")
  await user.type(screen.getByLabelText("Izoh"), " Ertalab ")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "purchase" && t.number === 2)).toBeTruthy())
  const saved = db.transactions.find((t) => t.kind === "purchase" && t.number === 2)!
  expect(saved).toMatchObject({ supplierId: bozor.id, currencyId: 1, note: "Ertalab", total: 9501.5 })
  expect(saved.at.slice(0, 13)).toBe(new Date(`${nowLocal().slice(0, 13)}:00`).toISOString().slice(0, 13))
  expect(db.items.filter((i) => i.transactionId === saved.id).map((i) => [i.productId, i.quantity, i.price])).toEqual([
    [catalog.olma.id, 2, 1000],
    [catalog.nok.id, 3, 2500.5],
  ])
  expect(db.transactions.find((t) => t.linkedId === saved.id)).toMatchObject({ kind: "supplier_payment", total: 5000, bankAccountId: db.accounts[1][0].id })
  expect(await screen.findByText("Xarid qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/purchases/${saved.id}`, { transitionTypes: ["nav-forward"] }))
})

test("with more than the so'm the currency and the rate are asked, and a last price in another currency is turned", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const asosiy = db.locations.find((l) => l.companyId === 2 && l.name === "Asosiy")!
  const at = "2026-10-02T05:00:00Z"
  db.suppliers.push({ id: 801, companyId: 2, name: "Bozor", phone: null, note: null, active: true, by: VALI, byName: "Vali Aliyev", createdAt: at, updatedAt: at })
  db.products.push({ id: 802, companyId: 2, kind: "product", name: "Olma", unit: "kg", sku: null, price: null, currencyId: 1, note: null, active: true, by: VALI, byName: "Vali Aliyev", createdAt: at, updatedAt: at })
  // Bought once in dollars: the last price is 1 USD.
  db.transactions.push({ id: 803, companyId: 2, kind: "purchase", number: 1, at, locationId: asosiy.id, toLocationId: null, supplierId: 801, customerId: null, bankAccountId: null, toBankAccountId: null, categoryId: null, linkedId: null, currencyId: 2, rateId: 9001, total: 1, toTotal: null, note: null, by: VALI, byName: "Vali Aliyev", createdAt: at, updatedAt: at })
  db.items.push({ transactionId: 803, productId: 802, quantity: 1, expected: null, price: 1, position: 1 })
  setLocation("/purchases/new")
  const { user } = renderWithProviders(<NewPurchasePage />)
  await screen.findByRole("heading", { level: 1, name: "Yangi xarid" })

  expect(screen.getByLabelText("Valyuta")).toHaveTextContent("UZS — O'zbek so'mi")
  expect(screen.queryByLabelText("1 USD = ? so'm")).not.toBeInTheDocument()
  await pick(user, line(1), "Mahsulot", "ol", /Olma/)
  expect(within(line(1)).getByLabelText("Narx")).toHaveValue("12800")
  await choose(user, screen.getByLabelText("Valyuta"), "USD — AQSH dollari")
  expect(await screen.findByLabelText("1 USD = ? so'm")).toHaveValue("12800")
  await user.type(within(line(1)).getByLabelText("Miqdor"), "2")
  expect(screen.getByText("25 600 $")).toBeInTheDocument()
})

test("the form refuses in the API's words before asking: a supplier, a product and its numbers, a payment's account and amount; a product is not taken twice, a lone line not taken away", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  setLocation("/purchases/new")
  const { user } = renderWithProviders(<NewPurchasePage />)
  await screen.findByRole("heading", { level: 1, name: "Yangi xarid" })

  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("Ta'minotchini tanlang")).toBeInTheDocument()
  expect(within(line(1)).getByText("Mahsulotni tanlang")).toBeInTheDocument()
  expect(within(line(1)).getByText("Miqdor noto'g'ri")).toBeInTheDocument()
  expect(within(line(1)).getByText("Narx noto'g'ri")).toBeInTheDocument()
  expect(within(paymentLine(1)).getByText("Summa noto'g'ri")).toBeInTheDocument()
  expect(db.transactions.filter((t) => t.kind === "purchase")).toHaveLength(1)
  await user.click(screen.getByRole("button", { name: "1-to'lovni olib tashlash" }))
  expect(screen.queryByRole("group", { name: "1-to'lov" })).not.toBeInTheDocument()

  // A product of another line is not taken twice: its option is marked.
  await pick(user, line(1), "Mahsulot", "ol", /Olma/)
  await user.click(screen.getByRole("button", { name: "Qator qo'shish" }))
  await user.click(within(line(2)).getByRole("button", { name: /^Mahsulot/ }))
  const sheet = await screen.findByRole("dialog", { name: "Mahsulot" })
  expect(await within(sheet).findByRole("option", { name: /Olma/ })).toHaveAttribute("aria-disabled", "true")
  await user.keyboard("{Escape}")

  // A lone line is not taken away.
  await user.click(screen.getByRole("button", { name: "2-qatorni olib tashlash" }))
  expect(screen.queryByRole("button", { name: "1-qatorni olib tashlash" })).not.toBeInTheDocument()
})

test("a member with no location to work in is told so; one without a way to the suppliers is sent to the purchases", async () => {
  seedWarehouse(seedCatalog())
  giveRole(VALI, 1, "Omborchi", ["purchases.view", "purchases.create", "products.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/purchases/new")
  renderWithProviders(<NewPurchasePage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/purchases"))
})

test("a member with no location to work in is told so", async () => {
  seedWarehouse(seedCatalog())
  db.members[VALI].find((m) => m.companyId === 1)!.locationIds = []
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/purchases/new")
  renderWithProviders(<NewPurchasePage />)

  expect(await screen.findByText("Sizga lokatsiya biriktirilmagan")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Saqlash" })).not.toBeInTheDocument()
})

test("from a supplier's «Xarid» tile the supplier comes chosen; from a product's, the first line holds it at its last price", async () => {
  const catalog = seedCatalog()
  const { bozor } = seedWarehouse(catalog)
  await signIn(ALI)
  setLocation(`/purchases/new?supplier=${bozor.id}`)
  const { unmount } = renderWithProviders(<NewPurchasePage />)

  await waitFor(() => expect(screen.getByRole("button", { name: /^Ta'minotchi/ })).toHaveTextContent("Bozor"))
  unmount()

  setLocation(`/purchases/new?product=${catalog.olma.id}`)
  renderWithProviders(<NewPurchasePage />)

  await waitFor(() => expect(within(line(1)).getByRole("button", { name: /^Mahsulot/ })).toHaveTextContent("Olma"))
  expect(within(line(1)).getByLabelText("Narx")).toHaveValue("1000.00")
  expect(within(line(1)).getByText("kg")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /^Ta'minotchi/ })).toHaveTextContent("Tanlang")
})
