import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { EmptyState, ListLoading, Loading } from "./states"

test("EmptyState says what is missing and what would change that, as plain text", () => {
  render(
    <EmptyState
      title="Hali xodim yo'q"
      description="Xodim qo'shsangiz, u o'z telefon raqami bilan tizimga kiradi."
    />,
  )

  expect(screen.getByText("Hali xodim yo'q")).toBeInTheDocument()
  expect(screen.getByText("Xodim qo'shsangiz, u o'z telefon raqami bilan tizimga kiradi.")).toBeInTheDocument()
  // The page's headings are its sections: this is a note inside one.
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})

test("EmptyState with a title alone has one line", () => {
  const { container } = render(<EmptyState title="Kompaniyalar topilmadi" />)

  expect(screen.getByText("Kompaniyalar topilmadi")).toBeInTheDocument()
  expect(container.querySelectorAll("p")).toHaveLength(1)
})

test("ListLoading holds a list's place under one name, row by row, and is no table", () => {
  render(<ListLoading rows={4} />)

  const placeholder = screen.getByLabelText("Yuklanmoqda")
  expect(placeholder.querySelectorAll('[data-slot="list-loading-row"]')).toHaveLength(4)
  // A table on screen is how the pages (and their tests) know the list has come.
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
})

test.each([
  ["Loading", <Loading key="gate" />],
  ["ListLoading", <ListLoading key="list" />],
])("%s is a status that says it is loading, in words too; its bars are for the eyes only", (_, placeholder) => {
  render(placeholder)

  // One element carries the name: role status makes the name count, and a
  // status that is busy would not be announced, so it is not marked busy.
  const status = screen.getByRole("status", { name: "Yuklanmoqda" })
  expect(screen.getByLabelText("Yuklanmoqda")).toBe(status)
  expect(status).not.toHaveAttribute("aria-busy")
  expect(within(status).getByText("Yuklanmoqda")).toHaveClass("sr-only")
  const bars = status.querySelector('[aria-hidden="true"]')
  expect(bars?.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
})
