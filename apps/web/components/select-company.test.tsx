import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test, vi } from "vitest"
import { api, call } from "@/lib/api"
import { meKey } from "@/lib/queries"
import { accessToken } from "@/lib/session"
import { SARDOR, VALI, ZARINA } from "@/mocks/data"
import { leave, router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { SelectCompany } from "./select-company"

test("lists the companies to choose from with the role in each", async () => {
  await signIn(VALI)
  renderWithProviders(<SelectCompany />)
  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()

  const nok = await screen.findByRole("button", { name: /Nok Market/ })

  expect(screen.getByRole("heading", { name: "Kompaniyani tanlang" })).toBeInTheDocument()
  expect(nok).toHaveTextContent("Egasi")
  expect(nok).toBeEnabled()
  expect(screen.getByRole("button", { name: /Olma Savdo/ })).toHaveTextContent("Menejer")
})

test("expired and blocked companies are shown with a badge but cannot be chosen", async () => {
  await signIn(SARDOR)
  renderWithProviders(<SelectCompany />)

  const anor = await screen.findByRole("button", { name: /Anor Servis/ })

  expect(anor).toBeDisabled()
  expect(anor).toHaveTextContent("Muddati o'tgan")
  const behi = screen.getByRole("button", { name: /Behi Blok/ })
  expect(behi).toBeDisabled()
  expect(behi).toHaveTextContent("Bloklangan")
  const olma = screen.getByRole("button", { name: /Olma Savdo/ })
  expect(olma).toBeEnabled()
  expect(olma).not.toHaveTextContent(/Muddati o'tgan|Bloklangan/)
})

test("choosing a company switches to it and opens the dashboard", async () => {
  await signIn(VALI)
  const { user, queryClient } = renderWithProviders(<SelectCompany />)
  // What the dashboard finds in the cache as it opens.
  let cachedMe: unknown = "not opened"
  vi.mocked(router.replace).mockImplementationOnce(() => {
    cachedMe = queryClient.getQueryData(meKey)
  })

  await user.click(await screen.findByRole("button", { name: /Nok Market/ }))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(accessToken()).toMatch(new RegExp(`^access:${VALI}:2:`))
  // The old /app/me (no company yet) is gone, so the dashboard asks afresh.
  expect(cachedMe).toBeUndefined()
})

test("with no company to choose it says so", async () => {
  await signIn(ZARINA)
  await chooseCompany(null)
  renderWithProviders(<SelectCompany />)

  expect(await screen.findByText("Faol kompaniya yo'q")).toBeInTheDocument()
  expect(
    screen.getByText("Kompaniyangiz obunasi tugagan yoki bloklangan. Davom etish uchun administrator bilan bog'laning."),
  ).toBeInTheDocument()
  expect(screen.getByRole("button", { name: /Anor Servis/ })).toBeDisabled()
})

test("signing out ends the session and leaves for /login", async () => {
  await signIn(ZARINA)
  await chooseCompany(null)
  const { user } = renderWithProviders(<SelectCompany />)

  await user.click(await screen.findByRole("button", { name: "Chiqish" }))

  await waitFor(() => expect(leave).toHaveBeenCalledWith("/login"))
  expect(accessToken()).toBeNull()
  // The refresh token is revoked: there is no way back without a new code.
  await expect(call(api.POST("/app/auth/refresh"))).rejects.toMatchObject({ code: "invalid_refresh_token" })
})

test("a session for an expired company is sent to /expired", async () => {
  // Zarina's only company was chosen at login, and it has expired.
  await signIn(ZARINA)

  renderWithProviders(<SelectCompany />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/expired"))
})

test("a list that fails to load says why and can be asked for again", async () => {
  await signIn(VALI)
  server.use(http.get("*/api/app/me", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<SelectCompany />)

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(await screen.findByRole("button", { name: /Nok Market/ })).toBeEnabled()
})
