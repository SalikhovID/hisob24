import { act, screen, waitFor } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { accessToken } from "@/lib/session"
import { ALI, db, TG_ALI, TG_STRANGER, TG_UNLINKED, TG_VALI } from "@/mocks/data"
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

test("a phone that is no user's is told so, with the number, and the app can be closed", async () => {
  const webApp = fakeWebApp({}, TG_STRANGER)
  const { user } = renderWithProviders(<TelegramLogin webApp={webApp} onFallback={vi.fn()} />)

  expect(await screen.findByRole("heading", { name: "Kirish huquqi yo'q" })).toBeInTheDocument()
  expect(
    screen.getByText(
      "Hisob24'ga kirish huquqingiz yo'q. Raqamingiz: +998 90 555 66 77. Kompaniyangiz administratoriga murojaat qiling.",
    ),
  ).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Yopish" }))
  expect(webApp.close).toHaveBeenCalled()
  expect(router.replace).not.toHaveBeenCalled()
})

// sharesContact stands for Telegram and the user bot: the contact the user
// shares reaches the bot, which links it to the account.
function sharesContact(phone: string, shared = true) {
  return vi.fn((callback: (shared: boolean) => void) => {
    if (shared) db.contacts[TG_UNLINKED] = phone
    callback(shared)
  })
}

test("an account that never shared its phone shares it from the app and is then signed in", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  try {
    const webApp = fakeWebApp({ requestContact: sharesContact(ALI) }, TG_UNLINKED)
    const { user } = renderWithProviders(<TelegramLogin webApp={webApp} onFallback={vi.fn()} />, {
      advanceTimers: vi.advanceTimersByTime,
    })
    expect(await screen.findByRole("heading", { name: "Telefon raqamingiz ulanmagan" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Raqamni yuborish" }))
    await act(() => vi.advanceTimersByTimeAsync(1000))

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
    expect(webApp.requestContact).toHaveBeenCalledOnce()
  } finally {
    vi.useRealTimers()
  }
})

test("someone who declines to share is told how to share the phone in the bot", async () => {
  const webApp = fakeWebApp({ requestContact: sharesContact(ALI, false) }, TG_UNLINKED)
  const { user } = renderWithProviders(<TelegramLogin webApp={webApp} onFallback={vi.fn()} />)

  await user.click(await screen.findByRole("button", { name: "Raqamni yuborish" }))

  expect(screen.getByText("Botga qaytib, /start yozing va raqamingizni yuboring.")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Botga qaytish" }))
  expect(webApp.close).toHaveBeenCalled()
})
