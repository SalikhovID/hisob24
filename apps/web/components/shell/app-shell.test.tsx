import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, VALI, ZARINA } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { signIn } from "@/test/session"
import { AppShell } from "./app-shell"

const page = <p>Sahifa mazmuni</p>

test("a session with a company gets its page, framed by the sections and the top bar", async () => {
  await signIn(ALI)
  renderWithProviders(<AppShell>{page}</AppShell>)
  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()
  expect(screen.queryByText("Sahifa mazmuni")).not.toBeInTheDocument()

  expect(await screen.findByText("Sahifa mazmuni")).toBeInTheDocument()
  expect(screen.getByRole("main")).toContainElement(screen.getByText("Sahifa mazmuni"))
  const sidebar = screen.getByRole("complementary", { name: "Menyu" })
  expect(within(sidebar).getByRole("link", { name: "Xodimlar" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Profil" })).toBeInTheDocument()
})

test("a session for an expired company is sent to /expired, its page not shown", async () => {
  // Zarina's only company was chosen at login, and it has expired.
  await signIn(ZARINA)
  renderWithProviders(<AppShell>{page}</AppShell>)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/expired"))
  expect(screen.queryByText("Sahifa mazmuni")).not.toBeInTheDocument()
})

test("a session with no company yet is sent to choose one, its page not shown", async () => {
  await signIn(VALI)
  renderWithProviders(<AppShell>{page}</AppShell>)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/select-company"))
  expect(screen.queryByText("Sahifa mazmuni")).not.toBeInTheDocument()
})

test("a session that fails to load says why and can be asked for again", async () => {
  await signIn(ALI)
  server.use(http.get("*/api/app/me", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<AppShell>{page}</AppShell>)

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  expect(screen.queryByText("Sahifa mazmuni")).not.toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(await screen.findByText("Sahifa mazmuni")).toBeInTheDocument()
})

test("the tab bar names the sections under the page, for a phone; there is no menu button", async () => {
  await signIn(ALI)
  renderWithProviders(<AppShell>{page}</AppShell>)
  await screen.findByText("Sahifa mazmuni")

  // The sidebar's column and the tab bar name the same sections; CSS shows one or the other.
  const bars = screen.getAllByRole("navigation", { name: "Bo'limlar" })
  expect(bars).toHaveLength(2)
  const tabBar = bars[1]
  expect(within(tabBar).getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Bosh sahifa",
    "Mijozlar",
    "Vazifalar",
    "Xodimlar",
    "Sozlamalar",
  ])
  expect(screen.getByRole("main").compareDocumentPosition(tabBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole("button", { name: "Menyu" })).not.toBeInTheDocument()
})

test("the sidebar folds, and a page opened later finds it folded", async () => {
  await signIn(ALI)
  const first = renderWithProviders(<AppShell>{page}</AppShell>)
  await screen.findByText("Sahifa mazmuni")

  await first.user.click(screen.getByRole("button", { name: "Menyuni yig'ish" }))
  expect(await screen.findByRole("button", { name: "Menyuni yoyish" })).toBeInTheDocument()
  first.unmount()

  renderWithProviders(<AppShell>{page}</AppShell>)
  expect(await screen.findByRole("button", { name: "Menyuni yoyish" })).toBeInTheDocument()
})
