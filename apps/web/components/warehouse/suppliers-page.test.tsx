import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { SuppliersPage } from "./suppliers-page"

const table = () => screen.findByRole("table", { name: "Ta'minotchilar" })
const titles = (table: HTMLElement) =>
  within(table)
    .getAllByRole("rowheader")
    .map((cell) => within(cell).queryByRole("link")?.textContent ?? cell.textContent)
const headers = (table: HTMLElement) => within(table).getAllByRole("columnheader").map((cell) => cell.textContent)

test("the owner's suppliers: by name, with the phone and what is owed; the inactive ones under their own tab", async () => {
  const { bozor } = seedWarehouse(seedCatalog())
  await signIn(ALI)
  setLocation("/suppliers")
  const { user } = renderWithProviders(<SuppliersPage />)

  const list = await table()
  expect(screen.getByRole("heading", { level: 1, name: "Ta'minotchilar" })).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz ta'minotchilari · 1 ta")).toBeInTheDocument()
  const tabs = screen.getByRole("navigation", { name: "Ombor bo'limi" })
  expect(within(tabs).getByRole("link", { name: "Ta'minotchilar" })).toHaveAttribute("aria-current", "page")
  expect(within(tabs).getByRole("link", { name: "Xaridlar" })).toHaveAttribute("href", "/purchases")
  expect(headers(list)).toEqual(["Ta'minotchi", "Telefon", "Qarz", "Qo'shgan", "Qo'shilgan"])
  expect(titles(list)).toEqual(["Bozor"])
  expect(within(list).getByRole("link", { name: "Bozor" })).toHaveAttribute("href", `/suppliers/${bozor.id}`)
  const row = within(list).getByRole("link", { name: "Bozor" }).closest("tr")!
  expect(within(row).getByText("+998 90 123 45 67")).toBeInTheDocument()
  expect(within(row).getByText("15 001,50")).toBeInTheDocument()
  expect(within(row).getByText("Ali Valiyev")).toBeInTheDocument()
  expect(within(list).queryByText("Dehqon")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Ta'minotchi qo'shish" })).toBeInTheDocument()

  await user.click(screen.getByRole("tab", { name: "Nofaol" }))
  await waitFor(() => expect(currentUrl()).toBe("/suppliers?status=inactive"))
  expect(await within(await table()).findByText("Dehqon")).toBeInTheDocument()
  expect(screen.queryByText("Bozor")).not.toBeInTheDocument()
})

test("a search looks in the names", async () => {
  seedWarehouse()
  await signIn(ALI)
  setLocation("/suppliers")
  const { user } = renderWithProviders(<SuppliersPage />)
  await table()

  await user.type(screen.getByRole("searchbox", { name: "Qidirish" }), "bo")
  await waitFor(() => expect(currentUrl()).toBe("/suppliers?search=bo"))
  await waitFor(() => expect(titles(screen.getByRole("table", { name: "Ta'minotchilar" }))).toEqual(["Bozor"]))
})

test("whoever may see the suppliers alone sees no balance and no way to add", async () => {
  seedWarehouse(seedCatalog())
  giveRole(VALI, 1, "Kuzatuvchi", ["suppliers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/suppliers")
  renderWithProviders(<SuppliersPage />)

  const list = await table()
  expect(headers(list)).toEqual(["Ta'minotchi", "Telefon", "Qo'shgan", "Qo'shilgan"])
  expect(within(list).queryByText("15 001,50")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Ta'minotchi qo'shish" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("without the permission the page sends the member home", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<SuppliersPage />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})

test("with no supplier yet the page says so, and what to do", async () => {
  await signIn(ALI)
  setLocation("/suppliers")
  renderWithProviders(<SuppliersPage />)

  expect(await screen.findByText("Hali ta'minotchi yo'q")).toBeInTheDocument()
  expect(screen.getByText("Birinchi ta'minotchini «Ta'minotchi qo'shish» tugmasi orqali qo'shing.")).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz ta'minotchilari · 0 ta")).toBeInTheDocument()
})
