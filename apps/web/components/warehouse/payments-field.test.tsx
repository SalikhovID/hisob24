import { screen, within } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { expect, test } from "vitest"
import { useAccounts, useCurrencies } from "@/lib/currencies"
import type { PaymentLineForm } from "@/lib/warehouse"
import { ALI, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
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
  expect(within(first).getByLabelText("Summa")).toHaveValue("10 000")
  expect(screen.getByText(/^Qolgan:/)).toHaveTextContent("Qolgan: 0 so'm")

  await user.click(within(first).getByRole("button", { name: "1-to'lovni olib tashlash" }))
  expect(screen.queryByRole("group", { name: "1-to'lov" })).not.toBeInTheDocument()
})

test("paid past the total, the form says how much more was paid: «To'liq» from an account in dollars comes to the nearest cent", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  const { user } = renderWithProviders(<Host total={50000} />)

  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  await choose(user, within(payment(1)).getByRole("button", { name: /^Akkaunt/ }), "Karta ($)")
  await user.click(within(payment(1)).getByRole("button", { name: "To'liq" }))
  // 50 000 so'm is 3,90625 $: 3,91 $ is 50 048 so'm, 48 so'm more.
  expect(within(payment(1)).getByLabelText("Summa")).toHaveValue("3,91")
  expect(screen.getByText(/^Ortiqcha:/)).toHaveTextContent("Ortiqcha: 48 so'm")
  expect(screen.queryByText(/^Qolgan:/)).not.toBeInTheDocument()

  await user.clear(within(payment(1)).getByLabelText("Summa"))
  await user.type(within(payment(1)).getByLabelText("Summa"), "3.9")
  expect(screen.getByText(/^Qolgan:/)).toHaveTextContent("Qolgan: 80 so'm")
})

test("a payment is the prototype's card of frosted glass, 24px round", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Host total={10000} />)

  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  expect(payment(1)).toHaveClass("surface", "rounded-[24px]")
  expect(payment(1)).not.toHaveClass("bg-card")
})

test("an amount typed in a payment is masked as an amount, and what is left follows it", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Host total={2000000} />)

  await user.click(screen.getByRole("button", { name: "To'lov qo'shish" }))
  await user.type(within(payment(1)).getByLabelText("Summa"), "1500000")
  expect(within(payment(1)).getByLabelText("Summa")).toHaveValue("1 500 000")
  expect(screen.getByText(/^Qolgan:/)).toHaveTextContent("Qolgan: 500 000 so'm")
})
