import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, seedCatalog, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { chooseCompany, signIn } from "@/test/session"
import { ProductPage } from "./product-page"

// facts reads the "Ma'lumot" list: each name with its value.
const facts = () => Object.fromEntries(screen.getAllByRole("term").map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]))

test("the product page: its name, unit and SKU, its facts, and the actions for whoever may edit and delete", async () => {
  const { olma } = seedCatalog()
  await signIn(ALI)
  renderWithProviders(<ProductPage id={olma.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Olma" })).toBeInTheDocument()
  expect(screen.getByText("kg · OL-1")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Mahsulotlar" })).toHaveAttribute("href", "/products")
  expect(facts()).toEqual({
    Birlik: "kg",
    Narx: "12 000",
    Artikul: "OL-1",
    Izoh: "Qizil",
    "Qo'shgan": "Ali Valiyev",
    "Qo'shilgan": "02.10.2026",
  })
  expect(screen.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Nofaol qilish" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "O'chirish" })).toBeInTheDocument()
  expect(screen.queryByText("Nofaol")).not.toBeInTheDocument()
})

test("an inactive product says so and offers to turn it on; what it lacks is a dash", async () => {
  const { eski } = seedCatalog()
  await signIn(ALI)
  renderWithProviders(<ProductPage id={eski.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Eski mahsulot" })).toBeInTheDocument()
  expect(screen.getByText("Nofaol")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Faollashtirish" })).toBeInTheDocument()
  expect(facts()).toMatchObject({ Narx: "—", Artikul: "—", Izoh: "—" })
})

test("deleting the product leads back to the list", async () => {
  const { nok } = seedCatalog()
  await signIn(ALI)
  const { user } = renderWithProviders(<ProductPage id={nok.id} />)

  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog", { name: "Mahsulotni o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/products"))
  expect(await screen.findByText("Mahsulot o'chirildi")).toBeInTheDocument()
})

test("an employee with the view alone sees the facts and no action", async () => {
  const { olma } = seedCatalog()
  giveRole(VALI, 1, "Kuzatuvchi", ["products.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<ProductPage id={olma.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Olma" })).toBeInTheDocument()
  expect(screen.queryAllByRole("button")).toHaveLength(0)
})

test("a product that is gone, or another company's, is not found", async () => {
  await signIn(ALI)
  renderWithProviders(<ProductPage id={999} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Mahsulot topilmadi" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Mahsulotlar" })).toHaveAttribute("href", "/products")
})

test("a service opened by its id leads back to the services", async () => {
  const { yetkazish } = seedCatalog()
  await signIn(ALI)
  renderWithProviders(<ProductPage id={yetkazish.id} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Yetkazish" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Xizmatlar" })).toHaveAttribute("href", "/services")
  expect(facts()).toEqual({ Narx: "50 000", Izoh: "—", "Qo'shgan": "Ali Valiyev", "Qo'shilgan": "02.10.2026" })
})
