import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { accessToken } from "@/lib/session"
import { setMiniApp } from "@/lib/telegram"
import { ZARINA } from "@/mocks/data"
import { leave, router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { signIn } from "@/test/session"
import { fakeWebApp } from "@/test/telegram"
import { Expired } from "./expired"

test("says the subscription is over and who can extend it", () => {
  renderWithProviders(<Expired />)

  expect(screen.getByRole("heading", { name: "Obuna muddati tugagan" })).toBeInTheDocument()
  expect(
    screen.getByText("Kompaniya obunasini uzaytirish uchun administrator bilan bog'laning."),
  ).toBeInTheDocument()
})

test("choosing another company drops the expired one and opens the list", async () => {
  // Zarina's only company was chosen at login, and it has expired.
  await signIn(ZARINA)
  const { user } = renderWithProviders(<Expired />)

  await user.click(screen.getByRole("button", { name: "Boshqa kompaniyani tanlash" }))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/select-company"))
  expect(accessToken()).toMatch(new RegExp(`^access:${ZARINA}:none:`))
})

test("signing out ends the session and leaves for /login", async () => {
  await signIn(ZARINA)
  const { user } = renderWithProviders(<Expired />)

  await user.click(screen.getByRole("button", { name: "Chiqish" }))

  await waitFor(() => expect(leave).toHaveBeenCalledWith("/login"))
  expect(accessToken()).toBeNull()
})

test("a switch that fails says why and stays", async () => {
  await signIn(ZARINA)
  server.use(http.post("*/api/app/auth/switch-company", () => HttpResponse.error()))
  const { user } = renderWithProviders(<Expired />)

  await user.click(screen.getByRole("button", { name: "Boshqa kompaniyani tanlash" }))

  expect(await screen.findByRole("alert")).toHaveTextContent("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")
  expect(router.replace).not.toHaveBeenCalled()
})

test("a sign-out that fails says why and keeps the session", async () => {
  await signIn(ZARINA)
  server.use(http.post("*/api/app/auth/logout", () => HttpResponse.error()))
  const { user } = renderWithProviders(<Expired />)

  await user.click(screen.getByRole("button", { name: "Chiqish" }))

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  expect(leave).not.toHaveBeenCalled()
  expect(accessToken()).not.toBeNull()
})

test("inside Telegram /expired has no sign-out, only the way to another company", () => {
  setMiniApp(fakeWebApp())

  renderWithProviders(<Expired />)

  expect(screen.getByRole("button", { name: "Boshqa kompaniyani tanlash" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Chiqish" })).not.toBeInTheDocument()
})
