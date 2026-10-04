import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { fakeWebApp } from "@/test/telegram"
import { LoginScreen } from "./login-screen"

test("in a browser tab the login asks for the bot's code", () => {
  renderWithProviders(<LoginScreen botUsername="hisob24_admin_bot" />)

  expect(screen.getByRole("textbox", { name: "Kod" })).toBeInTheDocument()
})

test("inside Telegram an admin is signed in with initData, no code asked", async () => {
  const webApp = fakeWebApp()
  window.Telegram = { WebApp: webApp }
  let sent: unknown
  server.use(
    http.post("*/api/admin/auth/telegram", async ({ request }) => {
      sent = await request.json()
      return HttpResponse.json({ telegram_id: 461603558, full_name: "Owner" })
    }),
  )

  renderWithProviders(<LoginScreen botUsername="hisob24_admin_bot" />)

  expect(await screen.findByText("Telegram orqali kirilmoqda…")).toBeInTheDocument()
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/companies"))
  expect(sent).toEqual({ initData: webApp.initData })
})

test("a Telegram user who is no admin sees why, with their ID and a close button", async () => {
  const webApp = fakeWebApp({
    initData: "user=%7B%22id%22%3A42%7D&hash=abc",
    initDataUnsafe: { user: { id: 42, first_name: "Begona" } },
  })
  window.Telegram = { WebApp: webApp }
  const { user } = renderWithProviders(<LoginScreen botUsername="hisob24_admin_bot" />)

  expect(await screen.findByRole("heading", { name: "Sizda ruxsat yo'q" })).toBeInTheDocument()
  expect(screen.getByText("Telegram ID: 42")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Yopish" }))

  expect(webApp.close).toHaveBeenCalled()
  expect(router.replace).not.toHaveBeenCalled()
})

test("when Telegram sign-in fails the message shows and the code form takes over", async () => {
  window.Telegram = { WebApp: fakeWebApp() }
  server.use(
    http.post("*/api/admin/auth/telegram", () =>
      HttpResponse.json(
        { error: "invalid_init_data", message: "Telegram ma'lumotlari tasdiqlanmadi" },
        { status: 401 },
      ),
    ),
  )

  renderWithProviders(<LoginScreen botUsername="hisob24_admin_bot" />)

  expect(await screen.findByRole("alert")).toHaveTextContent("Telegram ma'lumotlari tasdiqlanmadi")
  expect(screen.getByRole("textbox", { name: "Kod" })).toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("when the browser keeps no session cookie the panel says so instead of looping", async () => {
  const webApp = fakeWebApp()
  window.Telegram = { WebApp: webApp }
  server.use(
    http.get("*/api/admin/me", () =>
      HttpResponse.json({ error: "unauthorized", message: "Avval tizimga kiring" }, { status: 401 }),
    ),
  )
  const { user } = renderWithProviders(<LoginScreen botUsername="hisob24_admin_bot" />)

  expect(await screen.findByText(/Brauzer kirish ma'lumotini saqlamadi/)).toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Yopish" }))
  expect(webApp.close).toHaveBeenCalled()
})

test("inside Telegram the login's screens are headed by the brand", async () => {
  window.Telegram = {
    WebApp: fakeWebApp({
      initData: "user=%7B%22id%22%3A42%7D&hash=abc",
      initDataUnsafe: { user: { id: 42, first_name: "Begona" } },
    }),
  }
  renderWithProviders(<LoginScreen botUsername="hisob24_admin_bot" />)

  expect(await screen.findByRole("heading", { name: "Sizda ruxsat yo'q" })).toBeInTheDocument()
  expect(screen.getByRole("img", { name: "Hisob24" })).toBeInTheDocument()
  expect(screen.getByText("Admin")).toBeInTheDocument()
})
