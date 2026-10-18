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

test("the owner's settings page lists every page in its block, each a way to it, then the settings: each part a tile row with how many it holds; the roles apart, with what they are", async () => {
  await signIn(ALI)
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Sozlamalar" })).toBeInTheDocument()
  expect(screen.getByText("Barcha bo'limlar va sozlamalar")).toBeInTheDocument()
  const pages = (name: string) => partsOf(screen.getByRole("list", { name })).map(([title, href]) => [title, href])
  await waitFor(() =>
    expect(pages("Bo'limlar")).toEqual([
      ["Bosh sahifa", "/"],
      ["Mijozlar", "/customers"],
      ["Buyurtmalar", "/orders"],
      ["Sotuv", "/sales"],
      ["Xodimlar", "/employees"],
    ]),
  )
  expect(pages("Mahsulotlar")).toEqual([
    ["Mahsulotlar", "/products"],
    ["Xizmatlar", "/services"],
  ])
  expect(pages("Ombor")).toEqual([
    ["Ombor", "/warehouse"],
    ["Xaridlar", "/purchases"],
    ["Ko'chirishlar", "/transfers"],
    ["Inventarizatsiya", "/inventories"],
    ["Boshlang'ich qoldiq", "/opening-stock"],
    ["Ta'minotchilar", "/suppliers"],
  ])
  expect(pages("Moliya")).toEqual([
    ["Kassa", "/accounts"],
    ["Xarajatlar", "/expenses"],
    ["O'tkazmalar", "/money-transfers"],
  ])
  for (const heading of ["Bo'limlar", "Mahsulotlar", "Ombor", "Moliya", "Mijozlar va buyurtmalar", "Valyuta va moliya"]) {
    expect(screen.getByRole("heading", { level: 2, name: heading })).toBeInTheDocument()
  }
  const main = await screen.findByRole("list", { name: "Mijozlar va buyurtmalar" })
  await waitFor(() =>
    expect(partsOf(main)).toEqual([
      ["Mijoz turlari", "/settings/customer-types", "2"],
      ["Buyurtma turlari", "/settings/order-types", "1"],
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

test("on a phone the pages the tab bar holds say so, and a card under the pages leads to the bar's choice, naming what it holds", async () => {
  await signIn(ALI)
  renderWithProviders(<SettingsPage />)

  const blocks = await screen.findByRole("list", { name: "Bo'limlar" })
  await waitFor(() =>
    expect(partsOf(blocks).map(([title, , end]) => [title, end])).toEqual([
      ["Bosh sahifa", "Panelda"],
      ["Mijozlar", "Panelda"],
      ["Buyurtmalar", "Panelda"],
      ["Sotuv", null],
      ["Xodimlar", null],
    ]),
  )
  expect(screen.getAllByText("Panelda")[0]).toHaveClass("md:hidden")
  const card = screen.getByRole("link", { name: /^Pastki panelni sozlash/ })
  expect(card).toHaveAttribute("href", "/settings/tab-bar")
  expect(card).toHaveClass("md:hidden", "surface")
  expect(card).toHaveTextContent("Bosh sahifa · Mijozlar · Buyurtmalar · Mahsulotlar")
})

test("whoever may open the settings sees every part but the roles: they are the owner's", async () => {
  giveRole(VALI, 1, "Sozlovchi", ["settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByRole("list", { name: "Mijozlar va buyurtmalar" })).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Rollar" })).not.toBeInTheDocument()
  expect(screen.queryByText(/Rollar faqat kompaniya egasiga ko'rinadi/)).not.toBeInTheDocument()
})

test("an employee without the settings finds the pages they may open and the way to the bar's choice, and nothing of the settings", async () => {
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

  expect(await screen.findByRole("heading", { level: 1, name: "Sozlamalar" })).toBeInTheDocument()
  expect(await screen.findByRole("list", { name: "Bo'limlar" })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /^Pastki panelni sozlash/ })).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Mijozlar va buyurtmalar" })).not.toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Rollar" })).not.toBeInTheDocument()
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
