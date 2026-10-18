import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { addDays } from "@/mocks/data"
import { todayISO } from "@/lib/orders"
import type { Dashboard, Order, OrderStage } from "@/lib/types"
import { renderWithProviders } from "@/test/render"
import { UpcomingOrders } from "./upcoming-orders"

type Orders = NonNullable<Dashboard["orders"]>
const stages: OrderStage[] = [
  { id: 1, name: "Yangi", color: "blue", is_done: false },
  { id: 2, name: "Jarayonda", color: "amber", is_done: false },
]
const order = (id: number, number: number, deadline: string, stageId = 1, extra: Partial<Order> = {}): Order => ({
  id,
  type_id: 1,
  stage_id: stageId,
  location_id: 1,
  number,
  deadline,
  customer: { id: 7, phone: "998911112233", name: "Dilshod Karimov" },
  assignee: { phone: "998902223344", full_name: "Vali Aliyev" },
  values: {},
  amount: "0.00",
  currency_id: 1,
  rate: "1.0000",
  amount_uzs: "0.00",
  paid: "0.00",
  created_by_name: null,
  created_at: "2026-10-01T05:00:00Z",
  updated_at: "2026-10-01T05:00:00Z",
  ...extra,
})

test("the orders due soonest, each a way to its page with its customer, assignee and deadline; then the way to them all", () => {
  const today = todayISO()
  const orders: Orders = {
    active: 7,
    late: 1,
    by_stage: [],
    upcoming: [order(1, 2, addDays(today, -2)), order(2, 3, today, 2, { assignee: null }), order(3, 4, addDays(today, 3))],
  }
  renderWithProviders(<UpcomingOrders orders={orders} stages={stages} hasLocation canAdd onAdd={vi.fn()} />)

  expect(screen.getByRole("heading", { level: 2, name: "Yaqin muddatlar" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Yaqin muddatlar" })).toHaveAttribute("href", "/orders?view=list")
  expect(screen.getByText("Jami: 7")).toBeInTheDocument()
  const list = screen.getByRole("list", { name: "Yaqin muddatlar" })
  const rows = within(list).getAllByRole("link")
  expect(rows.map((row) => row.getAttribute("href"))).toEqual(["/orders/1", "/orders/2", "/orders/3", "/orders?view=list"])
  expect(rows[0]).toHaveAccessibleName(`Buyurtma № 2 Dilshod Karimov · Vali A. ${addDays(today, -2).slice(8, 10)}.${addDays(today, -2).slice(5, 7)} 2 kun kechikdi`)
  expect(rows[1]).toHaveTextContent("Bugun")
  expect(rows[1]).not.toHaveTextContent("·")
  expect(rows[2]).toHaveTextContent("3 kun qoldi")
  expect(rows[3]).toHaveAccessibleName("Barcha buyurtmalar")
})

test("with no order open it says so, and offers to add one to whoever may", async () => {
  const onAdd = vi.fn()
  const { rerender } = renderWithProviders(<UpcomingOrders orders={{ active: 0, late: 0, by_stage: [], upcoming: [] }} stages={stages} hasLocation canAdd onAdd={onAdd} />)

  expect(screen.getByText("Faol buyurtma yo'q")).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Buyurtma qo'shish" }))
  expect(onAdd).toHaveBeenCalledTimes(1)

  rerender(<UpcomingOrders orders={{ active: 0, late: 0, by_stage: [], upcoming: [] }} stages={stages} hasLocation canAdd={false} onAdd={onAdd} />)
  expect(screen.queryByRole("button", { name: "Buyurtma qo'shish" })).not.toBeInTheDocument()
})

test("a member with no location is told so", () => {
  renderWithProviders(<UpcomingOrders orders={{ active: 0, late: 0, by_stage: [], upcoming: [] }} stages={stages} hasLocation={false} canAdd onAdd={vi.fn()} />)

  expect(screen.getByText("Sizga lokatsiya biriktirilmagan")).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Yaqin muddatlar" })).not.toBeInTheDocument()
})

test("the heading's way to every order is the prototype's: the heading's ink, 17px and bold, with a chevron after it", () => {
  const orders: Orders = { active: 1, late: 0, by_stage: [], upcoming: [order(1, 2, todayISO())] }
  renderWithProviders(<UpcomingOrders orders={orders} stages={stages} hasLocation canAdd onAdd={vi.fn()} />)
  const link = screen.getByRole("link", { name: "Yaqin muddatlar" })
  expect(link).toHaveClass("text-[17px]", "font-semibold", "text-heading")
  expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
})
