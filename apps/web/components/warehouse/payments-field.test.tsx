import { screen, within } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { expect, test } from "vitest"
import { useAccounts, useCurrencies } from "@/lib/currencies"
import type { PaymentLineForm } from "@/lib/warehouse"
import { ALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { PaymentsField } from "./payments-field"

// Host is a form of payments alone, as a purchase's or a sale's form holds them.
function Host({ total }: { total: number }) {
  const form = useForm<{ payments: PaymentLineForm[] }>({ defaultValues: { payments: [] } })
  const accounts = useAccounts()
  const currencies = useCurrencies()
  return (
    <form>
      <PaymentsField form={form} accounts={accounts} currencies={currencies} documentCurrency={1} total={total} pending={false} />
    </form>
  )
}

const payment = (n: number) => screen.getByRole("group", { name: `${n}-to'lov` })

test("the payments are the prototype's cards: the account picked in a sheet, the amount in its currency, «To'liq» for what is left; a row adds one, what is left is said under them", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Host total={10000} />)

  expect(screen.getByRole("heading", { level: 2, name: "To'lovlar" })).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  const first = payment(1)
  expect(first).toHaveAttribute("data-slot", "payment-card")
  expect(within(first).getByRole("button", { name: /^Akkaunt/ })).toHaveTextContent("Naqd (so'm)")
  expect(within(first).getByText("so'm")).toBeInTheDocument()
  expect(screen.getByText(/^Qolgan:/)).toHaveTextContent("Qolgan: 10 000 so'm")

  await user.click(within(first).getByRole("button", { name: "To'liq" }))
  expect(within(first).getByLabelText("Summa")).toHaveValue("10000")
  expect(screen.getByText(/^Qolgan:/)).toHaveTextContent("Qolgan: 0 so'm")

  await user.click(within(first).getByRole("button", { name: "1-to'lovni olib tashlash" }))
  expect(screen.queryByRole("group", { name: "1-to'lov" })).not.toBeInTheDocument()
})
