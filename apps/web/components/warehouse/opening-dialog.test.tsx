import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { nowLocal } from "@/lib/warehouse"
import { ALI, db, seedCustomers, seedWarehouse, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
import { enterOpening } from "@/test/stock"
import { OpeningDialog } from "./opening-dialog"

test("an opening debt is entered: the kind chosen, the amount typed the Uzbek way, now unless another moment is chosen, a note", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<OpeningDialog companyId={1} partyId={bozor.id} />)

  await user.click(screen.getByRole("button", { name: "Boshlang'ich qarz / avans" }))
  const dialog = await screen.findByRole("dialog", { name: "Boshlang'ich qarz yoki avans" })
  expect((within(dialog).getByLabelText("Vaqt") as HTMLInputElement).value).toMatch(new RegExp(`^${nowLocal().slice(0, 13)}`))
  expect(within(dialog).queryByRole("combobox", { name: "Valyuta" })).not.toBeInTheDocument()
  await choose(user, within(dialog).getByRole("combobox", { name: "Tur" }), "Qarz")
  await user.type(within(dialog).getByLabelText("Summa, so'm"), "1 000 000")
  await user.type(within(dialog).getByLabelText("Izoh"), " Eski qarz ")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "supplier_debt" && t.supplierId === bozor.id)).toMatchObject({ total: 1000000, note: "Eski qarz", currencyId: 1 }))
  expect(await screen.findByText("Hujjat qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("the dialog refuses in the API's words before asking", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<OpeningDialog companyId={1} partyId={bozor.id} />)

  await user.click(screen.getByRole("button", { name: "Boshlang'ich qarz / avans" }))
  const dialog = await screen.findByRole("dialog", { name: "Boshlang'ich qarz yoki avans" })
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Turni tanlang")).toBeInTheDocument()
  expect(within(dialog).getByText("Summani kiriting")).toBeInTheDocument()
  expect(db.transactions.filter((t) => t.kind === "supplier_debt" || t.kind === "supplier_prepay")).toHaveLength(0)
})

test("with more than the so'm an advance is entered in dollars at the rate in force", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const at = "2026-10-02T05:00:00Z"
  db.suppliers.push({ id: 801, companyId: 2, name: "Bozor", phone: null, note: null, active: true, by: VALI, byName: "Vali Aliyev", createdAt: at, updatedAt: at })
  const { user } = renderWithProviders(<OpeningDialog companyId={2} partyId={801} />)

  await user.click(screen.getByRole("button", { name: "Boshlang'ich qarz / avans" }))
  const dialog = await screen.findByRole("dialog", { name: "Boshlang'ich qarz yoki avans" })
  await choose(user, within(dialog).getByRole("combobox", { name: "Tur" }), "Avans")
  expect(within(dialog).getByRole("combobox", { name: "Valyuta" })).toHaveTextContent("UZS — O'zbek so'mi")
  expect(within(dialog).queryByLabelText("1 USD = ? so'm")).not.toBeInTheDocument()
  await choose(user, within(dialog).getByRole("combobox", { name: "Valyuta" }), "USD — AQSH dollari")
  expect(await within(dialog).findByLabelText("1 USD = ? so'm")).toHaveValue("12800")
  await user.type(within(dialog).getByLabelText("Summa, $"), "10")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "supplier_prepay" && t.supplierId === 801)).toMatchObject({ total: 10, currencyId: 2, rateId: 9001 }))
})

test("an opening balance is edited from its row, by its icon; its kind stays", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const opening = await enterOpening(bozor.id, { kind: "debt", amount: "1000000", at: "2026-10-03T09:00:00+05:00", note: "Eski qarz" })
  const { user } = renderWithProviders(<OpeningDialog companyId={1} partyId={bozor.id} opening={opening} iconOnly />)

  await user.click(screen.getByRole("button", { name: "Tahrirlash: 1 000 000" }))
  const dialog = await screen.findByRole("dialog", { name: "Hujjatni tahrirlash" })
  const kind = within(dialog).getByRole("combobox", { name: "Tur" })
  expect(kind).toHaveTextContent("Qarz")
  // A Base UI select that is disabled: jsdom shows disabled or aria-disabled.
  expect(kind.hasAttribute("disabled") || kind.getAttribute("aria-disabled") === "true").toBe(true)
  expect(within(dialog).getByLabelText("Summa, so'm")).toHaveValue("1000000.00")
  expect(within(dialog).getByLabelText("Vaqt")).toHaveValue("2026-10-03T09:00")
  expect(within(dialog).getByLabelText("Izoh")).toHaveValue("Eski qarz")
  await user.clear(within(dialog).getByLabelText("Summa, so'm"))
  await user.type(within(dialog).getByLabelText("Summa, so'm"), "1500")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === opening.id)).toMatchObject({ kind: "supplier_debt", total: 1500 }))
  expect(await screen.findByText("Hujjat saqlandi")).toBeInTheDocument()
})

test("a customer's opening advance goes to the customer", async () => {
  const { dilshod } = seedCustomers()
  await signIn(ALI)
  const { user } = renderWithProviders(<OpeningDialog party="customer" companyId={1} partyId={dilshod.id} />)

  await user.click(screen.getByRole("button", { name: "Boshlang'ich qarz / avans" }))
  const dialog = await screen.findByRole("dialog", { name: "Boshlang'ich qarz yoki avans" })
  await choose(user, within(dialog).getByRole("combobox", { name: "Tur" }), "Avans")
  await user.type(within(dialog).getByLabelText("Summa, so'm"), "50 000")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "customer_prepay" && t.customerId === dilshod.id)).toMatchObject({ total: 50000 }))
  // The toast of an earlier test in this file may still stand beside it.
  expect((await screen.findAllByText("Hujjat qo'shildi")).length).toBeGreaterThan(0)
})
