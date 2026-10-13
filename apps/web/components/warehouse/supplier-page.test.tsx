import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, seedPayment, seedWarehouse, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { enterOpening } from "@/test/stock"
import { SupplierPage } from "./supplier-page"

// facts reads the "Ma'lumot" list: each name with its value.
const facts = () => Object.fromEntries(screen.getAllByRole("term").map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]))

test("the supplier page: its facts, what is owed, its statement, and the actions", async () => {
  const { bozor, purchase } = seedWarehouse(seedCatalog())
  seedPayment(bozor.id, 1200.5, "2026-10-03T04:00:00Z", "Naqd")
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
  expect(balance.querySelector("[data-slot=hero]")?.textContent?.replace(/\s+/g, " ").trim()).toBe("Qarz 13 801 so'm")
  expect(within(balance).getByText("20 001,50 so'm")).toBeInTheDocument()
  expect(within(balance).getByText("6 200,50 so'm")).toBeInTheDocument()

  // The statement: the documents in time, the newest first, each with how
  // it changed what is owed and what was owed after it.
  const statement = await screen.findByRole("table", { name: "Hisob harakati" })
  expect(within(statement).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Hujjat", "Vaqt", "Summa", "Qarz, so'm", "Balans, so'm", "Qo'shgan", "Amallar"])
  const rows = within(statement).getAllByRole("row").slice(1)
  expect(rows).toHaveLength(3)
  expect(within(rows[0]).getByText("To'lov")).toBeInTheDocument()
  expect(within(rows[0]).getAllByText("Naqd")).toHaveLength(1)
  expect(within(rows[0]).getByText("03.10.2026 09:00")).toBeInTheDocument()
  expect(within(rows[0]).getByText("1 200,50 so'm")).toBeInTheDocument()
  expect(within(rows[0]).getByText("−1 200,50")).toBeInTheDocument()
  expect(within(rows[0]).getByText("13 801")).toBeInTheDocument()
  expect(within(rows[0]).getByRole("button", { name: "Tahrirlash: 1\u00a0200,50" })).toBeInTheDocument()
  expect(within(rows[0]).getByRole("button", { name: "O'chirish: 1\u00a0200,50" })).toBeInTheDocument()
  expect(within(rows[1]).getByRole("link", { name: "Xarid № 1" })).toHaveAttribute("href", `/purchases/${purchase!.id}`)
  expect(within(rows[1]).getByText("5 000 so'm")).toBeInTheDocument()
  expect(within(rows[1]).getByText("−5 000")).toBeInTheDocument()
  expect(within(rows[1]).getByText("15 001,50")).toBeInTheDocument()
  expect(within(rows[1]).queryAllByRole("button")).toHaveLength(0)
  expect(within(rows[2]).getByRole("link", { name: "Xarid № 1" })).toHaveAttribute("href", `/purchases/${purchase!.id}`)
  expect(within(rows[2]).getByText("20 001,50 so'm")).toBeInTheDocument()
  expect(within(rows[2]).getByText("+20 001,50")).toBeInTheDocument()
  expect(within(rows[2]).getByText("20 001,50")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "To'lov qo'shish" })).toBeInTheDocument()
})

test("whoever may see the suppliers alone sees the facts: no balance, no statement, no action", async () => {
  const { bozor } = seedWarehouse(seedCatalog())
  giveRole(VALI, 1, "Kuzatuvchi", ["suppliers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<SupplierPage id={bozor.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Bozor" })).toBeInTheDocument()
  expect(facts()).toMatchObject({ Telefon: "+998 90 123 45 67" })
  expect(screen.queryByRole("region", { name: "Balans" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Hisob harakati" })).not.toBeInTheDocument()
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
  expect(await screen.findByText("Bu ta'minotchida hujjat yo'q")).toBeInTheDocument()
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

test("the opening balances stand in the statement with their own actions, and the statement's header adds one", async () => {
  const { bozor } = seedWarehouse(seedCatalog())
  await signIn(ALI)
  const opening = await enterOpening(bozor.id, { kind: "debt", amount: "1000000", at: "2026-09-30T09:00:00+05:00" })
  renderWithProviders(<SupplierPage id={bozor.id} />)

  const statement = await screen.findByRole("table", { name: "Hisob harakati" })
  const row = within(statement).getByText("Boshlang'ich qarz").closest("tr")!
  expect(within(row).getByRole("button", { name: "Tahrirlash: 1 000 000" })).toBeInTheDocument()
  expect(within(row).getByRole("button", { name: "O'chirish: 1 000 000" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Boshlang'ich qarz / avans" })).toBeInTheDocument()
  expect(opening.kind).toBe("debt")
})
