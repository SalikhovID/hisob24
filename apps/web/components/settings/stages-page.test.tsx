import { act, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, stagesOf, VALI } from "@/mocks/data"
import { router } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { rowParts } from "@/test/rows"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { StagesPage } from "./stages-page"

const stageList = () => screen.findByRole("list", { name: "Bosqichlar" })
// stagesIn reads the list as each stage's name (with its mark) and color.
const stagesIn = (list: HTMLElement) =>
  within(list)
    .getAllByRole("listitem")
    .map((item) => {
      const { title, sub } = rowParts(item.firstElementChild as HTMLElement)
      return [title?.replace(/\s+/g, " ").trim(), sub]
    })
const names = (list: HTMLElement) => stagesIn(list).map(([title]) => title?.replace(/ Yakuniy$/, ""))
const stageRow = async (name: string) => within(await stageList()).getByRole("button", { name: new RegExp(`^${name}`) })

test("the stages as the prototype's rows: each with its color's dot and name, the final one marked; the heading counts them, the foot says what the final one means", async () => {
  await signIn(ALI)
  renderWithProviders(<StagesPage />)

  expect(await screen.findByRole("heading", { level: 1, name: "Bosqichlar" })).toBeInTheDocument()
  expect(screen.getByText("Kanban ustunlari. Vazifa shulardan birida turadi.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Sozlamalar" })).toHaveAttribute("href", "/settings")
  expect(stagesIn(await stageList())).toEqual([
    ["Yangi", "Ko'k"],
    ["Jarayonda", "Sariq"],
    ["Bajarildi Yakuniy", "Yashil"],
  ])
  expect(screen.getByRole("heading", { level: 2, name: "3 ta bosqich" })).toBeInTheDocument()
  expect(screen.getByText("Yakuniy bosqichdagi vazifa bajarilgan hisoblanadi va kanbanda yig'ilgan ustunda turadi.")).toBeInTheDocument()
})

test("a stage is added from the plus's sheet with its color and the final mark; the sheet says what is missing, and why the API refused", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<StagesPage />)
  await stageList()

  await user.click(screen.getByRole("button", { name: "Bosqich qo'shish" }))
  const sheet = await screen.findByRole("dialog", { name: "Bosqich qo'shish" })
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Nomni kiriting")).toBeInTheDocument()
  expect(within(sheet).getByText("Rangni tanlang")).toBeInTheDocument()
  await user.type(within(sheet).getByLabelText("Nomi"), "yangi")
  await user.click(within(sheet).getByRole("radio", { name: "Qizil" }))
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Bu nomli bosqich allaqachon bor")).toBeInTheDocument()
  expect(stagesOf(1)).toHaveLength(3)

  await user.clear(within(sheet).getByLabelText("Nomi"))
  await user.type(within(sheet).getByLabelText("Nomi"), "Kutilmoqda")
  await user.click(within(sheet).getByRole("radio", { name: "Moviy" }))
  await user.click(within(sheet).getByRole("switch", { name: "Yakuniy bosqich" }))
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect((await screen.findAllByText("Bosqich qo'shildi")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(names(await stageList())).toEqual(["Yangi", "Jarayonda", "Bajarildi", "Kutilmoqda"]))
  expect(db.stages.find((s) => s.name === "Kutilmoqda")).toMatchObject({ color: "teal", done: true, companyId: 1 })
})

test("a stage's row opens its sheet: its name, color and final mark come filled in and change", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<StagesPage />)

  await user.click(await stageRow("Jarayonda"))
  const sheet = await screen.findByRole("dialog", { name: "Bosqichni tahrirlash" })
  const name = within(sheet).getByLabelText("Nomi")
  expect(name).toHaveValue("Jarayonda")
  expect(within(sheet).getByRole("radio", { name: "Sariq" })).toBeChecked()
  expect(within(sheet).getByRole("switch", { name: "Yakuniy bosqich" })).not.toBeChecked()
  await user.clear(name)
  await user.type(name, "Ishda")
  await user.click(within(sheet).getByRole("radio", { name: "Binafsha" }))
  await user.click(within(sheet).getByRole("switch", { name: "Yakuniy bosqich" }))
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect((await screen.findAllByText("Bosqich saqlandi")).length).toBeGreaterThan(0)
  await waitFor(async () => expect(names(await stageList())).toEqual(["Yangi", "Ishda", "Bajarildi"]))
  expect(db.stages.find((s) => s.name === "Ishda")).toMatchObject({ color: "violet", done: true })
})

