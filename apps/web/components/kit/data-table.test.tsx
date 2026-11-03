import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test } from "vitest"
import { router } from "@/test/navigation"
import { DataTable } from "./data-table"

type Customer = { id: number; name: string; phone: string; debt: string }

const customers: Customer[] = [
  { id: 1, name: "Nodira Karimova", phone: "+998 90 123 45 67", debt: "900 000 so'm" },
  { id: 2, name: "Dilshod Aliyev", phone: "+998 93 555 11 22", debt: "—" },
]

function Customers({ rows = customers }: { rows?: Customer[] }) {
  return (
    <DataTable
      label="Mijozlar"
      rows={rows}
      rowKey={(row) => row.id}
      href={(row) => `/customers/${row.id}`}
      columns={[
        { key: "name", label: "Mijoz", render: (row) => row.name },
        { key: "debt", label: "Qarz", align: "end", render: (row) => row.debt },
      ]}
      mobileRow={(row) => ({ title: row.name, sub: row.phone, end: row.debt })}
      empty={<p>Hozircha bo&apos;sh</p>}
    />
  )
}

test("on the web the records are a table named for them: its columns' heads, a row per record, the cells the columns' renders", () => {
  render(<Customers />)
  const table = screen.getByRole("table", { name: "Mijozlar" })
  expect(within(table).getAllByRole("columnheader").map((head) => head.textContent)).toEqual(["Mijoz", "Qarz"])
  const rows = within(table).getAllByRole("row").slice(1)
  expect(rows).toHaveLength(2)
  expect(within(rows[0]).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Nodira Karimova", "900 000 so'm"])
})

test("a record's way in is a link in its row's first cell, and a press anywhere on the row goes there", async () => {
  render(<Customers />)
  const table = screen.getByRole("table", { name: "Mijozlar" })
  expect(within(table).getByRole("link", { name: "Nodira Karimova" })).toHaveAttribute("href", "/customers/1")
  await userEvent.click(within(table).getByText("900 000 so'm"))
  expect(router.push).toHaveBeenCalledWith("/customers/1")
})

test("a column at the end stands at the right, its head too", () => {
  render(<Customers />)
  const table = screen.getByRole("table", { name: "Mijozlar" })
  expect(within(table).getByRole("columnheader", { name: "Qarz" })).toHaveClass("text-right")
  expect(within(table).getByText("900 000 so'm").closest("td")).toHaveClass("text-right")
})

test("on a phone the same records are a list of rows: each its title, line and value, leading to the record", () => {
  render(<Customers />)
  const list = screen.getByRole("list", { name: "Mijozlar" })
  const link = within(list).getByRole("link", { name: /Dilshod Aliyev/ })
  expect(link).toHaveAttribute("href", "/customers/2")
  expect(link).toHaveTextContent("+998 93 555 11 22")
})

test("the table is the web's and the list the phone's: each hides on the other's screen", () => {
  render(<Customers />)
  expect(screen.getByRole("table", { name: "Mijozlar" }).closest('[data-slot="data-table"]')).toHaveClass("hidden", "md:block")
  expect(screen.getByRole("list", { name: "Mijozlar" }).closest('[data-slot="data-list"]')).toHaveClass("md:hidden")
})

test("with no records the empty state stands instead of both", () => {
  render(<Customers rows={[]} />)
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
  expect(screen.queryByRole("list")).not.toBeInTheDocument()
  expect(screen.getByText("Hozircha bo'sh")).toBeInTheDocument()
})
