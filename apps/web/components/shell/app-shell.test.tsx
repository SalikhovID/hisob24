import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, VALI, ZARINA } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
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
