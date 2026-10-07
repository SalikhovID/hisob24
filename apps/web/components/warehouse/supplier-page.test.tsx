import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, now, nextId, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { SupplierPage } from "./supplier-page"

// facts reads the "Ma'lumot" list: each name with its value.
const facts = () => Object.fromEntries(screen.getAllByRole("term").map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]))

// ownPayment enters a payment to the supplier on its own (not with a purchase).
function ownPayment(supplierId: number, amount: number) {
  const at = now()
  db.payments.push({ id: nextId(), companyId: 1, supplierId, purchaseId: null, amount, paidOn: "2026-10-03", note: "Naqd", by: ALI, byName: "Ali Valiyev", createdAt: at, updatedAt: at })
}

test("the supplier page: its facts, what is owed, its purchases and its payments, and the actions", async () => {
  const { bozor, purchase } = seedWarehouse(seedCatalog())
  ownPayment(bozor.id, 1200.5)
  await signIn(ALI)
  renderWithProviders(<SupplierPage id={bozor.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Bozor" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Ta'minotchilar" })).toHaveAttribute("href", "/suppliers")
  expect(screen.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Nofaol qilish" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "O'chirish" })).toBeInTheDocument()
  expect(screen.queryByText("Nofaol")).not.toBeInTheDocument()
  expect(facts()).toMatchObject({ Telefon: "+998 90 123 45 67", Izoh: "Chorsu", "Qo'shgan": "Ali Valiyev" })

  // What is owed: the purchases less the payments (the one entered with
  // the purchase and the one on its own).
  const balance = screen.getByRole("region", { name: "Balans" })
  expect(within(balance).getByText("Qarz: 13 801 so'm")).toBeInTheDocument()
  expect(within(balance).getByText("20 001,50 so'm")).toBeInTheDocument()
  expect(within(balance).getByText("6 200,50 so'm")).toBeInTheDocument()

  const purchases = await screen.findByRole("table", { name: "Xaridlar" })
  expect(within(purchases).getByRole("link", { name: "№ 1" })).toHaveAttribute("href", `/purchases/${purchase!.id}`)
  const row = within(purchases).getByRole("link", { name: "№ 1" }).closest("tr")!
  expect(within(row).getByText("01.10.2026")).toBeInTheDocument()
  expect(within(row).getByText("20 001,50")).toBeInTheDocument()
  expect(within(row).getByText("5 000")).toBeInTheDocument()

  const payments = await screen.findByRole("table", { name: "To'lovlar" })
  const rows = within(payments).getAllByRole("row").slice(1)
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).getByText("03.10.2026")).toBeInTheDocument()
  expect(within(rows[0]).getByText("1 200,50")).toBeInTheDocument()
  expect(within(rows[0]).getByText("Naqd")).toBeInTheDocument()
  expect(within(rows[0]).getByRole("button", { name: "Tahrirlash: 1\u00a0200,50" })).toBeInTheDocument()
  expect(within(rows[0]).getByRole("button", { name: "O'chirish: 1\u00a0200,50" })).toBeInTheDocument()
  expect(within(rows[1]).getByText("5 000")).toBeInTheDocument()
  expect(within(rows[1]).getByRole("link", { name: "Xarid № 1" })).toHaveAttribute("href", `/purchases/${purchase!.id}`)
  expect(within(rows[1]).queryAllByRole("button")).toHaveLength(0)
  expect(screen.getByRole("button", { name: "To'lov qo'shish" })).toBeInTheDocument()
})

test("whoever may see the suppliers alone sees the facts: no balance, no purchases, no payments, no action", async () => {
  const { bozor } = seedWarehouse(seedCatalog())
  giveRole(VALI, 1, "Kuzatuvchi", ["suppliers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<SupplierPage id={bozor.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Bozor" })).toBeInTheDocument()
  expect(facts()).toMatchObject({ Telefon: "+998 90 123 45 67" })
  expect(screen.queryByRole("region", { name: "Balans" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Xaridlar" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "To'lovlar" })).not.toBeInTheDocument()
  expect(screen.queryAllByRole("button")).toHaveLength(0)
})

test("an inactive supplier says so and offers to turn it on; what it lacks is a dash; nothing yet is said", async () => {
  const { dehqon } = seedWarehouse(seedCatalog())
  await signIn(ALI)
  renderWithProviders(<SupplierPage id={dehqon.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Dehqon" })).toBeInTheDocument()
  expect(screen.getByText("Nofaol")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Faollashtirish" })).toBeInTheDocument()
  expect(facts()).toMatchObject({ Telefon: "—", Izoh: "—" })
  expect(within(screen.getByRole("region", { name: "Balans" })).getByText("Qarz yo'q")).toBeInTheDocument()
  expect(await screen.findByText("Bu ta'minotchida xarid yo'q")).toBeInTheDocument()
  expect(await screen.findByText("Bu ta'minotchida to'lov yo'q")).toBeInTheDocument()
})

test("deleting the supplier leads back to the list", async () => {
  const { dehqon } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<SupplierPage id={dehqon.id} />)

  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog", { name: "Ta'minotchini o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/suppliers"))
  expect(await screen.findByText("Ta'minotchi o'chirildi")).toBeInTheDocument()
})

test("a supplier that is gone, or another company's, is not found", async () => {
  await signIn(ALI)
  renderWithProviders(<SupplierPage id={999} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Ta'minotchi topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Ta'minotchilar" })).toHaveAttribute("href", "/suppliers")
})
