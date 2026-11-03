import { screen, within } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { BackTargetProvider } from "@/components/kit/back-target"
import { BackLink } from "@/components/kit/page-title"
import { setMiniApp } from "@/lib/telegram"
import { ALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { moved } from "@/test/moves"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { TopBar } from "./top-bar"

// next/link as far as a click goes: a link that runs its click and stays.
vi.mock("next/link", () => ({
  default: ({ onClick, ...props }: ComponentProps<"a">) => (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event)
        event.preventDefault()
      }}
    />
  ),
}))

afterEach(() => setMiniApp(null))

const shell = (page?: ReactNode) => (
  <BackTargetProvider>
    <TopBar />
    {page}
  </BackTargetProvider>
)

test("on a page under another the top bar leads back where the page's way back does: «← Orqaga» in grey, a move back", async () => {
  const { user } = renderWithProviders(shell(<BackLink href="/customers" label="Mijozlar" />))
  const bar = document.querySelector('[data-slot="top-bar"]') as HTMLElement
  const back = await within(bar).findByRole("link", { name: "Orqaga" })
  expect(back).toHaveAttribute("href", "/customers")
  expect(back).toHaveClass("text-muted-foreground", "hover:bg-ink-1")
  await user.click(back)
  expect(moved()).toBe("back")
})

test("on a section's own page there is no way back", () => {
  renderWithProviders(shell(<p>Mijozlar</p>))
  expect(screen.queryByRole("link", { name: "Orqaga" })).not.toBeInTheDocument()
})

test("the top bar is the prototype's 52px bar over the page, a faint hairline under it, hidden on a phone", () => {
  renderWithProviders(shell())
  const bar = document.querySelector('[data-slot="top-bar"]')
  expect(bar).toHaveClass("hidden", "md:flex", "h-[52px]", "border-b", "border-line-faint", "px-6")
})

test("the top bar holds no theme and no way out: the profile chooses the theme, the sidebar leads out", () => {
  renderWithProviders(shell())
  expect(screen.queryByRole("button", { name: "Mavzuni almashtirish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Chiqish" })).not.toBeInTheDocument()
})

test("with two locations the top bar's menu says the current one and makes another current", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { user } = renderWithProviders(shell())
  const pill = await screen.findByRole("button", { name: "Lokatsiya: Asosiy" })
  await user.click(pill)
  const menu = await screen.findByRole("menu", { name: "Lokatsiya: Asosiy" })
  expect(within(menu).getByRole("menuitemradio", { name: "Asosiy" })).toHaveAttribute("aria-checked", "true")
  await user.click(within(menu).getByRole("menuitemradio", { name: "Chilonzor" }))
  expect(await screen.findByRole("button", { name: "Lokatsiya: Chilonzor" })).toBeInTheDocument()
})

test("the bell opens a menu that says there are no notifications yet", async () => {
  const { user } = renderWithProviders(shell())
  await user.click(screen.getByRole("button", { name: "Bildirishnomalar" }))
  expect(await screen.findByText("Bildirishnomalar hozircha yo'q")).toBeInTheDocument()
})
