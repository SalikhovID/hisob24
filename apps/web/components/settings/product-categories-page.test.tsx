import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { ProductCategoriesPage } from "./product-categories-page"

const namesOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector('[data-slot="row-title"] > span')?.textContent)
const categories = () => screen.getByRole("list", { name: "Kategoriyalar" })

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
