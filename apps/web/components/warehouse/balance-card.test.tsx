import { screen, waitFor } from "@testing-library/react"
import { expect, test } from "vitest"
import { db, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { BalanceStat } from "./balance-card"

// card is the balance's card as it reads: its label, the amount and the
// line under it; value is its amount.
const card = () => document.querySelector<HTMLElement>("[data-slot=stat-card]")!
const value = () => card().querySelector("[data-slot=stat-value]")
const read = (element: HTMLElement) => element.textContent?.replace(/\s+/g, " ").trim()

test("a debt is the prototype's «Balans» card: the amount red, «Qarz» under it", () => {
  renderWithProviders(<BalanceStat balance="7000.00" byCurrency={null} />)

  expect(read(card())).toBe("Balans 7 000 so'm Qarz")
  expect(value()).toHaveClass("text-destructive")
})

test("an advance is green, the amount without its minus; nothing owed says so", () => {
  const { rerender } = renderWithProviders(<BalanceStat balance="-5000.50" byCurrency={null} />)
  expect(read(card())).toBe("Balans 5 000,50 so'm Avans")
  expect(value()).toHaveClass("text-positive")

  rerender(<BalanceStat balance="0.00" byCurrency={null} />)
  expect(read(card())).toBe("Balans 0 so'm Qarz yo'q")
})

test("what of it is in each currency is said in words under it, without signs: what is owed, then what is paid ahead; a currency even is left out", async () => {
  db.currencies[2] = [1, 2, 3, 4]
  await signIn(VALI)
  await chooseCompany(2)
  // The symbols come with the session: what is said is read once they are known.
  const customer = renderWithProviders(<BalanceStat balance="-104000.00" byCurrency={[{ currency_id: 1, amount: "88000.00" }, { currency_id: 2, amount: "-15.00" }]} />)
  await waitFor(() => expect(read(card())).toBe("Balans 104 000 so'm Avans · qarz 88 000 so'm, avans 15 $"))
  customer.unmount()

  renderWithProviders(
    <BalanceStat
      balance="4119952.00"
      byCurrency={[
        { currency_id: 1, amount: "1090000.00" },
        { currency_id: 2, amount: "346.09" },
        { currency_id: 3, amount: "-100.00" },
        { currency_id: 4, amount: "0.00" },
      ]}
    />,
  )
  await waitFor(() => expect(read(card())).toBe("Balans 4 119 952 so'm Qarz · qarz 1 090 000 so'm, 346,09 $, avans 100 €"))
})

test("a currency other than the so'm left even says nothing more under the balance", async () => {
  db.currencies[2] = [1, 2]
  await signIn(VALI)
  await chooseCompany(2)
  renderWithProviders(<BalanceStat balance="-20000.00" byCurrency={[{ currency_id: 2, amount: "0.00" }]} />)

  expect(await screen.findByText("Avans")).toBeInTheDocument()
  expect(read(card())).toBe("Balans 20 000 so'm Avans")
})
