import { render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { expect, test } from "vitest"
import { type OrderForm, type OrderOutput, orderDefaults } from "@/lib/orders"
import type { OrderType } from "@/lib/types"
import { VALI } from "@/mocks/data"
import { chooseCurrency, currencyGroup } from "@/test/currency"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { LinkedCustomerCard, MoneySection } from "./order-form"

test("the customer an order is for stands on a card of frosted glass, the way to let it go a small plain button", () => {
  render(<LinkedCustomerCard name="Dilshod Karimov" phone="998901112233" href="/customers/1" onUnlink={() => {}} />)
  const card = screen.getByRole("region", { name: "Mavjud mijoz" })
  expect(card).toHaveClass("surface", "rounded-group")
  expect(card).not.toHaveClass("bg-card")
  expect(screen.getByRole("button", { name: "Boshqa mijoz" })).toHaveClass("bg-muted", "text-primary")
  expect(screen.getByRole("button", { name: "Boshqa mijoz" })).not.toHaveClass("bg-primary-soft")
})

// MoneyHost is an order's money in a form of its own, opened with the
// price and the currency given; withPayments is the entry's (the advance).
function MoneyHost({ amount = "", currencyId = "1", withPayments = false }: { amount?: string; currencyId?: string; withPayments?: boolean }) {
  const form = useForm<OrderForm, unknown, OrderOutput>({
    defaultValues: { ...orderDefaults({ fields: [] } as unknown as OrderType, null, null), amount, currency_id: currencyId },
  })
  return (
    <form>
      <MoneySection form={form} companyId={2} withPayments={withPayments} canPickProducts={false} />
    </form>
  )
}

// The price has no note under it (2026-11-15), on the order's entry (with
// the advance) or on its edit.
test("the money has no note under the price, on entry or on edit", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const entry = renderWithProviders(<MoneyHost withPayments />)
  expect(await screen.findByLabelText("Narx")).toBeInTheDocument()
  expect(screen.getByRole("region", { name: "Avans" })).toBeInTheDocument()
  expect(screen.queryByText(/mijoz qarziga yoziladi/)).not.toBeInTheDocument()
  entry.unmount()

  renderWithProviders(<MoneyHost />)
  expect(await screen.findByLabelText("Narx")).toBeInTheDocument()
  expect(screen.queryByText(/mijoz qarziga yoziladi/)).not.toBeInTheDocument()
})

test("the price follows the order's currency: it is turned by the rates in force when the currency changes, not when an order opens in its own", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const { user, unmount } = renderWithProviders(<MoneyHost />)

  await user.type(screen.getByLabelText("Narx"), "1 920 000")
  await chooseCurrency(user, "USD")
  expect(screen.getByLabelText("Narx")).toHaveValue("150,00")
  await chooseCurrency(user, "UZS")
  expect(screen.getByLabelText("Narx")).toHaveValue("1 920 000,00")
  unmount()

  const opened = renderWithProviders(<MoneyHost amount="150.00" currencyId="2" />)
  expect(await screen.findByLabelText("1 USD = ? so'm")).toHaveValue("12 800")
  expect(screen.getByLabelText("Narx")).toHaveValue("150,00")
  await chooseCurrency(opened.user, "UZS")
  expect(screen.getByLabelText("Narx")).toHaveValue("1 920 000,00")
})

// The currency is chosen before the price is typed in it (2026-11-15):
// «Valyuta» stands over «Narx»; the rate stays under them.
test("the currency stands over the price", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  renderWithProviders(<MoneyHost />)

  const currency = await currencyGroup()
  expect(currency.compareDocumentPosition(screen.getByLabelText("Narx"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
})
