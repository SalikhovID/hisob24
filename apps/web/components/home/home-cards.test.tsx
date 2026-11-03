import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import type { Dashboard, OrderStage } from "@/lib/types"
import { HomeCards } from "./home-cards"

const none: Dashboard = { cash: null, debtors: null, orders: null, sales: null, low_stock: null }
const stages: OrderStage[] = [
  { id: 1, name: "Yangi", color: "blue", is_done: false },
  { id: 2, name: "Jarayonda", color: "amber", is_done: false },
  { id: 3, name: "Bajarildi", color: "green", is_done: true },
]
const full: Dashboard = {
  ...none,
  debtors: { debt: "12400000.50", count: 3 },
  orders: { active: 4, late: 2, by_stage: [{ stage_id: 1, count: 3 }, { stage_id: 2, count: 1 }], upcoming: [] },
  sales: { month_total: "750000.00", month_count: 2, by_day: ["0.00", "0.00", "750000.00"] },
  low_stock: { count: 3, names: ["Bolt", "Gayka", "Vint"] },
}
const card = (label: string) => screen.getByText(label).closest('[data-slot="stat-card"]') as HTMLElement

test("the cards: the active orders with their stages' bar, what the customers owe, the month's sales and the products running low, each leading to its section", () => {
  render(<HomeCards dashboard={full} stages={stages} hasLocation month="noyabr" />)

  const cards = screen.getAllByRole("link")
  expect(cards.map((c) => c.getAttribute("href"))).toEqual(["/orders", "/customers", "/sales", "/warehouse"])
  expect(within(card("Faol buyurtmalar")).getByText("4")).toBeInTheDocument()
  expect(within(card("Faol buyurtmalar")).getByRole("img", { name: "Bosqichlar: Yangi 3, Jarayonda 1" })).toBeInTheDocument()
  expect(card("Mijozlar qarzi")).toHaveTextContent("12 400 000 so'm")
  expect(card("Mijozlar qarzi")).toHaveTextContent("3 ta mijozda")
  expect(card("Noyabr sotuvlari")).toHaveTextContent("750 000 so'm")
  expect(card("Noyabr sotuvlari")).toHaveTextContent("2 ta sotuv")
  expect(card("Kam qolgan tovarlar")).toHaveTextContent("3")
  expect(card("Kam qolgan tovarlar")).toHaveTextContent("Bolt, Gayka")
  expect(card("Kam qolgan tovarlar")).not.toHaveTextContent("Vint")
})

test("with nothing running low the card says all is enough", () => {
  render(<HomeCards dashboard={{ ...none, low_stock: { count: 0, names: [] } }} stages={stages} hasLocation month="noyabr" />)

  expect(card("Kam qolgan tovarlar")).toHaveTextContent("Hammasi yetarli")
})

test("with no location the orders', the sales' and the stock's cards are out; with nothing to show there are no cards", () => {
  const { container, rerender } = render(<HomeCards dashboard={full} stages={stages} hasLocation={false} month="noyabr" />)

  expect(screen.getAllByRole("link").map((c) => c.getAttribute("href"))).toEqual(["/customers"])

  rerender(<HomeCards dashboard={none} stages={stages} hasLocation month="noyabr" />)
  expect(container.querySelector('[data-slot="stat-cards"]')).toBeNull()
})
