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
