import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import type { Dashboard, TaskStage } from "@/lib/types"
import { Overview } from "./overview"

const none: Dashboard = { suppliers: null, customers: null, tasks: null, purchases: null, sales: null }
const stages: TaskStage[] = [
  { id: 1, name: "Yangi", color: "blue", is_done: false },
  { id: 2, name: "Jarayonda", color: "amber", is_done: false },
  { id: 3, name: "Bajarildi", color: "green", is_done: true },
]
const full: Dashboard = {
  ...none,
  customers: { total: 12, added_this_month: 3, by_day: [9, 10, 12] },
  tasks: { active: 4, late: 2, by_stage: [{ stage_id: 1, count: 3 }, { stage_id: 2, count: 1 }], upcoming: [] },
  purchases: { month_total: "4600000.00", month_count: 6, by_day: ["0.00", "1200000.00", "4600000.00"] },
  sales: { month_total: "750000.00", month_count: 2, by_day: ["0.00", "0.00", "750000.00"] },
}

test("the overview: the tasks by stage, this month's purchases and sales, each card leading to its section", () => {
  render(<Overview dashboard={full} stages={stages} hasLocation month="oktabr" />)

  expect(screen.getByRole("heading", { level: 2, name: "Umumiy holat" })).toBeInTheDocument()
  const tasks = screen.getByRole("link", { name: /^Vazifalar/ })
  expect(tasks).toHaveAttribute("href", "/tasks")
  expect(tasks).toHaveTextContent("4 ta faol")
  expect(tasks).toHaveTextContent("2 kechikkan")
  expect(within(tasks).getByRole("img", { name: "Bosqichlar bo'yicha: Yangi 3, Jarayonda 1" })).toBeInTheDocument()
  const purchases = screen.getByRole("link", { name: /^Xaridlar/ })
  expect(purchases).toHaveAttribute("href", "/purchases")
  expect(purchases).toHaveTextContent("4,6 mln so'm")
  expect(purchases).toHaveTextContent("6 ta")
  expect(purchases).toHaveTextContent("oktabr")
  const sales = screen.getByRole("link", { name: /^Sotuv/ })
  expect(sales).toHaveAttribute("href", "/sales")
  expect(sales).toHaveTextContent("750 000 so'm")
  expect(sales).toHaveTextContent("2 ta")
  // The purchases stand where the customers would.
  expect(screen.queryByRole("link", { name: /^Mijozlar/ })).not.toBeInTheDocument()
})

test("tasks all in time say so", () => {
  render(<Overview dashboard={{ ...full, tasks: { ...full.tasks!, late: 0 } }} stages={stages} hasLocation month="oktabr" />)

  expect(screen.getByRole("link", { name: /^Vazifalar/ })).toHaveTextContent("Vaqtida")
})

test("without the purchases, the customers: how many, how many came this month", () => {
  render(<Overview dashboard={{ ...full, purchases: null }} stages={stages} hasLocation month="oktabr" />)

  const customers = screen.getByRole("link", { name: /^Mijozlar/ })
  expect(customers).toHaveAttribute("href", "/customers")
  expect(customers).toHaveTextContent("12 ta")
  expect(customers).toHaveTextContent("+3 oktabr")
})

test("with no location the tasks' and the documents' cards are out; with nothing to show there is no overview", () => {
  const { rerender } = render(<Overview dashboard={full} stages={stages} hasLocation={false} month="oktabr" />)

  expect(screen.queryByRole("link", { name: /^Vazifalar/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: /^Xaridlar/ })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: /^Sotuv/ })).not.toBeInTheDocument()
  expect(screen.getByRole("link", { name: /^Mijozlar/ })).toBeInTheDocument()

  rerender(<Overview dashboard={none} stages={stages} hasLocation month="oktabr" />)
  expect(screen.queryByRole("heading", { name: "Umumiy holat" })).not.toBeInTheDocument()
})

test("the cards stand two to a row on a phone; on a wide screen as many as fit, 300px at least each", () => {
  render(<Overview dashboard={full} stages={stages} hasLocation month="oktabr" />)
  const grid = screen.getByRole("link", { name: /^Vazifalar/ }).parentElement
  expect(grid).toHaveClass("grid-cols-2", "md:grid-cols-[repeat(auto-fill,minmax(300px,1fr))]")
  expect(grid).not.toHaveClass("md:grid-cols-4")
})

test("every card's line is drawn in the accent, the sales' too, as the prototype's", () => {
  render(<Overview dashboard={full} stages={stages} hasLocation month="oktabr" />)
  for (const name of [/^Xaridlar/, /^Sotuv/]) {
    const line = screen.getByRole("link", { name }).querySelector("svg path[stroke]")
    expect(line, String(name)).toHaveAttribute("stroke", "var(--primary)")
  }
})
