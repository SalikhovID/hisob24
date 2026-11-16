import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCatalog } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { ProductCategoriesPage } from "./product-categories-page"

const namesOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector('[data-slot="row-title"] > span')?.textContent)
const categories = () => screen.getByRole("list", { name: "Kategoriyalar" })
// actOn opens a category's sheet of actions and takes one.
async function actOn(user: { click: (element: Element) => Promise<void> }, name: string, action: string) {
  await user.click(within(categories()).getByRole("button", { name: new RegExp(`^${name}`) }))
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: action }))
}

test("the owner's product categories as a settings page: none at first, then added from the plus's sheet (a name taken refused), each a row in their order", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<ProductCategoriesPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Mahsulot kategoriyalari" })).toBeInTheDocument()
  expect(screen.getByText("Mahsulotlar kategoriya bo'yicha guruhlanadi.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(await screen.findByText("Hali kategoriya yo'q")).toBeInTheDocument()
  expect(screen.getByText("Mahsulotlarni guruhlash uchun kategoriya qo'shing.")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }))
  let sheet = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" })
  expect(within(sheet).getByLabelText("Nomi")).toHaveAttribute("placeholder", "Masalan, Ichimliklar")
  await user.type(within(sheet).getByLabelText("Nomi"), " Ichimliklar ")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect((await screen.findAllByText("Kategoriya qo'shildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(namesOf(categories())).toEqual(["Ichimliklar"]))

  await user.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }))
  sheet = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" })
  await user.type(within(sheet).getByLabelText("Nomi"), "Shirinliklar")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  await waitFor(() => expect(namesOf(categories())).toEqual(["Ichimliklar", "Shirinliklar"]))
  expect(screen.getByRole("heading", { level: 2, name: "2 ta kategoriya" })).toBeInTheDocument()
  expect(screen.getByText("Mahsulot qo'shishda tanlanadi: ichimliklar, shirinliklar, xo'jalik.")).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Kategoriya qo'shish" }))
  sheet = await screen.findByRole("dialog", { name: "Kategoriya qo'shish" })
  await user.type(within(sheet).getByLabelText("Nomi"), "ichimliklar")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Bu nomli kategoriya allaqachon bor")).toBeInTheDocument()
})

test("a row's sheet renames the category and deletes it; one with products stays, and the refusal says how many", async () => {
  db.productCategories.push({ id: 7001, companyId: 1, name: "Ichimliklar", position: 1 }, { id: 7002, companyId: 1, name: "Shirinliklar", position: 2 })
  seedCatalog().olma.categoryId = 7002
  await signIn(ALI)
  const { user } = renderWithProviders(<ProductCategoriesPage />)
  await waitFor(() => expect(namesOf(categories())).toEqual(["Ichimliklar", "Shirinliklar"]))

  await actOn(user, "Ichimliklar", "Nomini o'zgartirish")
  const sheet = await screen.findByRole("dialog", { name: "Kategoriya nomini o'zgartirish" })
  expect(within(sheet).getByText("Mahsulotlar kategoriyani yangi nomi bilan ko'rsatadi.")).toBeInTheDocument()
  await user.clear(within(sheet).getByLabelText("Nomi"))
  await user.type(within(sheet).getByLabelText("Nomi"), "Suvlar")
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  expect((await screen.findAllByText("Kategoriya nomi o'zgartirildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(namesOf(categories())).toEqual(["Suvlar", "Shirinliklar"]))

  await actOn(user, "Shirinliklar", "O'chirish")
  let confirm = await screen.findByRole("alertdialog", { name: "Kategoriyani o'chirasizmi?" })
  expect(within(confirm).getByText("«Shirinliklar» kategoriyasi o'chadi. Mahsuloti bor kategoriya o'chirilmaydi: avval mahsulotlarni boshqa kategoriyaga o'tkazing.")).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Bu kategoriyada 1 ta mahsulot bor")).length).toBeGreaterThan(0)
  expect(namesOf(categories())).toEqual(["Suvlar", "Shirinliklar"])

  await actOn(user, "Suvlar", "O'chirish")
  confirm = await screen.findByRole("alertdialog", { name: "Kategoriyani o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Kategoriya o'chirildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(namesOf(categories())).toEqual(["Shirinliklar"]))
  expect(db.productCategories.find((c) => c.id === 7001)?.deleted).toBe(true)
})
