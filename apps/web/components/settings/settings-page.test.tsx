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

test("on a phone the page is «Sozlama»: the company with who is signed in, the way to the profile; the sections the tab bar does not hold; then the settings, each with how many it holds, the roles and the tab bar's choice", async () => {
  await signIn(ALI)
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Sozlama" })).toBeInTheDocument()
  const me = await screen.findByRole("link", { name: "Olma Savdo Ali Valiyev · Egasi" })
  expect(me).toHaveAttribute("href", "/profile")
  expect(me.closest('[data-slot="phone-only"]')).toHaveClass("md:hidden")
  const pages = (name: string) => partsOf(screen.getByRole("list", { name })).map(([title, href]) => [title, href])
  await waitFor(() =>
    expect(pages("Bo'limlar")).toEqual([
      ["Sotuv", "/sales"],
      ["Ombor", "/warehouse"],
      ["Moliya", "/accounts"],
      ["Xodimlar", "/employees"],
    ]),
  )
  const settings = screen.getByRole("list", { name: "Sozlamalar" })
  await waitFor(() =>
    expect(partsOf(settings)).toEqual([
      ["Mijoz turlari", "/settings/customer-types", "2"],
      ["Buyurtma turlari", "/settings/order-types", "1"],
      ["Bosqichlar", "/settings/stages", "3"],
      ["Dropdownlar", "/settings/dropdowns", "1"],
      ["Valyuta kurslari", "/settings/currencies", null],
      ["Moliya kategoriyalari", "/settings/finance-categories", null],
      ["Rollar", "/settings/roles", "0"],
      ["Pastki panel", "/settings/tab-bar", null],
    ]),
  )
})

test("on a wide screen the page is «Sozlamalar», for the owner and whoever may set things: the settings alone, the sections being the sidebar's", async () => {
  await signIn(ALI)
  renderWithProviders(<SettingsPage />)

  const web = await screen.findByRole("heading", { level: 1, name: "Sozlamalar" })
  expect(web.closest('[data-slot="web-only"]')).toHaveClass("hidden", "md:block")
  expect(screen.getByText("Faqat egasi va sozlash ruxsatli xodimlar uchun")).toBeInTheDocument()
  expect(screen.getByRole("heading", { level: 1, name: "Sozlama" }).closest('[data-slot="phone-only"]')).toHaveClass("md:hidden")
  expect((await screen.findByRole("list", { name: "Bo'limlar" })).closest('[data-slot="phone-only"]')).toHaveClass("md:hidden")
})

test("whoever may open the settings sees every part but the roles: they are the owner's", async () => {
  giveRole(VALI, 1, "Sozlovchi", ["settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<SettingsPage />)

  const settings = await screen.findByRole("list", { name: "Sozlamalar" })
  await waitFor(() => expect(within(settings).getByRole("link", { name: /Mijoz turlari/ })).toBeInTheDocument())
  expect(within(settings).queryByRole("link", { name: /Rollar/ })).not.toBeInTheDocument()
})

test("an employee without the settings finds the sections they may open and the tab bar's choice, and nothing of the settings", async () => {
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

  expect(await screen.findByRole("heading", { level: 1, name: "Sozlama" })).toBeInTheDocument()
  expect(await screen.findByRole("list", { name: "Bo'limlar" })).toBeInTheDocument()
  const settings = screen.getByRole("list", { name: "Sozlamalar" })
  expect(partsOf(settings).map(([title]) => title)).toEqual(["Pastki panel"])
  expect(router.replace).not.toHaveBeenCalled()
  expect(asked).toBe(false)
})

test.each([
  ["customers", "/settings/customer-types"],
  ["tasks", "/settings/order-types"],
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
