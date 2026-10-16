import { screen, waitFor, within } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { BackTargetProvider } from "@/components/kit/back-target"
import { BackLink } from "@/components/kit/page-title"
import { setMiniApp } from "@/lib/telegram"
import { ALI } from "@/mocks/data"
import { moved } from "@/test/moves"
import { leave } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { fakeWebApp } from "@/test/telegram"
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

test("on a page under another the top bar leads back where the page's way back does: «Orqaga», a small glass, a move back", async () => {
  const { user } = renderWithProviders(shell(<BackLink href="/customers" label="Mijozlar" />))
  const bar = document.querySelector('[data-slot="top-bar"]') as HTMLElement
  const back = await within(bar).findByRole("link", { name: "Orqaga" })
  expect(back).toHaveAttribute("href", "/customers")
  expect(back).toHaveClass("glass-chip")
  await user.click(back)
  expect(moved()).toBe("back")
})

test("on a section's own page there is no way back", () => {
  renderWithProviders(shell(<p>Mijozlar</p>))
  expect(screen.queryByRole("link", { name: "Orqaga" })).not.toBeInTheDocument()
})

test("the top bar is a wide screen's, over the page's column: a fade of the page's own color, hidden on a phone", () => {
  renderWithProviders(shell())
  const bar = document.querySelector('[data-slot="top-bar"]')
  expect(bar).toHaveClass("hidden", "md:flex", "h-[76px]", "bg-[linear-gradient(var(--fade)_55%,transparent)]", "px-[max(32px,calc((100%-1120px)/2))]")
})

test("the theme button turns the light into the dark, and back", async () => {
  const { user } = renderWithProviders(shell())
  await user.click(screen.getByRole("button", { name: "Mavzuni almashtirish" }))
  await waitFor(() => expect(document.documentElement).toHaveClass("dark"))
  await user.click(screen.getByRole("button", { name: "Mavzuni almashtirish" }))
  await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"))
})

test("the way out asks first; agreed, the session ends and leaves for /login", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(shell())
  await user.click(screen.getByRole("button", { name: "Chiqish" }))
  const alert = await screen.findByRole("alertdialog", { name: "Tizimdan chiqasizmi?" })
  expect(within(alert).getByText("Qayta kirish uchun raqamingizga kod keladi.")).toBeInTheDocument()
  await user.click(within(alert).getByRole("button", { name: "Chiqish" }))
  await waitFor(() => expect(leave).toHaveBeenCalledWith("/login"))
})

test("asked, the way out may be put off: «Bekor qilish» keeps the session", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(shell())
  await user.click(screen.getByRole("button", { name: "Chiqish" }))
  const alert = await screen.findByRole("alertdialog", { name: "Tizimdan chiqasizmi?" })
  await user.click(within(alert).getByRole("button", { name: "Bekor qilish" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(leave).not.toHaveBeenCalled()
})

test("inside Telegram there is no theme or way out: the chat sets the theme, and closing is the way out", () => {
  setMiniApp(fakeWebApp())
  renderWithProviders(shell(<BackLink href="/customers" label="Mijozlar" />))
  expect(screen.queryByRole("button", { name: "Mavzuni almashtirish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Chiqish" })).not.toBeInTheDocument()
})
