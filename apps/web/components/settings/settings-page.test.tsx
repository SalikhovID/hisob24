import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, VALI } from "@/mocks/data"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { SettingsPage } from "./settings-page"

// partsOf reads the hub's rows as [what, where it leads, how many it holds].
const partsOf = (container: HTMLElement) =>
  within(container)
    .getAllByRole("link")
    .map((link) => [rowParts(link).title, link.getAttribute("href"), rowParts(link).end])

test("the owner's settings as the prototype's hub: each part a tile row with how many it holds, leading to its page; the roles apart, with what they are", async () => {
  await signIn(ALI)
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Sozlamalar" })).toBeInTheDocument()
  expect(screen.getByText("Mijozlar, vazifalar, valyutalar va moliya sozlamalari")).toBeInTheDocument()
  const main = await screen.findByRole("list", { name: "Mijozlar va vazifalar" })
  await waitFor(() =>
    expect(partsOf(main)).toEqual([
      ["Mijoz turlari", "/settings/customer-types", "2"],
      ["Vazifa turlari", "/settings/task-types", "1"],
      ["Bosqichlar", "/settings/stages", "3"],
      ["Dropdownlar", "/settings/dropdowns", "1"],
    ]),
  )
  expect(partsOf(screen.getByRole("list", { name: "Valyuta va moliya" }))).toEqual([
    ["Valyuta kurslari", "/settings/currencies", null],
    ["Moliya kategoriyalari", "/settings/finance-categories", null],
  ])
  await waitFor(() => expect(partsOf(screen.getByRole("list", { name: "Rollar" }))).toEqual([["Rollar", "/settings/roles", "0"]]))
  expect(screen.getByText("Rol xodimga qaysi bo'limlarda nima qilishi mumkinligini belgilaydi. Rollar faqat kompaniya egasiga ko'rinadi.")).toBeInTheDocument()
})

test("whoever may open the settings sees every part but the roles: they are the owner's", async () => {
  giveRole(VALI, 1, "Sozlovchi", ["settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByRole("list", { name: "Mijozlar va vazifalar" })).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Rollar" })).not.toBeInTheDocument()
  expect(screen.queryByText(/Rollar faqat kompaniya egasiga ko'rinadi/)).not.toBeInTheDocument()
})

test("an employee is sent home: the settings are the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  let asked = false
  server.use(
    http.get("*/api/app/customer-types", () => {
      asked = true
      return HttpResponse.json([])
    }),
  )
  renderWithProviders(<SettingsPage />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading", { name: "Sozlamalar" })).not.toBeInTheDocument()
  expect(asked).toBe(false)
})

test.each([
  ["customers", "/settings/customer-types"],
  ["tasks", "/settings/task-types"],
  ["dropdowns", "/settings/dropdowns"],
  ["currencies", "/settings/currencies"],
  ["finance", "/settings/finance-categories"],
  ["roles", "/settings/roles"],
])("an old address of the %s tab leads to its page", async (tab, page) => {
  await signIn(ALI)
  setLocation(`/settings?tab=${tab}`)
  renderWithProviders(<SettingsPage />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(page))
})
