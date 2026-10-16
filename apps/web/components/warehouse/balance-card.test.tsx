import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { BalanceCard, BalanceChip } from "./balance-card"

// hero is the balance's figure as it reads: its label, then the amount.
const hero = () => within(screen.getByRole("region", { name: "Balans" })).getByText((_, element) => element?.getAttribute("data-slot") === "hero")
const read = (element: HTMLElement) => element.textContent?.replace(/\s+/g, " ").trim()

test("a debt is the prototype's figure: «Qarz» in red over the amount", () => {
  renderWithProviders(<BalanceCard balance="7000.00" byCurrency={null} />)

  expect(read(hero())).toBe("Qarz 7 000 so'm")
  expect(hero().querySelector("[data-slot=hero-label]")).toHaveClass("text-destructive")
})

test("an advance is green, the amount without its minus; nothing owed says so", () => {
  const { rerender } = renderWithProviders(<BalanceCard balance="-5000.50" byCurrency={null} />)
  expect(read(hero())).toBe("Avans 5 000,50 so'm")
  expect(hero().querySelector("[data-slot=hero-label]")).toHaveClass("text-positive")

  rerender(<BalanceCard balance="0.00" byCurrency={null} />)
  expect(read(hero())).toBe("Qarz yo'q 0 so'm")
})

test("what of it is in another currency is said under it; the totals stand beside it as chips", async () => {
  await signIn(ALI)
  renderWithProviders(
    <BalanceCard balance="13801.00" byCurrency={[{ currency_id: 1, amount: "13801.00" }]}>
      <BalanceChip label="Jami xaridlar" value="20 001,50 so'm" />
    </BalanceCard>,
  )

  const chip = within(screen.getByRole("region", { name: "Balans" })).getByText("Jami xaridlar").closest("[data-slot=balance-chip]") as HTMLElement
  expect(read(chip)).toBe("Jami xaridlar 20 001,50 so'm")
})

test("a total's chip is a small card of frosted glass", () => {
  renderWithProviders(<BalanceChip label="Jami xaridlar" value="12 000 so'm" />)
  const chip = screen.getByText("Jami xaridlar")
  expect(chip).toHaveClass("surface", "rounded-[14px]")
  expect(chip).not.toHaveClass("bg-card")
})
