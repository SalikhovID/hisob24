import { screen, waitFor } from "@testing-library/react"
import { expect, test } from "vitest"
import { accessToken } from "@/lib/session"
import { ZARINA } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
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
