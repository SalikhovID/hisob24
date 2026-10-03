import { screen, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { ALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { Topbar } from "./topbar"

test("the menu button asks for the sections, and the profile menu says who is signed in", async () => {
  await signIn(ALI)
  const onMenuClick = vi.fn()
  const { user } = renderWithProviders(<Topbar onMenuClick={onMenuClick} />)

  await user.click(screen.getByRole("button", { name: "Menyu" }))
  expect(onMenuClick).toHaveBeenCalledOnce()

  await user.click(screen.getByRole("button", { name: "Profil" }))
  const menu = await screen.findByRole("menu")
  expect(await within(menu).findByText("Ali Valiyev")).toBeInTheDocument()
  expect(within(menu).getByText("+998 90 123 45 67")).toBeInTheDocument()
})
