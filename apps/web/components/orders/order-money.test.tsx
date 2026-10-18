import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, localToday, seedCatalog, seedOrders, seedWarehouse, VALI } from "@/mocks/data"
import { stockOf } from "@/mocks/ledger"
import { press } from "@/test/keypad"
import { asosiyOf } from "@/test/locations"
import { setLocation } from "@/test/navigation"
import { pricedOrder } from "@/test/order-money"
import { pick } from "@/test/pick"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { chooseCompany, signIn } from "@/test/session"
import { OrderPage } from "./order-page"
import { OrdersPage } from "./orders-page"

// plain is a text with its spaces as one plain space (the amounts stand
// apart by no-break spaces).
const plain = (text: string | null | undefined) => text?.replace(/\s+/g, " ") ?? null
const setDate = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })

// An order is entered with its price, a product from the stock and an
// advance (logic/orders.md, 4.3); the list's row says the price and what
// is left of it.
test("the order dialog takes a price, the goods and an advance; the row says what is left", async () => {
  await signIn(ALI)
  seedOrders()
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  setLocation("/orders?view=list")
  const { user } = renderWithProviders(<OrdersPage />)
  await user.click((await screen.findAllByRole("button", { name: "Buyurtma qo'shish" }))[0])
  const dialog = await screen.findByRole("dialog", { name: "Buyurtma qo'shish" })

  const customer = within(dialog).getByRole("group", { name: "Mijoz" })
  await user.type(within(customer).getByRole("combobox", { name: "Telefon raqami" }), "911")
  await user.click(await screen.findByRole("option", { name: /91 111 22 33/ }))
  const order = within(dialog).getByRole("group", { name: "Buyurtma" })
  await user.type(within(order).getByLabelText("Nomi"), "Montaj")
  setDate(within(order).getByLabelText("Muddat"), localToday())
  // The money: the price in so'm (the company has no other currency), the
  // lines of goods and the advance's payments.
  const money = within(dialog).getByRole("group", { name: "Narx" })
  expect(within(money).queryByLabelText("Valyuta")).not.toBeInTheDocument()
  await user.type(within(money).getByLabelText("Narx"), "5000")
  await user.click(within(dialog).getByRole("button", { name: "Qator qo'shish" }))
  const line = within(dialog).getByRole("group", { name: "1-qator" })
  await pick(user, line, "Mahsulot", "ol", /Olma/)
  await user.type(within(line).getByLabelText("Miqdor"), "2")
  expect(within(line).queryByLabelText("Narx")).not.toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "To'lov qo'shish" }))
  await user.type(within(within(dialog).getByRole("group", { name: "1-to'lov" })).getByLabelText("Summa"), "400")
  expect(plain(within(dialog).getByText(/^Qolgan:/).textContent)).toBe("Qolgan: 4 600 so'm")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  const entered = db.orders.at(-1)!
  const document = db.transactions.find((t) => t.kind === "order" && t.orderId === entered.id)!
  expect(document).toMatchObject({ total: 5000, customerId: entered.customerId, locationId: asosiyOf(1).id })
  expect(db.transactions.find((t) => t.kind === "customer_payment" && t.linkedId === document.id)).toMatchObject({ total: 400 })
  expect(stockOf(catalog.olma.id, [asosiyOf(1).id])).toBe(10.5)
  const row = await within(screen.getByRole("region", { name: "Buyurtmalar" })).findByRole("link", { name: /^Montaj/ })
  expect(plain(rowParts(row).sub)).toContain("5 000 so'm · qolgan 4 600 so'm")
})

