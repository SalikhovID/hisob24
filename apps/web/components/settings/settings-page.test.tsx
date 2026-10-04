import { screen, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, dropdownsOf, typesOf } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { SettingsPage } from "./settings-page"

// rowsOf reads a list of settings as [name, what it holds] of each row.
const rowsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((row) =>
      ["setting-title", "setting-detail"].map((slot) => row.querySelector(`[data-slot="${slot}"]`)?.textContent ?? null),
    )

const typeList = () => screen.findByRole("list", { name: "Mijoz turlari" })
const dropdownList = () => screen.findByRole("list", { name: "Dropdownlar" })

test("the owner sees the customer types with their fields and the dropdowns with their options", async () => {
  await signIn(ALI)
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Sozlamalar" })).toBeInTheDocument()
  expect(screen.getAllByLabelText("Yuklanmoqda").length).toBeGreaterThan(0)

  const types = await typeList()
  expect(rowsOf(types)).toEqual([
    ["Jismoniy", "F.I.Sh., Manba"],
    ["Yuridik", "Nomi, INN"],
  ])
  const [jismoniy] = typesOf(1)
  expect(within(types).getByRole("link", { name: "Jismoniy" })).toHaveAttribute("href", `/settings/customer-types/${jismoniy.id}`)

  const dropdowns = await dropdownList()
  expect(rowsOf(dropdowns)).toEqual([["Manba", "Instagram, LinkedIn, YouTube"]])
  const [manba] = dropdownsOf(1)
  expect(within(dropdowns).getByRole("link", { name: "Manba" })).toHaveAttribute("href", `/settings/dropdowns/${manba.id}`)
  expect(screen.getByRole("heading", { level: 2, name: "Mijoz turlari" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 2, name: "Dropdownlar" })).toBeInTheDocument()
})
