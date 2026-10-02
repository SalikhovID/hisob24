import { act, screen, waitFor } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { useMiniApp } from "@/lib/telegram"
import { renderWithProviders } from "@/test/render"
import { fakeWebApp } from "@/test/telegram"
import { TelegramSync } from "./telegram-sync"

test("TelegramSync readies the Mini App and follows Telegram's color scheme", async () => {
  const webApp = fakeWebApp({ colorScheme: "dark" })
  window.Telegram = { WebApp: webApp }

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(document.documentElement).toHaveAttribute("data-telegram"))
  expect(webApp.ready).toHaveBeenCalled()
  expect(webApp.expand).toHaveBeenCalled()
  await waitFor(() => expect(document.documentElement).toHaveClass("dark"))

  webApp.colorScheme = "light"
  act(() => webApp.fire("themeChanged"))
  await waitFor(() => expect(document.documentElement).not.toHaveClass("dark"))
})

test("TelegramSync leaves a browser tab as it is", async () => {
  vi.useFakeTimers()
  renderWithProviders(<TelegramSync />)
  await act(() => vi.advanceTimersByTimeAsync(1100))
  vi.useRealTimers()

  expect(document.documentElement).not.toHaveAttribute("data-telegram")
})

function Probe() {
  return <p>{useMiniApp() ? "telegram" : "browser"}</p>
}

test("useMiniApp tells the panel it runs inside Telegram", async () => {
  window.Telegram = { WebApp: fakeWebApp() }

  renderWithProviders(
    <>
      <TelegramSync />
      <Probe />
    </>,
  )

  expect(await screen.findByText("telegram")).toBeInTheDocument()
})

test("useMiniApp is null in a browser tab", () => {
  renderWithProviders(<Probe />)

  expect(screen.getByText("browser")).toBeInTheDocument()
})
