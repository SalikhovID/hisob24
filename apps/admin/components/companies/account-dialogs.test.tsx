import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { db } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { CompanyPage } from "./company-page"

// The list is drawn twice (a table, and cards for a phone): the table is
// read and acted on.
const table = () => screen.getByRole("table", { name: "Akkauntlar" })

// rowsOf reads the accounts table row by row: the name, the currency, the
// state and the day added.
const rowsOf = () =>
  within(table())
    .getAllByRole("row")
    .slice(1)
    .map((row) => [within(row).getByRole("rowheader").textContent, ...within(row).getAllByRole("cell").slice(0, 3).map((cell) => cell.textContent)])

test("a company's accounts are listed; a card in dollars is added, edited, turned off and deleted", async () => {
  db.currencies[1] = [1, 2]
  const { user } = renderWithProviders(<CompanyPage id={1} />)

  await screen.findByRole("heading", { name: "Olma Savdo" })
  expect(rowsOf()).toEqual([["Naqd", "UZS", "Faol", "20.09.2026"]])

  await user.click(screen.getByRole("button", { name: "Akkaunt qo'shish" }))
  let dialog = await screen.findByRole("dialog", { name: "Akkaunt qo'shish" })
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await within(dialog).findByText("Nomni kiriting")).toBeInTheDocument()
  await user.type(within(dialog).getByLabelText("Nomi"), " Karta ")
  await choose(user, within(dialog).getByRole("combobox", { name: "Valyuta" }), "USD — AQSH dollari")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  expect(await screen.findByText("Akkaunt qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(rowsOf()).toHaveLength(2))
  expect(rowsOf()[1].slice(0, 3)).toEqual(["Karta", "USD", "Faol"])

  await user.click(within(table()).getByRole("button", { name: "Tahrirlash: Karta" }))
  dialog = await screen.findByRole("dialog", { name: "Akkauntni tahrirlash" })
  expect(within(dialog).getByLabelText("Nomi")).toHaveValue("Karta")
  expect(within(dialog).getByRole("combobox", { name: "Valyuta" })).toHaveTextContent("USD — AQSH dollari")
  await user.clear(within(dialog).getByLabelText("Nomi"))
  await user.type(within(dialog).getByLabelText("Nomi"), "naqd")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  expect(await within(dialog).findByText("Bu nomli akkaunt allaqachon bor")).toBeInTheDocument()
  await user.clear(within(dialog).getByLabelText("Nomi"))
  await user.type(within(dialog).getByLabelText("Nomi"), "Humo")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  expect(await screen.findByText("Akkaunt saqlandi")).toBeInTheDocument()
  await waitFor(() => expect(rowsOf()[1][0]).toBe("Humo"))

  await user.click(within(table()).getByRole("button", { name: "Nofaol qilish: Humo" }))
  expect(await screen.findByText("Akkaunt nofaol qilindi")).toBeInTheDocument()
  await waitFor(() => expect(rowsOf()[1][2]).toBe("Nofaol"))
  await user.click(within(table()).getByRole("button", { name: "Nofaol qilish: Naqd" }))
  expect(await screen.findByText("Kompaniyada kamida bitta faol akkaunt qolsin")).toBeInTheDocument()

  await user.click(within(table()).getByRole("button", { name: "O'chirish: Humo" }))
  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Akkaunt o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(rowsOf()).toHaveLength(1))
  expect(db.accounts[1]).toHaveLength(1)
})
