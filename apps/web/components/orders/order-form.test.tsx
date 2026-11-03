import { render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { expect, test } from "vitest"
import { type OrderForm, type OrderOutput, orderDefaults } from "@/lib/orders"
import type { OrderType } from "@/lib/types"
import { VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
import { LinkedCustomerCard, MoneySection } from "./order-form"

test("the customer an order is for stands on a card of frosted glass, the way to let it go a small glass button", () => {
  render(<LinkedCustomerCard name="Dilshod Karimov" phone="998901112233" href="/customers/1" onUnlink={() => {}} />)
  const card = screen.getByRole("region", { name: "Mavjud mijoz" })
  expect(card).toHaveClass("surface", "rounded-group")
  expect(card).not.toHaveClass("bg-card")
  expect(screen.getByRole("button", { name: "Boshqa mijoz" })).toHaveClass("glass-chip", "text-primary")
  expect(screen.getByRole("button", { name: "Boshqa mijoz" })).not.toHaveClass("bg-primary-soft")
})

// MoneyHost is an order's money in a form of its own, opened with the
// price and the currency given.
function MoneyHost({ amount = "", currencyId = "1" }: { amount?: string; currencyId?: string }) {
  const form = useForm<OrderForm, unknown, OrderOutput>({
    defaultValues: { ...orderDefaults({ fields: [] } as unknown as OrderType, null, null), amount, currency_id: currencyId },
  })
  return (
    <form>
      <MoneySection form={form} companyId={2} withPayments={false} canPickProducts={false} />
    </form>
  )
}

test("the price follows the order's currency: it is turned by the rates in force when the currency changes, not when an order opens in its own", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const { user, unmount } = renderWithProviders(<MoneyHost />)

  await user.type(screen.getByLabelText("Narx"), "1 920 000")
  await choose(user, await screen.findByLabelText("Valyuta"), "USD — AQSH dollari")
  expect(screen.getByLabelText("Narx")).toHaveValue("150.00")
  await choose(user, screen.getByLabelText("Valyuta"), "UZS — O'zbek so'mi")
  expect(screen.getByLabelText("Narx")).toHaveValue("1920000.00")
  unmount()

  const opened = renderWithProviders(<MoneyHost amount="150.00" currencyId="2" />)
  expect(await screen.findByLabelText("1 USD = ? so'm")).toHaveValue("12800")
  expect(screen.getByLabelText("Narx")).toHaveValue("150.00")
  await choose(opened.user, screen.getByLabelText("Valyuta"), "UZS — O'zbek so'mi")
  expect(screen.getByLabelText("Narx")).toHaveValue("1920000.00")
})
