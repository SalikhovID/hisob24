import { render, screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { DataList } from "./data-list"

const rows = [
  { id: 1, name: "Olma Savdo", end: "01.11.2026" },
  { id: 2, name: "Nok Market", end: "02.10.2026" },
]
const columns = [
  { header: "Nomi", cell: (r: (typeof rows)[number]) => r.name, primary: true },
  { header: "Tugash sanasi", cell: (r: (typeof rows)[number]) => r.end },
]

test("DataList is a table on wide screens", () => {
  render(<DataList label="Kompaniyalar" items={rows} columns={columns} getKey={(r) => r.id} />)

  const table = screen.getByRole("table", { name: "Kompaniyalar" })
  expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Nomi", "Tugash sanasi"])
  const [, first, second] = within(table).getAllByRole("row")
  expect(within(first).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Olma Savdo", "01.11.2026"])
  expect(within(second).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Nok Market", "02.10.2026"])
})

test("DataList is a list of cards on phones, each value with its column's name", () => {
  render(<DataList label="Kompaniyalar" items={rows} columns={columns} getKey={(r) => r.id} />)

  const [first] = within(screen.getByRole("list", { name: "Kompaniyalar" })).getAllByRole("listitem")
  expect(within(first).getByText("Olma Savdo")).toBeInTheDocument()
  expect(within(first).getByText("Tugash sanasi")).toBeInTheDocument()
  expect(within(first).getByText("01.11.2026")).toBeInTheDocument()
})

test("DataList links each record by its title when given an href", () => {
  render(
    <DataList label="Kompaniyalar" items={rows} columns={columns} getKey={(r) => r.id} href={(r) => `/companies/${r.id}`} />,
  )

  const links = screen.getAllByRole("link", { name: "Olma Savdo" })
  expect(links).toHaveLength(2)
  links.forEach((link) => expect(link).toHaveAttribute("href", "/companies/1"))
})

test("DataList leaves a value that is not there out of the card, not out of the table", () => {
  const columnsWithAction = [
    ...columns,
    { header: "Amallar", cell: (r: (typeof rows)[number]) => (r.id === 2 ? <button type="button">O&apos;chirish</button> : null) },
  ]

  render(<DataList label="Kompaniyalar" items={rows} columns={columnsWithAction} getKey={(r) => r.id} />)

  const [first, second] = within(screen.getByRole("list", { name: "Kompaniyalar" })).getAllByRole("listitem")
  expect(within(first).queryByText("Amallar")).not.toBeInTheDocument()
  expect(within(second).getByText("Amallar")).toBeInTheDocument()
  const table = screen.getByRole("table", { name: "Kompaniyalar" })
  expect(within(within(table).getAllByRole("row")[1]).getAllByRole("cell")).toHaveLength(3)
})
