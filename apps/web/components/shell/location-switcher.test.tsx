import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, VALI } from "@/mocks/data"
import { addLocation, restrictTo } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { LocationSwitcher } from "./location-switcher"

// The switch between the locations the member may work in (logic/locations.md,
// section 4) is a pill that opens a sheet of them; with one there is nothing
// to switch, and nothing is shown.

test("with one location there is no switch", async () => {
  await signIn(ALI)
  const { queryClient } = renderWithProviders(<LocationSwitcher />)

  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  expect(screen.queryByRole("button", { name: /^Lokatsiya/ })).not.toBeInTheDocument()
})

test("with two or more the pill says the current one; the sheet chooses another, kept for the next visit", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { user } = renderWithProviders(<LocationSwitcher />)

  const pill = await screen.findByRole("button", { name: "Lokatsiya: Asosiy" })
  await user.click(pill)
  const sheet = await screen.findByRole("dialog", { name: "Lokatsiya" })
  expect(within(sheet).getByRole("menuitemradio", { name: "Asosiy" })).toHaveAttribute("aria-checked", "true")
  await user.click(within(sheet).getByRole("menuitemradio", { name: "Chilonzor" }))

  expect(await screen.findByRole("button", { name: "Lokatsiya: Chilonzor" })).toBeInTheDocument()
  expect(localStorage.getItem(`location:1:${ALI}`)).toBe(String(chilonzor.id))
})

test("a restricted employee with one location to work in sees no switch, though the company has more", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  restrictTo(VALI, 1, [chilonzor.id])
  await signIn(VALI)
  await chooseCompany(1)
  const { queryClient } = renderWithProviders(<LocationSwitcher />)

  await waitFor(() => expect(queryClient.isFetching()).toBe(0))
  expect(screen.queryByRole("button", { name: /^Lokatsiya/ })).not.toBeInTheDocument()
})

test("the pill is the prototype's frosted glass", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<LocationSwitcher />)

  const pill = await screen.findByRole("button", { name: "Lokatsiya: Asosiy" })
  expect(pill).toHaveClass("surface", "rounded-full")
  expect(pill).not.toHaveClass("bg-card")
})
