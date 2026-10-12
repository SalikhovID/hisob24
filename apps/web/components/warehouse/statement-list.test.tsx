import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { api, call } from "@/lib/api"
import { ALI, db, seedCatalog, seedCustomers, seedWarehouse } from "@/mocks/data"
import { asosiyOf } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { StatementList } from "./statement-list"

// A customer's statement: Dilshod bought 4 Olma at 3 000 and paid 5 000
// with it, paid 1 000 on his own, and owed 300 000 before the books.
async function dilshodsStatement() {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const { dilshod } = seedCustomers()
  await signIn(ALI)
  const cash = db.accounts[1][0].id
  const sale = await call(api.POST("/app/sales", { body: { location_id: asosiyOf(1).id, customer_id: dilshod.id, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: catalog.olma.id, quantity: "4", price: "3000" }], payments: [{ bank_account_id: cash, amount: "5000" }] } }))
  await call(api.POST("/app/customers/{id}/payments", { params: { path: { id: dilshod.id } }, body: { bank_account_id: cash, amount: "1000", at: "2026-10-06T09:00:00+05:00" } }))
  await call(api.POST("/app/customers/{id}/openings", { params: { path: { id: dilshod.id } }, body: { kind: "debt", amount: "300000", at: "2026-10-01T09:00:00+05:00" } }))
  return { dilshod, sale, cash }
}

test("a customer's statement: the sale as the way in, the payments and the opening debt with their actions, and the ways to add", async () => {
  const { dilshod, sale, cash } = await dilshodsStatement()
  const { user } = renderWithProviders(<StatementList party="customer" companyId={1} partyId={dilshod.id} canAdd canEdit canDelete />)

  const statement = await screen.findByRole("table", { name: "Hisob harakati" })
  const rows = within(statement).getAllByRole("row").slice(1)
  expect(rows).toHaveLength(4)
  expect(within(rows[0]).getByText("To'lov")).toBeInTheDocument()
  expect(within(rows[0]).getByText("−1 000")).toBeInTheDocument()
  expect(within(rows[0]).getByText("306 000")).toBeInTheDocument()
  expect(within(rows[0]).getByRole("button", { name: "Tahrirlash: 1 000" })).toBeInTheDocument()
  expect(within(rows[0]).getByRole("button", { name: "O'chirish: 1 000" })).toBeInTheDocument()
  expect(within(rows[1]).getByRole("link", { name: "Sotuv № 1" })).toHaveAttribute("href", `/sales/${sale.id}`)
  expect(within(rows[1]).getByText("−5 000")).toBeInTheDocument()
  expect(within(rows[1]).queryAllByRole("button")).toHaveLength(0)
  expect(within(rows[2]).getByRole("link", { name: "Sotuv № 1" })).toHaveAttribute("href", `/sales/${sale.id}`)
  expect(within(rows[2]).getByText("+12 000")).toBeInTheDocument()
  expect(within(rows[3]).getByText("Boshlang'ich qarz")).toBeInTheDocument()
  expect(within(rows[3]).getByRole("button", { name: "Tahrirlash: 300 000" })).toBeInTheDocument()
  expect(within(rows[3]).getByRole("button", { name: "O'chirish: 300 000" })).toBeInTheDocument()

  // A payment added here is the customer's.
  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  await user.type(within(dialog).getByLabelText("Summa, so'm"), "500")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  await waitFor(() => expect(db.transactions.filter((t) => t.kind === "customer_payment" && t.customerId === dilshod.id && !t.deleted)).toHaveLength(3))
  expect(db.transactions.find((t) => t.kind === "customer_payment" && t.total === 500)).toMatchObject({ bankAccountId: cash, linkedId: null })
  await waitFor(() => expect(within(screen.getByRole("table", { name: "Hisob harakati" })).getAllByRole("row").slice(1)).toHaveLength(5))
  expect(screen.getByRole("button", { name: "Boshlang'ich qarz / avans" })).toBeInTheDocument()
})

test("the actions follow the permissions: a reader sees the rows alone", async () => {
  const { dilshod } = await dilshodsStatement()
  renderWithProviders(<StatementList party="customer" companyId={1} partyId={dilshod.id} canAdd={false} canEdit={false} canDelete={false} />)

  const statement = await screen.findByRole("table", { name: "Hisob harakati" })
  expect(within(statement).queryAllByRole("button")).toHaveLength(0)
  expect(screen.queryByRole("button", { name: "To'lov qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Boshlang'ich qarz / avans" })).not.toBeInTheDocument()
})
