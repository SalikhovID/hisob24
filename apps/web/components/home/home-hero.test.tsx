import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import type { Dashboard } from "@/lib/types"
import { HomeHero } from "./home-hero"

const none: Dashboard = { suppliers: null, customers: null, orders: null, purchases: null, sales: null }
const tasks = (active: number, late: number): Dashboard["orders"] => ({ active, late, by_stage: [], upcoming: [] })

test("whoever sees the purchases is headed by what the suppliers are owed: how many owe, the advance, the way to them", () => {
  render(<HomeHero dashboard={{ ...none, suppliers: { debt: "2430000.00", debtors: 2, advance: "300000.00" }, orders: tasks(4, 2) }} locationName="Asosiy" />)

  const hero = screen.getByRole("link", { name: /^Ta'minotchilarga qarz/ })
  expect(hero).toHaveAttribute("href", "/suppliers")
  expect(hero).toHaveTextContent("2 430 000 so'm")
  expect(hero).toHaveTextContent("2 ta ta'minotchi")
  expect(hero).toHaveTextContent("Avans 300 000")
  expect(screen.queryByText("Faol vazifalar")).not.toBeInTheDocument()
})

test("with nothing owed it says so", () => {
  render(<HomeHero dashboard={{ ...none, suppliers: { debt: "0.00", debtors: 0, advance: "0.00" } }} locationName={null} />)

  const hero = screen.getByRole("link", { name: /^Ta'minotchilarga qarz/ })
  expect(hero).toHaveTextContent("Qarz yo'q")
  expect(hero).not.toHaveTextContent("Avans")
})

test("without the purchases, the tasks: how many are open, how many are late, where", () => {
  const { rerender } = render(<HomeHero dashboard={{ ...none, orders: tasks(4, 2) }} locationName="Chilonzor" />)

  const hero = screen.getByRole("link", { name: /^Faol vazifalar/ })
  expect(hero).toHaveAttribute("href", "/tasks")
  expect(hero).toHaveTextContent("4 ta")
  expect(hero).toHaveTextContent("2 ta kechikkan")
  expect(hero).toHaveTextContent("Chilonzor")

  rerender(<HomeHero dashboard={{ ...none, orders: tasks(3, 0) }} locationName="Chilonzor" />)
  expect(screen.getByRole("link", { name: /^Faol vazifalar/ })).toHaveTextContent("Hammasi vaqtida")
})

test("without the tasks either, the customers; with nothing to see, no hero", () => {
  const { rerender, container } = render(
    <HomeHero dashboard={{ ...none, customers: { total: 12, added_this_month: 3, by_day: [] } }} locationName={null} />,
  )

  expect(screen.getByRole("link", { name: /^Mijozlar/ })).toHaveTextContent("12 ta")

  rerender(<HomeHero dashboard={none} locationName={null} />)
  expect(container).toBeEmptyDOMElement()
})