test("a stage is deleted from its sheet after asking; one the API will not delete stays, and the reason is said", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<StagesPage />)

  await user.click(await stageRow("Yangi"))
  await user.click(within(await screen.findByRole("dialog", { name: "Bosqichni tahrirlash" })).getByRole("button", { name: "Bosqichni o'chirish" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Bosqichni o'chirasizmi?" })
  expect(within(confirm).getByText(/«Yangi» bosqichi o'chadi/)).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Bosqich o'chirildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  await waitFor(async () => expect(names(await stageList())).toEqual(["Jarayonda", "Bajarildi"]))

  server.use(
    http.delete("*/api/app/order-stages/:id", () => HttpResponse.json({ error: "stage_in_use", message: "Bu bosqichda 2 ta buyurtma bor" }, { status: 409 })),
  )
  await user.click(await stageRow("Jarayonda"))
  await user.click(within(await screen.findByRole("dialog", { name: "Bosqichni tahrirlash" })).getByRole("button", { name: "Bosqichni o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "O'chirish" }))
  expect((await screen.findAllByText("Bu bosqichda 2 ta buyurtma bor")).length).toBeGreaterThan(0)
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(names(await stageList())).toEqual(["Jarayonda", "Bajarildi"])
})

test("the stages are put in order in the «Tartiblash» mode, and the order is saved", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<StagesPage />)
  await stageList()

  await user.click(screen.getByRole("button", { name: "Tartiblash" }))
  act(() => within(screen.getByRole("list", { name: "Bosqichlar" })).getByRole("button", { name: "Bajarildi: tartibini o'zgartirish" }).focus())
  await user.keyboard("{ArrowUp}")

  expect(names(await stageList())).toEqual(["Yangi", "Bajarildi", "Jarayonda"])
  await waitFor(() => expect(stagesOf(1).map((s) => s.name)).toEqual(["Yangi", "Bajarildi", "Jarayonda"]))
})

test("with none yet the stages say what they are for; a list that fails to load can be asked for again", async () => {
  await signIn(VALI)
  await chooseCompany(2)
  db.stages.forEach((stage) => (stage.deleted = true))
  const { unmount } = renderWithProviders(<StagesPage />)
  expect(await screen.findByText("Hali bosqich yo'q")).toBeInTheDocument()
  expect(screen.getByText("Vazifa qo'shish uchun kamida bitta bosqich kerak.")).toBeInTheDocument()
  unmount()

  db.stages.forEach((stage) => (stage.deleted = false))
  server.use(http.get("*/api/app/order-stages", () => HttpResponse.error(), { once: true }))
  const { user } = renderWithProviders(<StagesPage />)
  expect(await screen.findByText("Tarmoq xatosi. Internetni tekshirib, qayta urinib ko'ring")).toBeInTheDocument()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(await stageList()).toBeInTheDocument()
})

test("an employee is sent home; settings.view alone reads the stages without a way to change them", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { unmount } = renderWithProviders(<StagesPage />)
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"))
  unmount()

  giveRole(VALI, 1, "Kuzatuvchi", ["settings.view"])
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  forgetWayHome()
  renderWithProviders(<StagesPage />)
  const list = await stageList()
  expect(stagesIn(list)).toHaveLength(3)
  expect(within(list).queryAllByRole("button")).toHaveLength(0)
  expect(screen.queryByRole("button", { name: "Bosqich qo'shish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Tartiblash" })).not.toBeInTheDocument()
})

// forgetWayHome forgets the way home asked for before.
function forgetWayHome() {
  router.replace.mockClear()
}
