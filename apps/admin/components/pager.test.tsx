import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Pager, pageNumbers } from "./pager"

// pageNumbers is the row of page buttons: every page while there are few,
// otherwise the first, the last and the current page's neighbours, with an
// ellipsis standing for the pages left out on either side.
test.each([
  [1, 3, [1, 2, 3]],
  [5, 5, [1, 2, 3, 4, 5]],
  [1, 6, [1, 2, "ellipsis", 6]],
  [3, 6, [1, 2, 3, 4, "ellipsis", 6]],
  [4, 6, [1, "ellipsis", 3, 4, 5, 6]],
  [6, 6, [1, "ellipsis", 5, 6]],
  [10, 20, [1, "ellipsis", 9, 10, 11, "ellipsis", 20]],
])("pageNumbers: page %i of %i", (page, totalPages, expected) => {
  expect(pageNumbers(page, totalPages)).toEqual(expected)
})

// buttonsOf reads the pager's buttons as the screen reader names them.
const buttonsOf = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole("button")
    .map((button) => button.getAttribute("aria-label") ?? button.textContent)

test("a list that fits one page says its total and has no pages to turn", () => {
  render(<Pager page={1} pageSize={20} total={7} onPage={() => {}} />)

  expect(screen.getByText("Jami: 7")).toBeInTheDocument()
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})

test("a longer list says how many of its records show, and turns pages by number", async () => {
  const user = userEvent.setup()
  const onPage = vi.fn()
  render(<Pager page={2} pageSize={20} total={85} onPage={onPage} />)

  expect(screen.getByText("85 tadan 20 ta ko'rsatilmoqda")).toBeInTheDocument()
  const nav = screen.getByRole("navigation", { name: "Sahifalar" })
  expect(buttonsOf(nav)).toEqual(["Oldingi", "1", "2", "3", "4", "5", "Keyingi"])
  expect(within(nav).getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page")
  expect(within(nav).getByRole("button", { name: "3" })).not.toHaveAttribute("aria-current")

  await user.click(within(nav).getByRole("button", { name: "4" }))
  await user.click(within(nav).getByRole("button", { name: "Oldingi" }))
  await user.click(within(nav).getByRole("button", { name: "Keyingi" }))

  expect(onPage.mock.calls).toEqual([[4], [1], [3]])
})

test("the first page cannot go back, the last cannot go on", () => {
  const { rerender } = render(<Pager page={1} pageSize={20} total={85} onPage={() => {}} />)
  expect(screen.getByRole("button", { name: "Oldingi" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Keyingi" })).toBeEnabled()

  rerender(<Pager page={5} pageSize={20} total={85} onPage={() => {}} />)
  // The last page holds what is left.
  expect(screen.getByText("85 tadan 5 ta ko'rsatilmoqda")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Keyingi" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Oldingi" })).toBeEnabled()
})

test("the pages left out stand as an ellipsis, named for screen readers", () => {
  render(<Pager page={10} pageSize={20} total={400} onPage={() => {}} />)

  const nav = screen.getByRole("navigation", { name: "Sahifalar" })
  expect(buttonsOf(nav)).toEqual(["Oldingi", "1", "9", "10", "11", "20", "Keyingi"])
  const ellipses = within(nav).getAllByText("Yana sahifalar")
  expect(ellipses).toHaveLength(2)
  ellipses.forEach((ellipsis) => expect(ellipsis).toHaveClass("sr-only"))
})
