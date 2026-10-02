import { screen, waitFor } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { accessToken } from "@/lib/session"
import { ALI, TG_ALI, TG_VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { fakeWebApp } from "@/test/telegram"
import { TelegramLogin } from "./telegram-login"

test("a linked user is signed in with no code and lands on the dashboard", async () => {
  renderWithProviders(<TelegramLogin webApp={fakeWebApp({}, TG_ALI)} onFallback={vi.fn()} />)
  expect(screen.getByText("Telegram orqali kirilmoqda…")).toBeInTheDocument()

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(accessToken()).toMatch(new RegExp(`^access:${ALI}:1:`))
})

test("someone in several companies goes on to choose one", async () => {
  renderWithProviders(<TelegramLogin webApp={fakeWebApp({}, TG_VALI)} onFallback={vi.fn()} />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/select-company"))
})
