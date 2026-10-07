import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { NavOrderDialog } from "./nav-order-dialog"

const list = () => screen.findByRole("list", { name: "Bo'limlar tartibi" })
const names = (list: HTMLElement) => within(list).getAllByRole("listitem").map((item) => item.textContent)

test("the dialog lists the member's sections in their order; Saqlash sends the order and says so", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<NavOrderDialog open onOpenChange={() => {}} />)

  const sections = await list()
  expect(names(sections)).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Ombor", "Xodimlar", "Sozlamalar"])
  within(sections).getByRole("button", { name: "Sozlamalar: tartibini o'zgartirish" }).focus()
  await user.keyboard("{Home}")
  expect(names(await list())[0]).toBe("Sozlamalar")

  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() =>
    expect(db.members[ALI][0].navOrder).toEqual(["settings", "home", "customers", "tasks", "products", "warehouse", "employees"]),
  )
  expect(await screen.findByText("Menyu tartibi saqlandi")).toBeInTheDocument()
})

test("the dialog starts from the member's own order; «Standart holat» drops it", async () => {
  db.members[ALI][0].navOrder = ["settings", "tasks"]
  await signIn(ALI)
  const { user } = renderWithProviders(<NavOrderDialog open onOpenChange={() => {}} />)

  expect(names(await list())[0]).toBe("Sozlamalar")
  await user.click(screen.getByRole("button", { name: "Standart holat" }))
  expect(names(await list())).toEqual(["Bosh sahifa", "Mijozlar", "Vazifalar", "Mahsulotlar", "Ombor", "Xodimlar", "Sozlamalar"])

  await user.click(screen.getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.members[ALI][0].navOrder).toBeUndefined())
})
