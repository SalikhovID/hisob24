import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { expect, test, vi } from "vitest"
import { liftedClass, SortableList } from "./sortable-list"

const ITEMS = [
  { id: "a", name: "Instagram" },
  { id: "b", name: "LinkedIn" },
  { id: "c", name: "YouTube" },
]

function List({ onReorder, disabled }: { onReorder?: (ids: string[]) => void; disabled?: boolean }) {
  const [items, setItems] = useState(ITEMS)
  return (
    <SortableList
      label="Variantlar"
      items={items}
      getId={(item) => item.id}
      getLabel={(item) => item.name}
      disabled={disabled}
      onReorder={(ids) => {
        onReorder?.(ids)
        setItems(ids.map((id) => ITEMS.find((item) => item.id === id)!))
      }}
      renderItem={(item, handle) => (
        <div>
          {handle}
          <span>{item.name}</span>
        </div>
      )}
    />
  )
}

const order = () => screen.getAllByRole("listitem").map((item) => item.textContent)
const handleOf = (name: string) => screen.getByRole("button", { name: `${name}: tartibini o'zgartirish` })

test("the arrow keys move the item whose handle has the focus, and the move is said aloud", async () => {
  const onReorder = vi.fn()
  render(<List onReorder={onReorder} />)

  handleOf("Instagram").focus()
  await userEvent.keyboard("{ArrowDown}")

  expect(onReorder).toHaveBeenLastCalledWith(["b", "a", "c"])
  expect(order()).toEqual(["LinkedIn", "Instagram", "YouTube"])
  expect(screen.getByText("Instagram: 3 tadan 2-o'rinda")).toBeInTheDocument()
  // The moved item keeps the focus: the next key moves it again.
  expect(handleOf("Instagram")).toHaveFocus()
  await userEvent.keyboard("{ArrowUp}")
  expect(order()).toEqual(["Instagram", "LinkedIn", "YouTube"])
})

test("Home and End take the item to either end, and nothing moves past an end", async () => {
  const onReorder = vi.fn()
  render(<List onReorder={onReorder} />)

  handleOf("YouTube").focus()
  await userEvent.keyboard("{Home}")
  expect(order()).toEqual(["YouTube", "Instagram", "LinkedIn"])
  await userEvent.keyboard("{ArrowUp}")
  expect(onReorder).toHaveBeenCalledTimes(1)
  await userEvent.keyboard("{End}")
  expect(order()).toEqual(["Instagram", "LinkedIn", "YouTube"])
  await userEvent.keyboard("{ArrowDown}")
  expect(onReorder).toHaveBeenCalledTimes(2)
})

test("the list is named, and a handle says how it is used", () => {
  render(<List />)

  expect(screen.getByRole("list", { name: "Variantlar" })).toBeInTheDocument()
  expect(handleOf("LinkedIn")).toHaveAccessibleDescription(
    "Tutqichni sudrang yoki yuqoriga va pastga strelkalar bilan siljiting. Home boshiga, End oxiriga olib boradi.",
  )
})

test("a list that may not be put in order keeps its handles off", async () => {
  const onReorder = vi.fn()
  render(<List onReorder={onReorder} disabled />)

  expect(handleOf("LinkedIn")).toBeDisabled()
})

test("while sorting is off the list has no handles: the rows are read, not moved", () => {
  render(
    <SortableList
      label="Bosqichlar"
      sorting={false}
      items={[
        { id: "1", name: "Yangi" },
        { id: "2", name: "Jarayonda" },
      ]}
      getId={(item) => item.id}
      getLabel={(item) => item.name}
      onReorder={() => {}}
      renderItem={(item, handle) => (
        <div>
          {handle}
          {item.name}
        </div>
      )}
    />,
  )
  expect(screen.getByRole("list", { name: "Bosqichlar" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /tartibini o'zgartirish/ })).not.toBeInTheDocument()
})

test("an item a finger lifts is a card of its own over the list: white in the light, a pale glass in the night, 18px round", () => {
  expect(liftedClass.split(" ")).toEqual(expect.arrayContaining(["rounded-[18px]", "bg-(--lifted)", "shadow-[0_12px_28px_rgba(60,40,120,.18)]"]))
})

test("a divider may stand before an item: a line of words between the items, itself no item and not moved", () => {
  render(
    <SortableList
      label="Panel"
      items={["Bosh sahifa", "Mijozlar", "Vazifalar"]}
      getId={(item) => item}
      getLabel={(item) => item}
      onReorder={() => {}}
      renderItem={(item, handle) => (
        <div>
          {handle}
          {item}
        </div>
      )}
      divider={{ before: 2, label: "Panelda emas · Sozlamalar sahifasida" }}
    />,
  )
  const list = screen.getByRole("list", { name: "Panel" })
  expect(within(list).getAllByRole("listitem")).toHaveLength(3)
  const divider = list.querySelector('[data-slot="sortable-divider"]')
  expect(divider).toHaveTextContent("Panelda emas · Sozlamalar sahifasida")
  expect(divider).toHaveAttribute("aria-hidden", "true")
  const items = list.querySelectorAll('[data-slot="sortable-item"]')
  expect(items[1].nextElementSibling).toBe(divider)
  expect(divider?.nextElementSibling).toBe(items[2])
})

test("a handle is the prototype's grip: two rows of three dots, upright", () => {
  render(
    <SortableList
      label="Turlar"
      items={["Jismoniy", "Yuridik"]}
      getId={(item) => item}
      getLabel={(item) => item}
      onReorder={() => {}}
      renderItem={(item, handle) => (
        <div>
          {handle}
          {item}
        </div>
      )}
    />,
  )
  const handle = screen.getByRole("button", { name: "Jismoniy: tartibini o'zgartirish" })
  expect(handle.querySelector("svg")).toHaveClass("lucide-grip-vertical")
})
