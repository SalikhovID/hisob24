import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { api, call } from "@/lib/api"
import { ALI, db, seedCatalog, seedCustomers, seedWarehouse } from "@/mocks/data"
import { asosiyOf } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { signIn } from "@/test/session"
import { pricedOrder } from "@/test/order-money"
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

// rows are the statement's rows in their order; parts read one, the
// spaces as one plain space.
const rows = (statement: HTMLElement) => within(statement).getAllByRole("listitem").map((item) => item.firstElementChild as HTMLElement)
const parts = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
  const { title, sub, end } = rowParts(row)
  return { title: plain(title), sub: plain(sub), end: plain(end) }
}

test("a customer's statement: a row per document by its day, the newest first, its time and account under it, how it changed what is owed and what was owed after it", async () => {
  const { dilshod, sale } = await dilshodsStatement()
  renderWithProviders(<StatementList party="customer" companyId={1} partyId={dilshod.id} canAdd canEdit canDelete />)

  const statement = await screen.findByRole("region", { name: "Hisob harakati" })
  expect(within(statement).getAllByRole("list").map((day) => day.getAttribute("aria-label"))).toEqual(["6-oktabr, seshanba", "5-oktabr, dushanba", "1-oktabr, payshanba"])
  const [own, withSale, sold, opening] = rows(statement)
  expect([own, withSale, sold, opening].map(parts)).toEqual([
    { title: "To'lov", sub: "09:00 · Naqd", end: "−1 000 balans 306 000" },
    { title: "To'lov · Sotuv № 1", sub: "09:00 · Naqd", end: "−5 000 balans 307 000" },
    { title: "Sotuv № 1", sub: "09:00", end: "+12 000 balans 312 000" },
    { title: "Boshlang'ich qarz", sub: "09:00", end: "+300 000 balans 300 000" },
  ])
  // A sale, and a payment entered with it, lead to the sale; the rest are handled in their sheet.
  expect(withSale).toHaveAttribute("href", `/sales/${sale.id}`)
  expect(sold).toHaveAttribute("href", `/sales/${sale.id}`)
  expect(own.tagName).toBe("BUTTON")
  expect(opening.tagName).toBe("BUTTON")
})

test("a payment or an opening balance entered on its own is edited or deleted from its sheet of actions", async () => {
  const { dilshod } = await dilshodsStatement()
  const { user } = renderWithProviders(<StatementList party="customer" companyId={1} partyId={dilshod.id} canAdd canEdit canDelete />)
  const [own, , , opening] = rows(await screen.findByRole("region", { name: "Hisob harakati" }))

  await user.click(own)
  const sheet = await screen.findByRole("menu")
  expect(within(sheet).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Tahrirlash", "O'chirish"])
  await user.click(within(sheet).getByRole("menuitem", { name: "Tahrirlash" }))
  expect(await screen.findByRole("dialog", { name: "To'lovni tahrirlash" })).toBeInTheDocument()
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(opening)
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "O'chirish" }))
  expect(await screen.findByRole("alertdialog", { name: "Hujjatni o'chirasizmi?" })).toBeInTheDocument()
})

test("an opening balance is added from the statement's heading", async () => {
  const { dilshod } = await dilshodsStatement()
  const { user } = renderWithProviders(<StatementList party="customer" companyId={1} partyId={dilshod.id} canAdd canEdit canDelete />)
  await screen.findByRole("region", { name: "Hisob harakati" })

  await user.click(screen.getByRole("button", { name: "Boshlang'ich" }))

  expect(await screen.findByRole("dialog", { name: "Boshlang'ich qarz yoki avans" })).toBeInTheDocument()
  // A payment is the page's own tile, not the statement's.
  expect(screen.queryByRole("button", { name: "To'lov qo'shish" })).not.toBeInTheDocument()
})

test("the actions follow the permissions: a reader sees the rows alone", async () => {
  const { dilshod } = await dilshodsStatement()
  renderWithProviders(<StatementList party="customer" companyId={1} partyId={dilshod.id} canAdd={false} canEdit={false} canDelete={false} />)

  const statement = await screen.findByRole("region", { name: "Hisob harakati" })
  expect(within(statement).queryAllByRole("button")).toHaveLength(0)
  expect(screen.queryByRole("button", { name: "Boshlang'ich" })).not.toBeInTheDocument()
})

test("a customer's statement names an order by its number and leads to it, its advance too", async () => {
  await signIn(ALI)
  const { order, dilshod } = await pricedOrder()
  renderWithProviders(<StatementList party="customer" companyId={1} partyId={dilshod.id} canAdd canEdit canDelete />)

  const statement = await screen.findByRole("region", { name: "Hisob harakati" })
  const [advance, priced] = rows(statement)
  expect(parts(priced)).toMatchObject({ title: "Buyurtma № 5", end: "+5 000 balans 5 000" })
  expect(priced).toHaveAttribute("href", `/orders/${order.id}`)
  expect(parts(advance)).toMatchObject({ title: "To'lov · Buyurtma № 5", end: "−400 balans 4 600" })
  expect(advance).toHaveAttribute("href", `/orders/${order.id}`)
})

