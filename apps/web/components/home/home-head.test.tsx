import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI } from "@/mocks/data"
import { addLocation, restrictTo } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { HomeHead } from "./home-head"

const head = <HomeHead name="Ali Valiyev" company="Olma Savdo" role="Egasi" />

test("the greeting is the page's heading: on a wide screen in sight, the company and the location under it; on a phone for a screen reader alone", async () => {
  await signIn(ALI)
  renderWithProviders(head)

  expect(screen.getByRole("heading", { level: 1, name: "Salom, Ali Valiyev" })).toHaveClass("max-md:sr-only", "text-[20px]")
  expect(await screen.findByText("Olma Savdo · Asosiy")).toHaveClass("hidden", "md:block")
})

test("on a phone the company's name stands big, the name, the role and the location under it", async () => {
  await signIn(ALI)
  const { container } = renderWithProviders(head)

  const phone = container.querySelector('[data-slot="home-head-phone"]') as HTMLElement
  expect(phone).toHaveClass("md:hidden")
  expect(within(phone).getByText("Olma Savdo")).toHaveClass("text-[32px]", "font-bold")
  expect(await within(phone).findByText("Ali Valiyev · Egasi · Asosiy")).toBeInTheDocument()
  expect(within(phone).queryByRole("button")).not.toBeInTheDocument()
})

test("with two locations the phone's location is a button: it opens the sheet of them, and one chosen is the current one", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { user } = renderWithProviders(head)

  await user.click(await screen.findByRole("button", { name: "Lokatsiya: Asosiy" }))
  await user.click(within(screen.getByRole("dialog", { name: "Lokatsiya" })).getByRole("menuitemradio", { name: "Chilonzor" }))

  expect(await screen.findByRole("button", { name: "Lokatsiya: Chilonzor" })).toBeInTheDocument()
  expect(screen.getByText("Olma Savdo · Chilonzor")).toBeInTheDocument()
})

test("a member with no location has the line end at the role", async () => {
  restrictTo(ALI, 1, [])
  await signIn(ALI)
  const { container } = renderWithProviders(head)

  const phone = container.querySelector('[data-slot="home-head-phone"]') as HTMLElement
  expect(await within(phone).findByText("Ali Valiyev · Egasi")).toBeInTheDocument()
  expect(screen.getByText("Olma Savdo", { selector: "p.hidden" })).toBeInTheDocument()
})
