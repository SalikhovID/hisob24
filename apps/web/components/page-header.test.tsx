import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { PageHeader } from "./page-header"

test("PageHeader names the page, says what it holds and carries its actions", () => {
  render(
    <PageHeader
      title="Xodimlar"
      description="Kompaniyangiz a'zolari · 3 kishi"
      actions={<button type="button">Xodim qo&apos;shish</button>}
    />,
  )

  expect(screen.getByRole("heading", { level: 1, name: "Xodimlar" })).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz a'zolari · 3 kishi")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Xodim qo'shish" })).toBeInTheDocument()
})

test("PageHeader with a name alone is the name alone", () => {
  const { container } = render(<PageHeader title="Adminlar" />)

  expect(screen.getByRole("heading", { level: 1, name: "Adminlar" })).toBeInTheDocument()
  expect(container.querySelector("p")).not.toBeInTheDocument()
})

test("PageHeader leads back when there is a way back", () => {
  const { rerender } = render(<PageHeader title="Olma Savdo" back={{ href: "/companies", label: "Kompaniyalar" }} />)

  expect(screen.getByRole("link", { name: "Kompaniyalar" })).toHaveAttribute("href", "/companies")

  rerender(<PageHeader title="Olma Savdo" />)
  expect(screen.queryByRole("link")).not.toBeInTheDocument()
})

test("PageHeader shows a mark beside the name, outside the heading", () => {
  render(<PageHeader title="Olma Savdo" avatar={<span aria-hidden="true">OS</span>} />)

  const heading = screen.getByRole("heading", { level: 1, name: "Olma Savdo" })
  const mark = screen.getByText("OS")
  // The heading stays the name alone: whatever reads it reads no initials.
  expect(heading).toHaveTextContent(/^Olma Savdo$/)
  expect(heading).not.toContainElement(mark)
  expect(heading.parentElement).toContainElement(mark)
})
