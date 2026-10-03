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

test("DataList is a table on wide screens, each record's title heading its row", () => {
  render(<DataList label="Kompaniyalar" items={rows} columns={columns} getKey={(r) => r.id} />)

  const table = screen.getByRole("table", { name: "Kompaniyalar" })
  expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Nomi", "Tugash sanasi"])
  const [, first, second] = within(table).getAllByRole("row")
  expect(within(first).getByRole("rowheader")).toHaveTextContent("Olma Savdo")
  expect(within(first).getAllByRole("cell").map((c) => c.textContent)).toEqual(["01.11.2026"])
  expect(within(second).getByRole("rowheader")).toHaveTextContent("Nok Market")
  expect(within(second).getAllByRole("cell").map((c) => c.textContent)).toEqual(["02.10.2026"])
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
  const row = within(within(table).getAllByRole("row")[1])
  expect(row.getAllByRole("rowheader")).toHaveLength(1)
  expect(row.getAllByRole("cell")).toHaveLength(2)
})

test("DataList puts a record's actions at the top of its card, without the column's name", () => {
  const columnsWithActions = [
    ...columns,
    {
      header: "Amallar",
      actions: true,
      cell: (r: (typeof rows)[number]) => (r.id === 2 ? <button type="button">O&apos;chirish</button> : null),
    },
  ]

  render(<DataList label="Kompaniyalar" items={rows} columns={columnsWithActions} getKey={(r) => r.id} />)

  const [first, second] = within(screen.getByRole("list", { name: "Kompaniyalar" })).getAllByRole("listitem")
  expect(within(second).getByRole("button", { name: "O'chirish" })).toBeInTheDocument()
  expect(within(second).queryByText("Amallar")).not.toBeInTheDocument()
  expect(second.querySelector('[data-slot="data-list-actions"]')).toBeInTheDocument()
  // A record with nothing to do has no place kept for actions.
  expect(first.querySelector('[data-slot="data-list-actions"]')).not.toBeInTheDocument()
  // The table still names the column, for screen readers.
  const table = screen.getByRole("table", { name: "Kompaniyalar" })
  expect(within(table).getByRole("columnheader", { name: "Amallar" })).toBeInTheDocument()
})

test("DataList puts a card's inline values in one line under its title: a tag bare, a value after its name", () => {
  const people = [
    { id: 1, name: "Vali Aliyev", role: "Xodim", joined: "02.10.2026" },
    { id: 2, name: "Ali Valiyev", role: "Egasi", joined: "" },
    { id: 3, name: "Sardor Karimov", role: "", joined: "" },
  ]
  type Person = (typeof people)[number]
  const inlineColumns = [
    { header: "A'zo", cell: (p: Person) => p.name, primary: true },
    { header: "Rol", cell: (p: Person) => p.role, card: "tag" as const },
    { header: "Qo'shilgan", cell: (p: Person) => p.joined, card: "inline" as const },
  ]
  // The inline line is a list of names and values.
  const inlineOf = (card: HTMLElement) =>
    Array.from(card.querySelectorAll('[data-slot="data-list-meta"] > div')).map((pair) => [
      pair.querySelector("dt")?.textContent,
      pair.querySelector("dd")?.textContent,
    ])

  render(<DataList label="Xodimlar" items={people} columns={inlineColumns} getKey={(p) => p.id} />)

  const [vali, ali, sardor] = within(screen.getByRole("list", { name: "Xodimlar" })).getAllByRole("listitem")
  expect(inlineOf(vali)).toEqual([
    ["Rol", "Xodim"],
    ["Qo'shilgan", "02.10.2026"],
  ])
  // A tag (a badge) says what it is by itself: its column's name is for
  // screen readers only. A bare date could be any date: its name shows.
  const [role, joined] = Array.from(vali.querySelectorAll('[data-slot="data-list-meta"] dt'))
  expect(role).toHaveClass("sr-only")
  expect(joined).not.toHaveClass("sr-only")
  // A value that is not there takes no place in the line; no values, no line.
  expect(inlineOf(ali)).toEqual([["Rol", "Egasi"]])
  expect(sardor.querySelector('[data-slot="data-list-meta"]')).not.toBeInTheDocument()
  // The table keeps every column under its name.
  const table = screen.getByRole("table", { name: "Xodimlar" })
  expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["A'zo", "Rol", "Qo'shilgan"])
})

test("DataList shows its footer once, under the records and outside the table", () => {
  render(
    <DataList label="Kompaniyalar" items={rows} columns={columns} getKey={(r) => r.id} footer={<span>Jami: 2</span>} />,
  )

  expect(screen.getAllByText("Jami: 2")).toHaveLength(1)
  const table = screen.getByRole("table", { name: "Kompaniyalar" })
  expect(within(table).queryByText("Jami: 2")).not.toBeInTheDocument()
  expect(within(table).getAllByRole("row")).toHaveLength(3)
})

