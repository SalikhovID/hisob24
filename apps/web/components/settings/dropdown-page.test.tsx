import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, dropdownsOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { DropdownPage } from "./dropdown-page"
import { moved } from "@/test/moves"

const optionList = () => screen.findByRole("list", { name: "Variantlar" })
// optionsOf reads the list as each option's name and marks.
const optionsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => {
      const row = item.firstElementChild as HTMLElement
      return {
        label: row.querySelector('[data-slot="row-title"] > span')?.textContent,
        marks: Array.from(row.querySelectorAll('[data-slot="badge"]')).map((mark) => mark.textContent),
      }
    })
const optionRow = async (label: string) => within(await optionList()).getByRole("button", { name: new RegExp(`^${label}`) })
// actionsOf opens an option's sheet of actions and reads them.
async function actionsOf(user: { click: (element: Element) => Promise<void> }, label: string) {
  await user.click(await optionRow(label))
  const sheet = await screen.findByRole("menu")
  return { sheet, items: within(sheet).getAllByRole("menuitem").map((item) => item.textContent) }
}

const manbaId = () => dropdownsOf(1)[0].id

test("the owner sees the dropdown's options as the prototype's rows in their order, the ones turned off marked and said what that means; the dropdown is renamed and deleted from rows under them", async () => {
  await signIn(ALI)
  renderWithProviders(<DropdownPage id={manbaId()} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Manba" })).toBeInTheDocument()
  expect(screen.getByText("Dropdown · 3 ta variant")).toBeInTheDocument()
  expect(optionsOf(await optionList())).toEqual([
    { label: "Instagram", marks: [] },
    { label: "LinkedIn", marks: [] },
    { label: "YouTube", marks: ["Nofaol"] },
  ])
  expect(screen.getByRole("link", { name: "Dropdownlar" })).toHaveAttribute("href", "/settings/dropdowns")
  expect(screen.getByText("Nofaol variant yangi tanlovlarda chiqmaydi, eski yozuvlarda qoladi.")).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Nomini o'zgartirish" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Dropdownni o'chirish" })).toBeInTheDocument()
})

test("a dropdown that is not there says so and leads back to the dropdowns", async () => {
  await signIn(ALI)
  renderWithProviders(<DropdownPage id={999} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Dropdown topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu dropdown o'chirilgan yoki sizning kompaniyangizniki emas.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Dropdownlar" })).toHaveAttribute("href", "/settings/dropdowns")
})

test("a dropdown with no options says how to add one", async () => {
  await signIn(ALI)
  db.dropdowns[0].options = []
  renderWithProviders(<DropdownPage id={manbaId()} />)

  expect(await screen.findByText("Hali variant yo'q")).toBeInTheDocument()
  expect(screen.getByText("Pastdagi satrga yozib, «Qo'shish» ni bosing.")).toBeInTheDocument()
  expect(screen.getByText("Dropdown · 0 ta variant")).toBeInTheDocument()
})

test("the dropdown's page says why it failed to load and can be asked for again; an employee is sent home", async () => {
  await signIn(ALI)
  server.use(http.get("*/api/app/customer-dropdowns", () => HttpResponse.error(), { once: true }))
  const { user, unmount } = renderWithProviders(<DropdownPage id={manbaId()} />)
  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(await screen.findByRole("heading", { level: 1, name: "Manba" })).toBeInTheDocument()
  unmount()

  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<DropdownPage id={manbaId()} />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
})

test("options are added one after another from the line under the list; the line says why one was refused, and adds nothing for an empty one", async () => {
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
  await waitFor(async () => expect(optionsOf(await optionList()).map((option) => option.label)).toEqual(["Instagram", "LinkedIn", "YouTube", "Tavsiya", "Telegram"]))

  await user.type(input, "instagram{Enter}")
  expect(await screen.findByText("Bu variant allaqachon bor")).toBeInTheDocument()
  expect(input).toHaveValue("instagram")
  await user.clear(input)
  await user.type(input, "   {Enter}")
  expect(dropdownsOf(1)[0].options).toHaveLength(5)
})

test("an option's row opens its sheet of actions: renamed there", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)

  const { sheet, items } = await actionsOf(user, "LinkedIn")
  expect(items).toEqual(["Nomini o'zgartirish", "Nofaol qilish", "O'chirish"])
  await user.click(within(sheet).getByRole("menuitem", { name: "Nomini o'zgartirish" }))
  const rename = await screen.findByRole("dialog", { name: "Variant nomini o'zgartirish" })
  expect(within(rename).getByLabelText("Nomi")).toHaveValue("LinkedIn")
  await user.clear(within(rename).getByLabelText("Nomi"))
  await user.type(within(rename).getByLabelText("Nomi"), "Linkedin (ish)")
  await user.click(within(rename).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect((await screen.findAllByText("Variant nomi o'zgartirildi")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(optionsOf(await optionList())[1].label).toBe("Linkedin (ish)"))
})

test("an option is turned off and on again from its sheet of actions", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)

  let { sheet } = await actionsOf(user, "Instagram")
  await user.click(within(sheet).getByRole("menuitem", { name: "Nofaol qilish" }))
  expect((await screen.findAllByText("Variant nofaol qilindi")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(optionsOf(await optionList())[0]).toEqual({ label: "Instagram", marks: ["Nofaol"] }))

  ;({ sheet } = await actionsOf(user, "YouTube"))
  await user.click(within(sheet).getByRole("menuitem", { name: "Faollashtirish" }))
  expect((await screen.findAllByText("Variant faollashtirildi")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(optionsOf(await optionList())[2]).toEqual({ label: "YouTube", marks: [] }))
})

test("an option is deleted from its sheet of actions after asking; one the API will not delete stays, and the reason is said", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)

  let { sheet } = await actionsOf(user, "LinkedIn")
  await user.click(within(sheet).getByRole("menuitem", { name: "O'chirish" }))
  let confirm = await screen.findByRole("alertdialog", { name: "Variantni o'chirasizmi?" })
  expect(within(confirm).getByText(/«LinkedIn» ro'yxatdan olib tashlanadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Variant o'chirildi")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(optionsOf(await optionList()).map((option) => option.label)).toEqual(["Instagram", "YouTube"]))

  server.use(
    http.delete("*/api/app/customer-dropdowns/:id/options/:optionId", () =>
      HttpResponse.json({ error: "option_in_use", message: "Bu variant 5 ta mijozda tanlangan" }, { status: 409 }),
    ),
  )
  ;({ sheet } = await actionsOf(user, "Instagram"))
  await user.click(within(sheet).getByRole("menuitem", { name: "O'chirish" }))
  confirm = await screen.findByRole("alertdialog", { name: "Variantni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Bu variant 5 ta mijozda tanlangan")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(optionsOf(await optionList()).map((option) => option.label)).toEqual(["Instagram", "YouTube"])
})

test("the options are put in order in the «Tartiblash» mode, and the order is saved", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<DropdownPage id={manbaId()} />)
  await optionList()

  await user.click(screen.getByRole("button", { name: "Tartiblash" }))
  act(() => within(screen.getByRole("list", { name: "Variantlar" })).getByRole("button", { name: "YouTube: tartibini o'zgartirish" }).focus())
  await user.keyboard("{Home}")

  expect(optionsOf(await optionList()).map((option) => option.label)).toEqual(["YouTube", "Instagram", "LinkedIn"])
  await waitFor(() => expect(dropdownsOf(1)[0].options.map((option) => option.label)).toEqual(["YouTube", "Instagram", "LinkedIn"]))
})

test("the dropdown is renamed from its page; one a field uses is not deleted, with the reason; a free one is, back to the dropdowns", async () => {
  await signIn(ALI)
  db.dropdowns.push({ id: 900, companyId: 1, name: "Holat", options: [] })
  const { user, unmount } = renderWithProviders(<DropdownPage id={manbaId()} />)

  await user.click(await screen.findByRole("button", { name: "Nomini o'zgartirish" }))
  const rename = await screen.findByRole("dialog", { name: "Dropdown nomini o'zgartirish" })
  await user.clear(within(rename).getByLabelText("Nomi"))
  await user.type(within(rename).getByLabelText("Nomi"), "Qayerdan")
  await user.click(within(rename).getByRole("button", { name: "Saqlash" }))
  expect((await screen.findAllByText("Dropdown nomi o'zgartirildi")).length).toBeGreaterThan(0)
  expect(await screen.findByRole("heading", { level: 1, name: "Qayerdan" })).toBeInTheDocument()

  await user.click(screen.getByRole("button", { name: "Dropdownni o'chirish" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Dropdownni o'chirasizmi?" })
  expect(within(confirm).getByText(/«Qayerdan» va uning variantlari o'chadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Bu dropdown 1 ta maydonda ishlatilgan")).length).toBeGreaterThan(0)
  expect(router.replace).not.toHaveBeenCalled()
  unmount()

  renderWithProviders(<DropdownPage id={900} />)
  await user.click(await screen.findByRole("button", { name: "Dropdownni o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog", { name: "Dropdownni o'chirasizmi?" })).getByRole("button", { name: "O'chirish" }))
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/settings/dropdowns"))
  expect(moved()).toBe("back")
  expect(dropdownsOf(1).map((dropdown) => dropdown.name)).toEqual(["Qayerdan"])
})

test("an employee whose role holds settings.view alone sees the options without a way to change them", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["settings.view"])
  await signIn(VALI)
  await chooseCompany(1)
  renderWithProviders(<DropdownPage id={manbaId()} />)

  expect(await screen.findByRole("heading", { level: 1, name: "Manba" })).toBeInTheDocument()
  const list = await optionList()
  expect(optionsOf(list)).toHaveLength(3)
  expect(within(list).queryAllByRole("button")).toHaveLength(0)
  expect(screen.queryByRole("textbox", { name: "Yangi variant" })).not.toBeInTheDocument()
  for (const name of ["Tartiblash", "Nomini o'zgartirish", "Dropdownni o'chirish"]) {
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
  }
  expect(router.replace).not.toHaveBeenCalled()
})
