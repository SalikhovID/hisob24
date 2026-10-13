import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { MenuOrderPage } from "./menu-order-page"

const list = () => screen.findByRole("list", { name: "Bo'limlar tartibi" })
const names = (list: HTMLElement) => within(list).getAllByRole("listitem").map((item) => item.querySelector('[data-slot="row-title"]')?.textContent)

test("the page lists the member's sections in their order, the home locked first apart; the bar's four are marked", async () => {
  await signIn(ALI)
  renderWithProviders(<MenuOrderPage />)

  const sections = await list()
  expect(names(sections)).toEqual(["Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya", "Xodimlar", "Sozlamalar"])
  const items = within(sections).getAllByRole("listitem")
  expect(items.slice(0, 4).every((item) => within(item).queryByText("Menyuda"))).toBe(true)
  expect(items.slice(4).some((item) => within(item).queryByText("Menyuda"))).toBe(false)
  expect(within(items[4]).getByText("Profil sahifasida")).toBeInTheDocument()
  expect(screen.getByText("Bosh sahifa").closest('[data-slot="row"]')?.querySelector("svg")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Profil" })).toHaveAttribute("href", "/profile")
})

test("a section moved and saved: the order is sent, said, and the page goes back to the profile", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<MenuOrderPage />)

  within(await list()).getByRole("button", { name: "Sozlamalar: tartibini o'zgartirish" }).focus()
  await user.keyboard("{Home}")
  expect(names(await list())[0]).toBe("Sozlamalar")
  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.members[ALI][0].navOrder).toEqual(["settings", "customers", "tasks", "products", "sales", "warehouse", "finance", "employees"]))
  expect(await screen.findByText("Menyu tartibi saqlandi")).toBeInTheDocument()
  expect(router.push).toHaveBeenCalledWith("/profile")
})

test("the page starts from the member's own order; «Standart holat» drops it", async () => {
  db.members[ALI][0].navOrder = ["settings", "tasks"]
  await signIn(ALI)
  const { user } = renderWithProviders(<MenuOrderPage />)

  expect(names(await list())[0]).toBe("Sozlamalar")
  await user.click(screen.getByRole("button", { name: "Standart holat" }))
  expect(names(await list())).toEqual(["Mijozlar", "Vazifalar", "Mahsulotlar", "Sotuv", "Ombor", "Moliya", "Xodimlar", "Sozlamalar"])

  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.members[ALI][0].navOrder).toBeUndefined())
})
