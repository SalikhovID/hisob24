import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, seedPayment, seedWarehouse, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
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
  // What may be done with it are the tiles: a payment, a purchase from it, a call, an edit.
  const tiles = screen.getByRole("group", { name: "Amallar" })
  expect(Array.from(tiles.querySelectorAll("[data-slot=tile]"), (tile) => tile.textContent)).toEqual(["To'lov", "Xarid", "Qo'ng'iroq", "Tahrirlash"])
  expect(within(tiles).getByRole("link", { name: "Xarid" })).toHaveAttribute("href", `/purchases/new?supplier=${bozor.id}`)
  expect(within(tiles).getByRole("link", { name: "Qo'ng'iroq" })).toHaveAttribute("href", "tel:+998901234567")
  expect(screen.getByRole("button", { name: "Nofaol qilish" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Ta'minotchini o'chirish" })).toBeInTheDocument()
  expect(screen.queryByText("Nofaol")).not.toBeInTheDocument()
  expect(facts()).toMatchObject({ Telefon: "+998 90 123 45 67", Izoh: "Chorsu", "Qo'shgan": "Ali Valiyev" })

  // What is owed: the purchases less the payments (the one entered with
  // the purchase and the one on its own).
  const balance = screen.getByRole("region", { name: "Balans" })
  expect(balance.querySelector("[data-slot=hero]")?.textContent?.replace(/\s+/g, " ").trim()).toBe("Qarz 13 801 so'm")
  expect(Array.from(balance.querySelectorAll("[data-slot=balance-chip]"), (chip) => chip.textContent?.replace(/\s+/g, " "))).toEqual([
    "Jami xaridlar 20 001,50 so'm",
    "Jami to'lovlar 6 200,50 so'm",
  ])
  expect(within(balance).getByText("20 001,50 so'm")).toBeInTheDocument()
  expect(within(balance).getByText("6 200,50 so'm")).toBeInTheDocument()

  // The statement: the documents in time, the newest first, each with how
  // it changed what is owed and what was owed after it.
  const statement = await screen.findByRole("list", { name: "Hisob harakati" })
  const rows = within(statement).getAllByRole("listitem").map((item) => item.firstElementChild as HTMLElement)
  expect(rows.map((row) => [rowParts(row).title, rowParts(row).sub?.replace(/\s+/g, " "), rowParts(row).end?.replace(/\s+/g, " ")])).toEqual([
    ["To'lov", "03.10.2026 09:00 · Naqd", "−1 200,50 balans 13 801"],
    ["To'lov · Xarid № 1", expect.stringMatching(/ · Naqd$/), "−5 000 balans 15 001,50"],
    ["Xarid № 1", expect.any(String), "+20 001,50 balans 20 001,50"],
  ])
  // The payment entered on its own is handled in its sheet; the purchase, and
  // the payment entered with it, lead to the purchase.
  expect(rows[0].tagName).toBe("BUTTON")
  expect(rows[1]).toHaveAttribute("href", `/purchases/${purchase!.id}`)
  expect(rows[2]).toHaveAttribute("href", `/purchases/${purchase!.id}`)
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
  expect(screen.getByText("Telefon yo'q")).toBeInTheDocument()
  // Nothing is bought from an inactive supplier, and there is no phone to call.
  const tiles = screen.getByRole("group", { name: "Amallar" })
  expect(Array.from(tiles.querySelectorAll("[data-slot=tile]"), (tile) => tile.textContent)).toEqual(["To'lov", "Tahrirlash"])
  expect(screen.getByRole("button", { name: "Faollashtirish" })).toBeInTheDocument()
  expect(facts()).toMatchObject({ Telefon: "—", Izoh: "—" })
  expect(within(screen.getByRole("region", { name: "Balans" })).getByText("Qarz yo'q")).toBeInTheDocument()
  expect(await screen.findByText("Bu ta'minotchida hujjat yo'q")).toBeInTheDocument()
})

test("deleting the supplier leads back to the list", async () => {
  const { dehqon } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<SupplierPage id={dehqon.id} />)

  await user.click(await screen.findByRole("button", { name: "Ta'minotchini o'chirish" }))
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

test("the opening balances stand in the statement with their own sheet of actions, and the statement's heading adds one", async () => {
  const { bozor } = seedWarehouse(seedCatalog())
  await signIn(ALI)
  await enterOpening(bozor.id, { kind: "debt", amount: "1000000", at: "2026-09-30T09:00:00+05:00" })
  const { user } = renderWithProviders(<SupplierPage id={bozor.id} />)

  const statement = await screen.findByRole("list", { name: "Hisob harakati" })
  await user.click(within(statement).getByRole("button", { name: /^Boshlang'ich qarz/ }))
  const sheet = await screen.findByRole("menu")
  expect(within(sheet).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Tahrirlash", "O'chirish"])
  await user.keyboard("{Escape}")
  expect(screen.getByRole("button", { name: "Boshlang'ich" })).toBeInTheDocument()
})
