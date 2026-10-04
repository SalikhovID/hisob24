import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, dropdownsOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { DropdownPage } from "./dropdown-page"

const optionList = () => screen.findByRole("list", { name: "Variantlar" })

// optionsOf reads the list as each option's name and marks.
const optionsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((row) => ({
      label: row.querySelector('[data-slot="setting-title"]')?.textContent,
      marks: Array.from(row.querySelectorAll('[data-slot="badge"]')).map((mark) => mark.textContent),
    }))

const manbaId = () => dropdownsOf(1)[0].id

test("the owner sees the dropdown's options in their order, the ones turned off marked", async () => {
  await signIn(ALI)
  renderWithProviders(<DropdownPage id={manbaId()} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Manba" })).toBeInTheDocument()
  expect(screen.getByText("Dropdown · 3 ta variant")).toBeInTheDocument()
  expect(optionsOf(await optionList())).toEqual([
    { label: "Instagram", marks: [] },
    { label: "LinkedIn", marks: [] },
    { label: "YouTube", marks: ["Nofaol"] },
  ])
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
})

test("a dropdown that is not there says so and leads back", async () => {
  await signIn(ALI)
  renderWithProviders(<DropdownPage id={999} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Dropdown topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu dropdown o'chirilgan yoki sizning kompaniyangizniki emas.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
})

test("a dropdown with no options says how to add one", async () => {
  await signIn(ALI)
  db.dropdowns[0].options = []
  renderWithProviders(<DropdownPage id={manbaId()} />)

  expect(await screen.findByText("Hali variant yo'q")).toBeInTheDocument()
  expect(screen.getByText("Pastdagi satrga yozib, Enter bosing.")).toBeInTheDocument()
  expect(screen.getByText("Dropdown · 0 ta variant")).toBeInTheDocument()
})

test("the dropdown's page says why it failed to load and can be asked for again", async () => {
  await signIn(ALI)
  server.use(http.get("*/api/app/customer-dropdowns", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)

  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))

  expect(await screen.findByRole("heading", { level: 1, name: "Manba" })).toBeInTheDocument()
})

test("an employee is sent home: a dropdown's page is the owner's", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<DropdownPage id={manbaId()} />)

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  expect(screen.queryByRole("heading")).not.toBeInTheDocument()
})
