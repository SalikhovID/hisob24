import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { today } from "@/lib/warehouse"
import { ALI, db, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { NewPurchasePage } from "./new-purchase-page"

const line = (n: number) => screen.getByRole("group", { name: `${n}-qator` })

test("a purchase is entered into the current location: the supplier and the products found by name, the last price offered, the lines summed, what was paid", async () => {
  const catalog = seedCatalog()
  const { bozor } = seedWarehouse(catalog)
  await signIn(ALI)
  setLocation("/purchases/new")
  const { user } = renderWithProviders(<NewPurchasePage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yangi xarid" })).toBeInTheDocument()
  expect(screen.getByText("Asosiy")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Xaridlar" })).toHaveAttribute("href", "/purchases")
  expect(screen.getByLabelText("Sana")).toHaveValue(today())

  await user.type(screen.getByRole("combobox", { name: "Ta'minotchi" }), "bo")
  await user.click(within(await screen.findByRole("listbox", { name: "Ta'minotchi takliflari" })).getByRole("option", { name: /Bozor/ }))
  expect(within(screen.getByRole("group", { name: "Ta'minotchi" })).getByText("Bozor")).toBeInTheDocument()

  const first = line(1)
  await user.type(within(first).getByRole("combobox", { name: "Mahsulot" }), "ol")
  await user.click(within(await screen.findByRole("listbox", { name: "Mahsulot takliflari" })).getByRole("option", { name: /Olma/ }))
  expect(within(first).getByLabelText("Narx")).toHaveValue("1000.00")
  await user.type(within(first).getByLabelText("Miqdor"), "2")
  expect(within(first).getByText("2 000")).toBeInTheDocument()
  expect(within(first).getByText("kg")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Qator qo'shish" }))
  const second = line(2)
  await user.type(within(second).getByRole("combobox", { name: "Mahsulot" }), "n")
  await user.click(within(await screen.findByRole("listbox", { name: "Mahsulot takliflari" })).getByRole("option", { name: /Nok/ }))
  expect(within(second).getByLabelText("Narx")).toHaveValue("2500.50")
  await user.type(within(second).getByLabelText("Miqdor"), "3")
  expect(within(second).getByText("7 501,5")).toBeInTheDocument()
  expect(screen.getByText("9 501,5 so'm")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "To'liq" }))
  expect(screen.getByLabelText("To'langan")).toHaveValue("9501.5")
  await user.clear(screen.getByLabelText("To'langan"))
  await user.type(screen.getByLabelText("To'langan"), "5 000")
  await user.type(screen.getByLabelText("Izoh"), " Ertalab ")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.purchases.find((p) => p.number === 2)).toBeTruthy())
  const saved = db.purchases.find((p) => p.number === 2)!
  expect(saved).toMatchObject({ supplierId: bozor.id, purchasedOn: today(), note: "Ertalab" })
  expect(saved.items).toEqual([
    { productId: catalog.olma.id, quantity: 2, price: 1000 },
    { productId: catalog.nok.id, quantity: 3, price: 2500.5 },
  ])
  expect(db.payments.find((p) => p.purchaseId === saved.id)).toMatchObject({ amount: 5000 })
  expect(await screen.findByText("Xarid qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/purchases/${saved.id}`))
})

test("the form refuses in the API's words before asking: a supplier, a product and its numbers, at least one line, a product once", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  await signIn(ALI)
  setLocation("/purchases/new")
  const { user } = renderWithProviders(<NewPurchasePage />)
  await screen.findByRole("heading", { level: 1, name: "Yangi xarid" })

  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("Ta'minotchini tanlang")).toBeInTheDocument()
  expect(within(line(1)).getByText("Mahsulotni tanlang")).toBeInTheDocument()
  expect(within(line(1)).getByText("Miqdor noto'g'ri")).toBeInTheDocument()
  expect(within(line(1)).getByText("Narx noto'g'ri")).toBeInTheDocument()
  expect(db.purchases).toHaveLength(1)

  await user.click(screen.getByRole("button", { name: "Qator qo'shish" }))
  for (const n of [1, 2]) {
    await user.type(within(line(n)).getByRole("combobox", { name: "Mahsulot" }), "ol")
    await user.click(within(await screen.findByRole("listbox", { name: "Mahsulot takliflari" })).getByRole("option", { name: /Olma/ }))
    await user.type(within(line(n)).getByLabelText("Miqdor"), "1")
  }
  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await within(line(2)).findByText("Bu mahsulot allaqachon kiritilgan")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "2-qatorni olib tashlash" }))
  await user.click(screen.getByRole("button", { name: "1-qatorni olib tashlash" }))
  expect(screen.queryByRole("group", { name: "1-qator" })).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("Kamida bitta mahsulot qo'shing")).toBeInTheDocument()
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