// The order's page shows its money, its goods with their cost and the
// payments; a payment is entered and deleted there (logic/orders.md, 4.3–4.4).
test("the order's page: the price, what was paid and what is left, the goods with their cost and the profit, the payments; a payment is added and deleted", async () => {
  await signIn(ALI)
  const { order, cash } = await pricedOrder()
  setLocation(`/orders/${order.id}`, { id: String(order.id) })
  const { user } = renderWithProviders(<OrderPage id={order.id} />)

  const money = await screen.findByRole("region", { name: "Pul" })
  expect(plain(money.textContent)).toContain("Narx5 000 so'm")
  expect(plain(money.textContent)).toContain("To'langan400 so'm")
  expect(plain(money.textContent)).toContain("Qolgan4 600 so'm")
  const goods = screen.getByRole("region", { name: "Mahsulotlar" })
  const [olma] = within(goods).getAllByRole("listitem")
  expect(plain(rowParts(olma.firstElementChild as HTMLElement).title)).toBe("Olma")
  expect(plain(rowParts(olma.firstElementChild as HTMLElement).sub)).toBe("2 kg")
  expect(plain(rowParts(olma.firstElementChild as HTMLElement).end)).toBe("2 000 so'm")
  expect(plain(goods.textContent)).toContain("Tan narxi2 000 so'm")
  expect(plain(goods.textContent)).toContain("Foyda3 000 so'm")
  const payments = screen.getByRole("region", { name: "To'lovlar" })
  expect(within(payments).getAllByRole("listitem")).toHaveLength(1)
  expect(plain(rowParts(within(payments).getAllByRole("listitem")[0].firstElementChild as HTMLElement).end)).toBe("400 so'm")

  // A payment on its own: typed on the keypad, into the cash, now.
  await user.click(within(screen.getByRole("group", { name: "Amallar" })).getByRole("button", { name: "To'lov" }))
  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  await waitFor(() => expect(within(dialog).getByLabelText("Akkaunt")).toHaveTextContent("Naqd"))
  await press(user, dialog, "300")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(() => expect(plain(screen.getByRole("region", { name: "Pul" }).textContent)).toContain("Qolgan4 300 so'm"))
  const document = db.transactions.find((t) => t.kind === "order" && t.orderId === order.id)!
  expect(db.transactions.filter((t) => t.linkedId === document.id && !t.deleted).map((t) => t.total)).toEqual([400, 300])
  expect(db.transactions.at(-1)).toMatchObject({ kind: "customer_payment", total: 300, bankAccountId: cash, linkedId: document.id })

  // A payment's row opens its actions; deleting it gives the money back.
  const rows = within(screen.getByRole("region", { name: "To'lovlar" })).getAllByRole("listitem")
  expect(rows).toHaveLength(2)
  await user.click(within(rows[0]).getByRole("button"))
  await user.click(await screen.findByRole("menuitem", { name: "O'chirish" }))
  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  await waitFor(() => expect(plain(screen.getByRole("region", { name: "Pul" }).textContent)).toContain("Qolgan4 600 so'm"))
  expect(db.transactions.filter((t) => t.linkedId === document.id && !t.deleted).map((t) => t.total)).toEqual([400])
})

test("without purchases.view the goods are listed without their cost; an order without money shows no money", async () => {
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  giveRole(VALI, 1, "Sotuvchi", ["orders.view", "orders.edit"])
  await signIn(ALI)
  const { order } = await pricedOrder()
  await signIn(VALI)
  await chooseCompany(1)
  setLocation(`/orders/${order.id}`, { id: String(order.id) })
  renderWithProviders(<OrderPage id={order.id} />)

  const goods = await screen.findByRole("region", { name: "Mahsulotlar" })
  expect(plain(goods.textContent)).not.toContain("Tan narxi")
  expect(plain(goods.textContent)).not.toContain("Foyda")
  expect(plain(screen.getByRole("region", { name: "Pul" }).textContent)).toContain("Narx5 000 so'm")
})

test("an order entered without money shows none of it", async () => {
  await signIn(ALI)
  const { order } = await pricedOrder({ title: "Qo'ng'iroq", amount: undefined, items: [], payments: [] })
  setLocation(`/orders/${order.id}`, { id: String(order.id) })
  renderWithProviders(<OrderPage id={order.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq" })).toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "Pul" })).not.toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "Mahsulotlar" })).not.toBeInTheDocument()
  expect(screen.queryByRole("region", { name: "To'lovlar" })).not.toBeInTheDocument()
  expect(within(screen.getByRole("group", { name: "Amallar" })).getByRole("button", { name: "To'lov" })).toBeInTheDocument()
})
