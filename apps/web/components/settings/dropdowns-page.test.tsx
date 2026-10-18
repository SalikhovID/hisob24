import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, dropdownsOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { DropdownsPage } from "./dropdowns-page"

const dropdownList = () => screen.findByRole("list", { name: "Dropdownlar" })
const rowsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => {
      const { title, sub } = rowParts(item.firstElementChild as HTMLElement)
      return [title, sub]
    })

test("the dropdowns as the prototype's rows: each by name with its options under it, leading to its page; the heading counts them", async () => {
  await signIn(ALI)
  renderWithProviders(<DropdownsPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Dropdownlar" })).toBeInTheDocument()
  expect(screen.getByText("Tanlov maydonlari variantlarni shu yerdan oladi. Mijoz va buyurtma maydonlari uchun umumiy.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  const list = await dropdownList()
  expect(screen.getByRole("heading", { level: 2, name: "1 ta dropdown" })).toBeInTheDocument()
  expect(rowsOf(list)).toEqual([["Manba", "Instagram, LinkedIn, YouTube"]])
  expect(within(list).getByRole("link")).toHaveAttribute("href", `/settings/dropdowns/${dropdownsOf(1)[0].id}`)
})

test("a dropdown is added from the plus's sheet and joins the list, with no option yet", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownsPage />)
  await dropdownList()

  await user.click(screen.getByRole("button", { name: "Dropdown qo'shish" }))
  const sheet = await screen.findByRole("dialog", { name: "Dropdown qo'shish" })
  expect(within(sheet).getByLabelText("Nomi")).toHaveAttribute("placeholder", "Masalan, Manba")
  await user.type(within(sheet).getByLabelText("Nomi"), "Holat")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect((await screen.findAllByText("Dropdown qo'shildi")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(rowsOf(await dropdownList())).toEqual([["Manba", "Instagram, LinkedIn, YouTube"], ["Holat", "Variant yo'q"]]))
})

test("none yet says what they are for; a list that fails to load can be asked for again", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  db.dropdowns.forEach((dropdown) => {
    if (dropdown.companyId === 2) dropdown.deleted = true
  })
  const { unmount } = renderWithProviders(<DropdownsPage />)
  expect(await screen.findByText("Hali dropdown yo'q")).toBeInTheDocument()
  expect(screen.getByText("Dropdown, radio va checkbox maydonlari variantlarni dropdowndan oladi.")).toBeInTheDocument()
  unmount()

  server.use(http.get("*/api/app/customer-dropdowns", () => HttpResponse.error(), { once: true }))
  db.cooldown = false
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownsPage />)
  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(await dropdownList()).toBeInTheDocument()
})

test("an employee is sent home; settings.view alone reads the dropdowns without the plus", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { unmount } = renderWithProviders(<DropdownsPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  unmount()

  giveRole(VALI, 1, "Kuzatuvchi", ["settings.view"])
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  router.replace.mockClear()
  renderWithProviders(<DropdownsPage />)
  expect(rowsOf(await dropdownList())).toHaveLength(1)
  expect(screen.queryByRole("button", { name: "Dropdown qo'shish" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})
