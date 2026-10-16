import { act, screen, waitFor } from "@testing-library/react"
import { expect, onTestFinished, test, vi } from "vitest"
import { useMiniApp } from "@/lib/telegram"
import { renderWithProviders } from "@/test/render"
import { router, setLocation } from "@/test/navigation"
import { fakeWebApp } from "@/test/telegram"
import { TelegramSync } from "./telegram-sync"
import { moved } from "@/test/moves"

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

test("useMiniApp tells the app it runs inside Telegram", async () => {
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

test("TelegramSync turns Telegram's vertical swipes off, so a drag on the board does not fold the Mini App", async () => {
  const webApp = fakeWebApp({ disableVerticalSwipes: vi.fn() })
  window.Telegram = { WebApp: webApp }

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(document.documentElement).toHaveAttribute("data-telegram"))
  expect(webApp.disableVerticalSwipes).toHaveBeenCalled()
})

test("TelegramSync opens the Mini App full screen on a phone whose client knows it (Bot API 8.0)", async () => {
  const webApp = fakeWebApp({ platform: "ios", isVersionAtLeast: vi.fn(() => true), requestFullscreen: vi.fn() })
  window.Telegram = { WebApp: webApp }

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(document.documentElement).toHaveAttribute("data-telegram"))
  expect(webApp.requestFullscreen).toHaveBeenCalled()
})

test("TelegramSync leaves a desktop Telegram at the client's height: full screen there is the whole window", async () => {
  const webApp = fakeWebApp({ platform: "tdesktop", isVersionAtLeast: vi.fn(() => true), requestFullscreen: vi.fn() })
  window.Telegram = { WebApp: webApp }

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(document.documentElement).toHaveAttribute("data-telegram"))
  expect(webApp.expand).toHaveBeenCalled()
  expect(webApp.requestFullscreen).not.toHaveBeenCalled()
})

test("TelegramSync asks nothing of a client older than Bot API 8.0, which would throw at the request", async () => {
  const webApp = fakeWebApp({ platform: "android", isVersionAtLeast: vi.fn(() => false), requestFullscreen: vi.fn() })
  window.Telegram = { WebApp: webApp }

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(document.documentElement).toHaveAttribute("data-telegram"))
  expect(webApp.isVersionAtLeast).toHaveBeenCalledWith("8.0")
  expect(webApp.requestFullscreen).not.toHaveBeenCalled()
})

// atLeast is a client at Bot API version client: it knows a method of that
// version or older.
const atLeast = (client: string) =>
  vi.fn((version: string) => {
    const [major, minor] = client.split(".").map(Number)
    const [wantMajor, wantMinor] = version.split(".").map(Number)
    return major > wantMajor || (major === wantMajor && minor >= wantMinor)
  })

const chrome = () => ({ setHeaderColor: vi.fn(), setBackgroundColor: vi.fn(), setBottomBarColor: vi.fn() })

test("TelegramSync paints Telegram's header, background and bottom bar in the app's own colors of the scheme", async () => {
  const webApp = fakeWebApp({ colorScheme: "dark", isVersionAtLeast: atLeast("8.0"), ...chrome() })
  window.Telegram = { WebApp: webApp }

  renderWithProviders(<TelegramSync />)

  // The dark glass: its ambient light's top (the centre of the screen's top
  // edge, as drawn) over the app, its base behind it, its foot under it.
  await waitFor(() => expect(webApp.setHeaderColor).toHaveBeenCalledWith("#1C1D21"))
  expect(webApp.setBackgroundColor).toHaveBeenCalledWith("#0F1013")
  expect(webApp.setBottomBarColor).toHaveBeenCalledWith("#14161A")

  // The light glass: its ambient light's top over the app, its base behind
  // it, its bottom under it.
  webApp.colorScheme = "light"
  act(() => webApp.fire("themeChanged"))
  expect(webApp.setHeaderColor).toHaveBeenLastCalledWith("#F7F8F9")
  expect(webApp.setBackgroundColor).toHaveBeenLastCalledWith("#F1F2F4")
  expect(webApp.setBottomBarColor).toHaveBeenLastCalledWith("#E5E7EB")
})

test.each([
  ["6.1", ["setBackgroundColor"]],
  ["7.0", ["setHeaderColor", "setBackgroundColor"]],
  ["7.10", ["setHeaderColor", "setBackgroundColor", "setBottomBarColor"]],
] as const)("a client at Bot API %s is asked for the colors it knows alone", async (version, asked) => {
  const webApp = fakeWebApp({ isVersionAtLeast: atLeast(version), ...chrome() })
  window.Telegram = { WebApp: webApp }

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(webApp[asked[0]]).toHaveBeenCalled())
  for (const method of ["setHeaderColor", "setBackgroundColor", "setBottomBarColor"] as const) {
    if (asked.includes(method as never)) expect(webApp[method]).toHaveBeenCalled()
    else expect(webApp[method]).not.toHaveBeenCalled()
  }
})

// backButton stands in for Telegram's BackButton; press calls what the app
// gave it.
function backButton() {
  let handler: (() => void) | undefined
  return {
    isVisible: false,
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn((next: () => void) => {
      handler = next
    }),
    offClick: vi.fn(),
    press: () => handler?.(),
  }
}

test("inside a section the Mini App shows Telegram's back button; with nothing to go back to it leads to the section", async () => {
  const back = backButton()
  window.Telegram = { WebApp: fakeWebApp({ BackButton: back }) }
  setLocation("/customers/7")

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(back.show).toHaveBeenCalled())
  act(() => back.press())
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/customers"))
  expect(moved()).toBe("back")
})

test("with a page to go back to, Telegram's back button goes back", async () => {
  const back = backButton()
  window.Telegram = { WebApp: fakeWebApp({ BackButton: back }) }
  window.history.pushState({}, "", "/customers")
  setLocation("/customers/7")

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(back.show).toHaveBeenCalled())
  act(() => back.press())
  await waitFor(() => expect(router.back).toHaveBeenCalled())
  // The page it goes back to moves as the prototype's pop.
  expect(moved()).toBe("back")
})

test.each(["/customers", "/", "/login", "/select-company"])("on %s Telegram's back button is hidden", async (path) => {
  const back = backButton()
  window.Telegram = { WebApp: fakeWebApp({ BackButton: back }) }
  setLocation(path)

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(back.hide).toHaveBeenCalled())
  expect(back.show).not.toHaveBeenCalled()
})

test("back at the first page the app was opened at, Telegram's back button leads to the section, though the history is longer", async () => {
  const back = backButton()
  window.Telegram = { WebApp: fakeWebApp({ BackButton: back }) }
  window.history.pushState({}, "", "/customers/7")
  // The browser knows there is nothing behind (the Navigation API).
  vi.stubGlobal("navigation", { canGoBack: false })
  onTestFinished(() => {
    vi.unstubAllGlobals()
  })
  setLocation("/customers/7")

  renderWithProviders(<TelegramSync />)

  await waitFor(() => expect(back.show).toHaveBeenCalled())
  act(() => back.press())
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/customers"))
  expect(router.back).not.toHaveBeenCalled()
  expect(moved()).toBe("back")
})
