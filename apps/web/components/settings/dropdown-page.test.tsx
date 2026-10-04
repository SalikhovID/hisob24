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

test("options are added one after another from the line under the list", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)
  await optionList()
  const input = screen.getByRole("textbox", { name: "Yangi variant" })

  await user.type(input, "Tavsiya{Enter}")
  await waitFor(async () => expect(optionsOf(await optionList()).map((option) => option.label)).toContain("Tavsiya"))
  // The line is ready for the next one: empty, and still under the fingers.
  expect(input).toHaveValue("")
  expect(input).toHaveFocus()

  await user.type(input, "Telegram")
  await user.click(screen.getByRole("button", { name: "Qo'shish" }))
  await waitFor(async () =>
    expect(optionsOf(await optionList()).map((option) => option.label)).toEqual([
      "Instagram",
      "LinkedIn",
      "YouTube",
      "Tavsiya",
      "Telegram",
    ]),
  )
})

test("the line says why an option was refused, and adds nothing for an empty one", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)
  await optionList()
  const input = screen.getByRole("textbox", { name: "Yangi variant" })

  await user.type(input, "instagram{Enter}")
  expect(await screen.findByText("Bu variant allaqachon bor")).toBeInTheDocument()
  expect(input).toHaveValue("instagram")

  await user.clear(input)
  await user.type(input, "   {Enter}")
  expect(dropdownsOf(1)[0].options).toHaveLength(3)
})

test("an option is renamed from its row", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)

  await user.click(within(await optionList()).getByRole("button", { name: "Nomini o'zgartirish: LinkedIn" }))
  const dialog = await screen.findByRole("dialog", { name: "Variant nomini o'zgartirish" })
  const name = within(dialog).getByLabelText("Nomi")
  expect(name).toHaveValue("LinkedIn")
  await user.clear(name)
  await user.type(name, "Linkedin (ish)")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Variant nomi o'zgartirildi")).toBeInTheDocument()
  await waitFor(async () => expect(optionsOf(await optionList())[1].label).toBe("Linkedin (ish)"))
})

test("an option is turned off and on again from its row", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)

  await user.click(within(await optionList()).getByRole("button", { name: "Nofaol qilish: Instagram" }))
  expect(await screen.findByText("Variant nofaol qilindi")).toBeInTheDocument()
  await waitFor(async () => expect(optionsOf(await optionList())[0]).toEqual({ label: "Instagram", marks: ["Nofaol"] }))

  await user.click(within(await optionList()).getByRole("button", { name: "Faollashtirish: YouTube" }))
  expect(await screen.findByText("Variant faollashtirildi")).toBeInTheDocument()
  await waitFor(async () => expect(optionsOf(await optionList())[2]).toEqual({ label: "YouTube", marks: [] }))
})

test("an option is deleted after asking; one the API will not delete stays, and the reason is said", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)

  await user.click(within(await optionList()).getByRole("button", { name: "O'chirish: LinkedIn" }))
  let confirm = await screen.findByRole("alertdialog", { name: "Variantni o'chirasizmi?" })
  expect(within(confirm).getByText(/«LinkedIn» ro'yxatdan olib tashlanadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Variant o'chirildi")).toBeInTheDocument()
  await waitFor(async () => expect(optionsOf(await optionList()).map((option) => option.label)).toEqual(["Instagram", "YouTube"]))

  server.use(
    http.delete("*/api/app/customer-dropdowns/:id/options/:optionId", () =>
      HttpResponse.json({ error: "option_in_use", message: "Bu variant 5 ta mijozda tanlangan" }, { status: 409 }),
    ),
  )
  await user.click(within(await optionList()).getByRole("button", { name: "O'chirish: Instagram" }))
  confirm = await screen.findByRole("alertdialog", { name: "Variantni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect(await screen.findByText("Bu variant 5 ta mijozda tanlangan")).toBeInTheDocument()
  expect(optionsOf(await optionList()).map((option) => option.label)).toEqual(["Instagram", "YouTube"])
})

test("the options are put in order from the keyboard, and the order is saved", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)

  within(await optionList()).getByRole("button", { name: "YouTube: tartibini o'zgartirish" }).focus()
  await user.keyboard("{Home}")

  expect(optionsOf(await optionList()).map((option) => option.label)).toEqual(["YouTube", "Instagram", "LinkedIn"])
  await waitFor(() => expect(dropdownsOf(1)[0].options.map((option) => option.label)).toEqual(["YouTube", "Instagram", "LinkedIn"]))
})
