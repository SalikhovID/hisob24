import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, dropdownsOf, typesOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
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

test("a list that fails to load says why and can be asked for again", async () => {
  await signIn(ALI)
  server.use(http.get("*/api/app/customer-dropdowns", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<SettingsPage />)

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  // The other list is there all the same.
  expect(rowsOf(await typeList())).toHaveLength(2)
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(rowsOf(await dropdownList())).toHaveLength(1)
})

test("an empty list says what it is for", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  db.types.forEach((type) => (type.deleted = true))
  renderWithProviders(<SettingsPage />)

  expect(await screen.findByText("Hali tur yo'q")).toBeInTheDocument()
  expect(screen.getByText("Mijoz qo'shish uchun kamida bitta tur kerak.")).toBeInTheDocument()
  expect(await screen.findByText("Hali dropdown yo'q")).toBeInTheDocument()
  expect(screen.getByText("Dropdown, radio va checkbox maydonlari variantlarni dropdowndan oladi.")).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Mijoz turlari" })).not.toBeInTheDocument()
})
