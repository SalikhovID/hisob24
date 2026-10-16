import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Row } from "./group"
import { OrderedRows } from "./ordered-rows"

const types = [
  { id: 1, name: "Jismoniy" },
  { id: 2, name: "Yuridik" },
  { id: 3, name: "Hamkor" },
]

function List({ canOrder = true, items = types, onReorder = vi.fn() }: { canOrder?: boolean; items?: typeof types; onReorder?: (ids: string[]) => void }) {
  return (
    <OrderedRows
      label="Mijoz turlari"
      heading={`${items.length} ta tur`}
      items={items}
      getId={(type) => String(type.id)}
      getLabel={(type) => type.name}
      onReorder={onReorder}
      canOrder={canOrder}
      row={(type, handle) => (handle ? <Row compact media={handle} title={type.name} /> : <Row href={`/types/${type.id}`} title={type.name} />)}
    />
  )
}

test("the heading says how many; out of the ordering mode each row is the way to its record, and nothing has a handle", () => {
  render(<List />)
  expect(screen.getByRole("heading", { name: "3 ta tur" })).toBeInTheDocument()
  const list = screen.getByRole("list", { name: "Mijoz turlari" })
  expect(within(list).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/types/1", "/types/2", "/types/3"])
  expect(within(list).queryByRole("button", { name: /tartibini o'zgartirish$/ })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Tartiblash" })).toBeInTheDocument()
})

test("«Tartiblash» brings the handles: an item moved from the keyboard hands the new order on; «Tayyor» ends it", async () => {
  const onReorder = vi.fn()
  render(<List onReorder={onReorder} />)

  await userEvent.click(screen.getByRole("button", { name: "Tartiblash" }))
  const list = screen.getByRole("list", { name: "Mijoz turlari" })
  expect(within(list).queryAllByRole("link")).toHaveLength(0)
  act(() => within(list).getByRole("button", { name: "Hamkor: tartibini o'zgartirish" }).focus())
  await userEvent.keyboard("{ArrowUp}")
  expect(onReorder).toHaveBeenCalledWith(["1", "3", "2"])

  await userEvent.click(screen.getByRole("button", { name: "Tayyor" }))
  expect(within(list).queryByRole("button", { name: /tartibini o'zgartirish$/ })).not.toBeInTheDocument()
  expect(within(list).getAllByRole("link")).toHaveLength(3)
})

test("whoever may not change the order, or a list of one, is offered no ordering", () => {
  const { unmount } = render(<List canOrder={false} />)
  expect(screen.queryByRole("button", { name: "Tartiblash" })).not.toBeInTheDocument()
  unmount()

  render(<List items={types.slice(0, 1)} />)
  expect(screen.queryByRole("button", { name: "Tartiblash" })).not.toBeInTheDocument()
})

test("the ordered rows stand on frosted glass, as a group's", () => {
  render(<List />)
  const list = screen.getByRole("list", { name: "Mijoz turlari" })
  expect(list).toHaveClass("surface", "rounded-group")
  expect(list).not.toHaveClass("bg-card")
})