test("DataList names a card's actions as a group, and every table column as a column", () => {
  const columnsWithActions = [
    ...columns,
    {
      header: "Amallar",
      actions: true,
      cell: (r: (typeof rows)[number]) => (r.id === 2 ? <button type="button">O&apos;chirish</button> : null),
    },
  ]

  render(<DataList label="Kompaniyalar" items={rows} columns={columnsWithActions} getKey={(r) => r.id} />)

  const [first, second] = within(screen.getByRole("list", { name: "Kompaniyalar" })).getAllByRole("listitem")
  const actions = within(second).getByRole("group", { name: "Amallar" })
  expect(within(actions).getByRole("button", { name: "O'chirish" })).toBeInTheDocument()
  expect(within(first).queryByRole("group")).not.toBeInTheDocument()
  const table = screen.getByRole("table", { name: "Kompaniyalar" })
  within(table)
    .getAllByRole("columnheader")
    .forEach((header) => expect(header).toHaveAttribute("scope", "col"))
})

test("DataList marks a value that is not there with a dash in the table, and leaves it out of the card", () => {
  const payments = [
    { id: 1, date: "02.10.2026", note: "Naqd" },
    { id: 2, date: "02.09.2026", note: null },
  ]
  type Payment = (typeof payments)[number]
  const paymentColumns = [
    { header: "Sana", cell: (p: Payment) => p.date, primary: true },
    { header: "Izoh", cell: (p: Payment) => p.note },
    {
      header: "Amallar",
      actions: true,
      cell: (p: Payment) => p.note !== null && <button type="button">O&apos;chirish</button>,
    },
  ]

  render(<DataList label="Billing tarixi" items={payments} columns={paymentColumns} getKey={(p) => p.id} />)

  const table = screen.getByRole("table", { name: "Billing tarixi" })
  const [, noted, bare] = within(table).getAllByRole("row")
  expect(within(noted).getAllByRole("cell")[0]).toHaveTextContent("Naqd")
  const [note, actions] = within(bare).getAllByRole("cell")
  expect(note).toHaveTextContent("—")
  // Nothing to do is not a missing value: the actions cell stays empty.
  expect(actions).toBeEmptyDOMElement()
  const [, card] = within(screen.getByRole("list", { name: "Billing tarixi" })).getAllByRole("listitem")
  expect(within(card).queryByText("Izoh")).not.toBeInTheDocument()
  expect(within(card).queryByText("—")).not.toBeInTheDocument()
})

test("DataList leads a card's line with its tags, whatever the order of the columns", () => {
  const companies = [{ id: 1, name: "Olma Savdo", end: "01.11.2026", status: "30 kun qoldi" }]
  type Company = (typeof companies)[number]
  const companyColumns = [
    { header: "Nomi", cell: (c: Company) => c.name, primary: true },
    { header: "Tugash sanasi", cell: (c: Company) => c.end, card: "inline" as const },
    { header: "Holat", cell: (c: Company) => c.status, card: "tag" as const },
  ]

  render(<DataList label="Kompaniyalar" items={companies} columns={companyColumns} getKey={(c) => c.id} />)

  const [card] = within(screen.getByRole("list", { name: "Kompaniyalar" })).getAllByRole("listitem")
  expect(Array.from(card.querySelectorAll('[data-slot="data-list-meta"] dt')).map((name) => name.textContent)).toEqual([
    "Holat",
    "Tugash sanasi",
  ])
  // The table keeps the columns in the order given.
  const table = screen.getByRole("table", { name: "Kompaniyalar" })
  expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
    "Nomi",
    "Tugash sanasi",
    "Holat",
  ])
})

test("DataList's card says what the record is before what can be done with it", () => {
  const people = [{ id: 1, name: "Vali Aliyev", role: "Xodim", phone: "+998 90 222 33 44" }]
  type Person = (typeof people)[number]
  const personColumns = [
    { header: "A'zo", cell: (p: Person) => p.name, primary: true },
    { header: "Amallar", actions: true, cell: () => <button type="button">O&apos;chirish</button> },
    { header: "Rol", cell: (p: Person) => p.role, card: "tag" as const },
    { header: "Telefon", cell: (p: Person) => p.phone },
  ]

  render(<DataList label="Xodimlar" items={people} columns={personColumns} getKey={(p) => p.id} />)

  const [card] = within(screen.getByRole("list", { name: "Xodimlar" })).getAllByRole("listitem")
  // The order a screen reader meets them in: the title, its line, the named
  // values, and only then the actions, though they show at the card's top.
  expect(Array.from(card.children).map((part) => part.getAttribute("data-slot"))).toEqual([
    "data-list-title",
    "data-list-meta",
    "data-list-values",
    "data-list-actions",
  ])
})
