import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, seedWarehouse, VALI } from "@/mocks/data"
import { currentUrl, router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { chooseCompany, signIn } from "@/test/session"
import { SuppliersPage } from "./suppliers-page"

// The list is the suppliers' rows, a list on any screen.
const list = () => screen.findByRole("list", { name: "Ta'minotchilar" })
const rows = (list: HTMLElement) => within(list).getAllByRole("listitem").map((item) => item.firstElementChild as HTMLElement)
// parts are a row's title, line and end, the spaces as one plain space.
const parts = (row: HTMLElement) => {
  const plain = (text: string | null) => text?.replace(/\s+/g, " ") ?? null
  const { title, sub, end } = rowParts(row)
  return { title: plain(title), sub: plain(sub), end: plain(end) }
}

test("the owner's suppliers: a row each, the phone under the name, what is owed at its end; the chips say how many", async () => {
  const { bozor } = seedWarehouse(seedCatalog())
  await signIn(ALI)
  setLocation("/suppliers")
  const { user } = renderWithProviders(<SuppliersPage />)

  const suppliers = await list()
  expect(screen.getByRole("heading", { level: 1, name: "Ta'minotchilar" })).toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz ta'minotchilari · 1 ta")).toBeInTheDocument()
  // The page leads back to the warehouse's hub, which lists its pages.
  expect(screen.getByRole("link", { name: "Ombor" })).toHaveAttribute("href", "/warehouse")
  expect(screen.queryByRole("navigation", { name: "Ombor bo'limi" })).not.toBeInTheDocument()
  const [row] = rows(suppliers)
  expect(parts(row)).toEqual({ title: "Bozor", sub: "+998 90 123 45 67", end: "Qarz: 15 001,50 so'm" })
  expect(row).toHaveAttribute("href", `/suppliers/${bozor.id}`)
  expect(within(suppliers).queryByText("Dehqon")).not.toBeInTheDocument()
  expect(screen.getByText("Jami: 1")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Ta'minotchi qo'shish" })).toBeInTheDocument()

  const status = screen.getByRole("radiogroup", { name: "Holat" })
  await waitFor(() => expect(within(status).getAllByRole("radio").map((chip) => chip.textContent)).toEqual(["Faol 1", "Nofaol 1"]))
  await user.click(within(status).getByRole("radio", { name: "Nofaol 1" }))
  await waitFor(() => expect(currentUrl()).toBe("/suppliers?status=inactive"))
  expect(await within(await list()).findByText("Dehqon")).toBeInTheDocument()
  expect(screen.queryByText("Bozor")).not.toBeInTheDocument()
})

test("a search looks in the names", async () => {
  seedWarehouse()
  await signIn(ALI)
  setLocation("/suppliers")
  const { user } = renderWithProviders(<SuppliersPage />)
  await list()

  const search = screen.getByRole("searchbox", { name: "Qidirish" })
  expect(search).toHaveAttribute("placeholder", "Nom yoki telefon")
  await user.type(search, "bo")
  await waitFor(() => expect(currentUrl()).toBe("/suppliers?search=bo"))
  await waitFor(async () => expect(rows(await list()).map((row) => parts(row).title)).toEqual(["Bozor"]))
})

test("whoever may see the suppliers alone sees no balance and no way to add", async () => {
  seedWarehouse(seedCatalog())
  giveRole(VALI, 1, "Kuzatuvchi", ["suppliers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  setLocation("/suppliers")
  renderWithProviders(<SuppliersPage />)

  const [row] = rows(await list())
  expect(parts(row)).toEqual({ title: "Bozor", sub: "+998 90 123 45 67", end: null })
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
