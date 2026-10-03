import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { EmptyState } from "./states"

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
