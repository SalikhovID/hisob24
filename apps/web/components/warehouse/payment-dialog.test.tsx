import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { expect, test } from "vitest"
import { nowLocal } from "@/lib/warehouse"
import { ALI, db, seedCustomers, seedPayment, seedWarehouse } from "@/mocks/data"
import { toPayment } from "@/mocks/warehouse"
import { press } from "@/test/keypad"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { momentIn } from "@/test/moment"
import { pricedOrder } from "@/test/order-money"
import { PaymentDialog } from "./payment-dialog"

// Opened is the sheet as a page opens it (the «To'lov» tile, a payment's
// «Tahrirlash»): open from the start, closed when it says so.
function Opened(props: Omit<ComponentProps<typeof PaymentDialog>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true)
  return <PaymentDialog {...props} open={open} onOpenChange={setOpen} />
}

// typed is the figure the sheet shows, the spaces as one plain space.
const typed = (dialog: HTMLElement) => dialog.querySelector("[data-slot=amount-input] [data-slot=amount]")?.textContent?.replace(/\s+/g, " ")

test("a payment is typed on the keypad: out of the cash, now unless another moment is chosen, a note", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} partyId={bozor.id} partyName="Bozor" />)

  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  expect(within(dialog).getByText("Bozor")).toBeInTheDocument()
  // The accounts come with the session: the first one is taken once they are known.
  await waitFor(() => expect(within(dialog).getByLabelText("Akkaunt")).toHaveTextContent("Naqd (so'm)"))
  expect(momentIn(dialog)).toMatch(new RegExp(`^${nowLocal().slice(0, 13)}`))
  expect(within(dialog).queryByLabelText(/= \? so'm/)).not.toBeInTheDocument()
  await press(user, dialog, "1200,5")
  expect(typed(dialog)).toBe("1 200,5 so'm")
  await user.type(within(dialog).getByLabelText("Izoh"), " Naqd ")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "supplier_payment" && t.supplierId === bozor.id)).toMatchObject({ total: 1200.5, note: "Naqd", linkedId: null, bankAccountId: db.accounts[1][0].id, currencyId: 1 }))
  expect(await screen.findByText("To'lov qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("the sheet refuses in the API's words before asking", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} partyId={bozor.id} />)

  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Summani kiriting")).toBeInTheDocument()
  await press(user, dialog, "0")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Summa noto'g'ri")).toBeInTheDocument()
  expect(db.transactions.filter((t) => t.kind === "supplier_payment")).toHaveLength(0)
})

test("what is owed is offered whole: «To'liq» types it", async () => {
  const { bozor } = seedWarehouse()
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} partyId={bozor.id} owed="15001.50" />)

  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  expect(within(dialog).getByText(/Qarz: 15 001,50 so'm/)).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "To'liq" }))
  expect(typed(dialog)).toBe("15 001,5 so'm")
})

test("a payment entered on its own is edited: its amount comes typed, a key changes it", async () => {
  const { bozor } = seedWarehouse()
  const row = seedPayment(bozor.id, 1200.5, "2026-10-03T04:00:00Z", "Naqd")
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} partyId={bozor.id} payment={toPayment(row)} />)

  const dialog = await screen.findByRole("dialog", { name: "To'lovni tahrirlash" })
  expect(typed(dialog)).toBe("1 200,5 so'm")
  expect(momentIn(dialog)).toBe("2026-10-03T09:00")
  await press(user, dialog, "<<<<<<1500")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.transactions.find((t) => t.id === row.id)).toMatchObject({ total: 1500, note: "Naqd" }))
  expect(await screen.findByText("To'lov saqlandi")).toBeInTheDocument()
})

test("a customer's payment goes to the customer", async () => {
  const { dilshod } = seedCustomers()
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened party="customer" companyId={1} partyId={dilshod.id} />)

  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  await press(user, dialog, "700")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.find((t) => t.kind === "customer_payment" && t.customerId === dilshod.id)).toMatchObject({ total: 700, linkedId: null }))
  // The toast of an earlier test in this file may still stand beside it.
  expect((await screen.findAllByText("To'lov qo'shildi")).length).toBeGreaterThan(0)
})

test("a payment for an order goes to the order: the customer's, linked to the order's document", async () => {
  await signIn(ALI)
  const { order, dilshod } = await pricedOrder()
  const { user } = renderWithProviders(<Opened party="customer" companyId={1} partyId={dilshod.id} orderId={order.id} partyName="Montaj" />)

  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  await waitFor(() => expect(within(dialog).getByLabelText("Akkaunt")).toHaveTextContent("Naqd (so'm)"))
  await press(user, dialog, "300")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(db.transactions.at(-1)).toMatchObject({ kind: "customer_payment", total: 300, customerId: dilshod.id }))
  expect(db.transactions.at(-1)!.linkedId).toBe(db.transactions.find((t) => t.kind === "order" && t.orderId === order.id)!.id)
  // An earlier test's toast may still stand.
  expect((await screen.findAllByText("To'lov qo'shildi")).length).toBeGreaterThan(0)
})

