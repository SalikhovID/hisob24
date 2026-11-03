import { within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { HomeHero } from "./home-hero"

const cash = (totals: { currency_id: number; amount: string }[], accounts: number) => ({ totals, accounts })

test("the home's hero is what the cash holds: the so'm big, the other currencies and how many accounts under it, the way to the cash", async () => {
  db.currencies[1] = [1, 2]
  await signIn(ALI)
  const { container } = renderWithProviders(
    <HomeHero
      cash={cash(
        [
          { currency_id: 1, amount: "2500000.00" },
          { currency_id: 2, amount: "80.00" },
        ],
        4,
      )}
    />,
  )

  const hero = container.querySelector('[data-slot="hero"]') as HTMLElement
  expect(within(hero).getByText("Kassadagi pul")).toBeInTheDocument()
  expect(hero).toHaveTextContent("2 500 000")
  expect(await within(hero).findByText("+ 80 $ · 4 ta akkaunt")).toBeInTheDocument()
  expect(within(hero).getByRole("link", { name: "Kassa →" })).toHaveAttribute("href", "/accounts")
})

test("with the so'm alone the line under it is how many accounts; a cash with no so'm says 0", async () => {
  await signIn(ALI)
  const { container, rerender } = renderWithProviders(<HomeHero cash={cash([{ currency_id: 1, amount: "950000.00" }], 1)} />)
  const hero = () => container.querySelector('[data-slot="hero"]') as HTMLElement

  expect(within(hero()).getByText("1 ta akkaunt")).toBeInTheDocument()

  rerender(<HomeHero cash={cash([], 1)} />)
  expect(hero()).toHaveTextContent(/Kassadagi pul.*0/)
})
