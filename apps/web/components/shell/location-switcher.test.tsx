import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, VALI } from "@/mocks/data"
import { addLocation, restrictTo } from "@/test/locations"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { chooseCompany, signIn } from "@/test/session"
import { Topbar } from "./topbar"

// The switch between the locations the member may work in stands in the
// top bar when there are two or more of them (logic/locations.md, section
// 4); with one there is nothing to switch, and nothing is shown.

test("with one location the top bar shows no switch", async () => {
  await signIn(ALI)
  renderWithProviders(<Topbar />)

  await within(screen.getByRole("banner")).findByText("Olma Savdo")
  expect(screen.queryByRole("combobox", { name: "Lokatsiya" })).not.toBeInTheDocument()
})

test("with two or more locations the top bar offers the switch; the choice is kept for the next visit", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  await signIn(ALI)
  const { user } = renderWithProviders(<Topbar />)

  const box = await screen.findByRole("combobox", { name: "Lokatsiya" })
  expect(box).toHaveTextContent("Asosiy")
  await choose(user, box, "Chilonzor")

  expect(screen.getByRole("combobox", { name: "Lokatsiya" })).toHaveTextContent("Chilonzor")
  expect(localStorage.getItem(`location:1:${ALI}`)).toBe(String(chilonzor.id))
})

test("a restricted employee with one location to work in sees no switch, though the company has more", async () => {
  const chilonzor = addLocation(1, "Chilonzor")
  restrictTo(VALI, 1, [chilonzor.id])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<Topbar />)

  await within(screen.getByRole("banner")).findByText("Olma Savdo")
  await waitFor(() => expect(screen.queryByRole("combobox", { name: "Lokatsiya" })).not.toBeInTheDocument())
})

test("the switch stands between the company's name and the profile", async () => {
  addLocation(1, "Chilonzor")
  await signIn(ALI)
  renderWithProviders(<Topbar />)

  const box = await screen.findByRole("combobox", { name: "Lokatsiya" })
  const name = within(screen.getByRole("banner")).getByText("Olma Savdo")
  const profile = screen.getByRole("button", { name: "Profil" })
  expect(name.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(box.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
