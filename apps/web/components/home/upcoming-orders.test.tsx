import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { addDays } from "@/mocks/data"
import { formatDayMonth } from "@/lib/format"
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

test("the orders due soonest, as the prototype's rows: the customer's avatar and name, «№ N · deadline · qoldiq», the stage's badge; «Hammasi» leads to them all", () => {
  const today = todayISO()
  const orders: Orders = {
    active: 7,
    late: 1,
    by_stage: [],
    upcoming: [
      order(1, 2, addDays(today, -2)),
      order(2, 3, today, 2, { amount: "1000000.00", paid: "400000.00" }),
      order(3, 4, addDays(today, 3), 1, { amount: "50000.00", paid: "50000.00" }),
    ],
  }
  renderWithProviders(<UpcomingOrders orders={orders} stages={stages} hasLocation canAdd onAdd={vi.fn()} />)

  expect(screen.getByRole("heading", { level: 2, name: "Yaqin muddatlar" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Hammasi" })).toHaveAttribute("href", "/orders")
  const rows = within(screen.getByRole("list", { name: "Yaqin muddatlar" })).getAllByRole("link")
  expect(rows.map((row) => row.getAttribute("href"))).toEqual(["/orders/1", "/orders/2", "/orders/3"])
  expect(rows[0]).toHaveTextContent("Dilshod Karimov")
  expect(rows[0].querySelector('[data-slot="avatar"]')).not.toBeNull()
  expect(rows[0]).toHaveTextContent(`№ 2 · Muddati o'tgan · ${formatDayMonth(addDays(today, -2))}`)
  expect(within(rows[0]).getByText(`Muddati o'tgan · ${formatDayMonth(addDays(today, -2))}`)).toHaveClass("text-destructive")
  expect(within(rows[0]).getByText("Yangi")).toBeInTheDocument()
  expect(rows[1]).toHaveTextContent(`№ 3 · ${formatDayMonth(today)} · qoldiq 600 000 so'm`)
  expect(within(rows[1]).getByText("Jarayonda")).toBeInTheDocument()
  expect(rows[2]).toHaveTextContent(`№ 4 · ${formatDayMonth(addDays(today, 3))}`)
  expect(rows[2]).not.toHaveTextContent("qoldiq")
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
