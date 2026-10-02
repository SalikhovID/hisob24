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
