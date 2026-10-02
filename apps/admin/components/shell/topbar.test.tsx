import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { setMiniApp } from "@/lib/telegram"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { fakeWebApp } from "@/test/telegram"
import { Topbar } from "./topbar"

test("the top bar shows who is signed in and signs them out", async () => {
  let signedOut = false
  server.use(
    http.post("*/api/admin/auth/logout", () => {
      signedOut = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  const { user } = renderWithProviders(<Topbar />)

  expect(await screen.findByText("Owner")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Chiqish" }))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/login"))
  expect(signedOut).toBe(true)
})

test("inside Telegram the top bar has no sign-out: the chat is the way out", async () => {
  setMiniApp(fakeWebApp())

  renderWithProviders(<Topbar />)

  expect(await screen.findByText("Owner")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Chiqish" })).not.toBeInTheDocument()
})

test("on a phone the menu button opens the sections, and picking one closes it", async () => {
  const { user } = renderWithProviders(<Topbar />)

  await user.click(screen.getByRole("button", { name: "Menyu" }))
  const menu = await screen.findByRole("dialog")
  await user.click(within(menu).getByRole("link", { name: "Adminlar" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})
