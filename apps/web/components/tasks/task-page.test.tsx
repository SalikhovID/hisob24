import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { formatDate } from "@/lib/format"
import { addDays, ALI, db, localToday, seedTasks, VALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { TaskPage } from "./task-page"
import { moved } from "@/test/moves"

// open puts the test on a task's page.
function open(id: number) {
  setLocation(`/tasks/${id}`, { id: String(id) })
  return renderWithProviders(<TaskPage id={id} />)
}

// pairsOf reads a list of names and values as [name, value] of each line.
const pairsOf = (region: HTMLElement) =>
  Array.from(region.querySelectorAll("dt")).map((term) => [term.textContent, term.nextElementSibling?.textContent ?? null])

const info = () => screen.findByRole("region", { name: "Ma'lumot" })
const deadline = () => screen.findByRole("region", { name: "Muddat" })
const stageTrack = () => screen.getByRole("radiogroup", { name: "Bosqich" })
const today = localToday()

test("a task's page shows what it is, its stage among the stages, its deadline, its customer, every field of its type in order, and who entered it; the owner sees its history", async () => {
  await signIn(ALI)
  const { call, dilshod } = seedTasks()

  open(call.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeInTheDocument()
  expect(screen.getByText("Buyurtma · Dilshod Karimov")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Vazifalar" })).toHaveAttribute("href", "/tasks")
  // The stages in their order, the task's one marked.
  expect(within(stageTrack()).getAllByRole("radio").map((radio) => [radio.textContent, radio.getAttribute("aria-checked")])).toEqual([
    ["Yangi", "true"],
    ["Jarayonda", "false"],
    ["Bajarildi", "false"],
  ])
  const due = await deadline()
  expect(due).toHaveTextContent(formatDate(addDays(today, 3)))
  expect(due).toHaveTextContent("3 kun qoldi")
  const tiles = within(screen.getByRole("group", { name: "Amallar" }))
  expect(tiles.getByRole("link", { name: "Mijoz" })).toHaveAttribute("href", `/customers/${dilshod.id}`)
  expect(tiles.getByRole("link", { name: "Qo'ng'iroq" })).toHaveAttribute("href", "tel:+998911112233")
  const customer = screen.getByRole("region", { name: "Mijoz" })
  expect(within(customer).getByRole("link", { name: /^Dilshod Karimov/ })).toHaveAttribute("href", `/customers/${dilshod.id}`)
  await waitFor(() => expect(within(customer).getByText("Jismoniy · +998 91 111 22 33")).toBeInTheDocument())
  expect(pairsOf(await info())).toEqual([
    ["Turi", "Buyurtma"],
    ["Bosqich", "Yangi"],
    ["Mas'ul", "Vali Aliyev"],
    ["Izoh", "Ertalab qo'ng'iroq"],
    ["Summa", "45000"],
    ["Kanal", "Instagram, LinkedIn"],
    ["Qo'shgan", "Ali Valiyev"],
    ["Qo'shilgan", "02.10.2026"],
  ])
  const history = await screen.findByRole("list", { name: "Tarix" })
  expect(within(history).getAllByRole("listitem")).toHaveLength(1)
  expect(within(history).getByText("Qo'shildi")).toBeInTheDocument()
})

test("a late task's deadline is red on its page; one due today says so; a task with nobody assigned and no answers shows dashes", async () => {
  await signIn(ALI)
  const { invoice, contract } = seedTasks()
  const { unmount } = open(invoice.id)

  await screen.findByRole("heading", { level: 1, name: "Hisob-faktura" })
  expect(within(await deadline()).getByText("2 kun kechikdi")).toHaveAttribute("data-variant", "red")

  unmount()
  open(contract.id)
  await screen.findByRole("heading", { level: 1, name: "Shartnoma yuborish" })
  expect(within(await deadline()).getByText("Bugun")).toHaveAttribute("data-variant", "warn")
  expect(pairsOf(await info())).toEqual([
    ["Turi", "Vazifa"],
    ["Bosqich", "Jarayonda"],
    ["Mas'ul", "—"],
    ["Qo'shgan", "Vali Aliyev"],
    ["Qo'shilgan", "02.10.2026"],
  ])
})

test("the stage is changed on the page's track at once", async () => {
  await signIn(ALI)
  const { call, bajarildi } = seedTasks()
  const { user } = open(call.id)
  await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })

  await user.click(within(stageTrack()).getByRole("radio", { name: "Bajarildi" }))

  expect(await screen.findByText("Bosqich o'zgartirildi")).toBeInTheDocument()
  await waitFor(() => expect(within(stageTrack()).getByRole("radio", { name: "Bajarildi" })).toHaveAttribute("aria-checked", "true"))
  expect(db.tasks.find((task) => task.id === call.id)?.stageId).toBe(bajarildi.id)
  // In the done stage the deadline says it is done.
  expect(within(await deadline()).getByText("Bajarilgan")).toHaveAttribute("data-variant", "green")
  expect(pairsOf(await info())[1]).toEqual(["Bosqich", "Bajarildi"])
  expect(within(await screen.findByRole("list", { name: "Tarix" })).getAllByRole("listitem")).toHaveLength(2)
})

test("an employee sees the task, but not its history", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { call } = seedTasks()

  open(call.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeInTheDocument()
  await info()
  expect(screen.queryByRole("heading", { name: "Tarix" })).not.toBeInTheDocument()
})

test("a task that is gone is not found", async () => {
  await signIn(ALI)
  seedTasks()

  open(999)

  expect(await screen.findByRole("heading", { level: 1, name: "Vazifa topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu vazifa o'chirilgan yoki sizning kompaniyangizniki emas.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Vazifalar" })).toHaveAttribute("href", "/tasks")
})

test("a page that did not load says why and offers to try again", async () => {
  await signIn(ALI)
  const { call } = seedTasks()
  server.use(
    http.get("*/api/app/orders/:id", () => HttpResponse.json({ error: "internal_error", message: "Vazifa yuklanmadi: ichki xatolik" }, { status: 500 })),
  )
  const { user } = open(call.id)

  expect(await screen.findByRole("alert")).toHaveTextContent("Vazifa yuklanmadi: ichki xatolik")

  server.resetHandlers()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeInTheDocument()
})

test("the task is deleted after asking, and the list is where one lands", async () => {
  await signIn(ALI)
  const { call } = seedTasks()
  const { user } = open(call.id)
  await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })

  await user.click(screen.getByRole("button", { name: "Vazifani o'chirish" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Vazifani o'chirasizmi?" })
  expect(within(confirm).getByText("«Qo'ng'iroq qilish» vazifalar ro'yxatidan olib tashlanadi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Vazifa o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/tasks"))
  expect(moved()).toBe("back")
  expect(db.tasks.find((task) => task.id === call.id)?.deleted).toBe(true)
})

test("a deletion the API refuses says why and keeps the task", async () => {
  await signIn(ALI)
  const { call } = seedTasks()
  server.use(http.delete("*/api/app/orders/:id", () => HttpResponse.json({ error: "conflict", message: "Vazifani hozir o'chirib bo'lmaydi" }, { status: 409 })))
  const { user } = open(call.id)
  await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })

  await user.click(screen.getByRole("button", { name: "Vazifani o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Vazifani hozir o'chirib bo'lmaydi")).toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
  expect(db.tasks.find((task) => task.id === call.id)?.deleted).toBeUndefined()
})

test("an employee whose role holds orders.view alone sees the task without a way to change it, move it or see its history", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view", "customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { call } = seedTasks()
  open(call.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeInTheDocument()
  await info()
  expect(screen.queryByRole("button", { name: "Tahrirlash" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Vazifani o'chirish" })).not.toBeInTheDocument()
  // The stages are shown, not changed.
  expect(within(stageTrack()).getAllByRole("radio").every((radio) => (radio as HTMLButtonElement).disabled)).toBe(true)
  expect(screen.queryByRole("heading", { name: "Tarix" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("the task's actions follow the role: editing and moving here, with the history; not deleting", async () => {
  giveRole(VALI, 1, "Operator", ["orders.view", "orders.edit", "orders.history"])
  await signIn(VALI)
  await chooseCompany(1)
  const { call } = seedTasks()
  open(call.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeInTheDocument()
  await info()
  expect(screen.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument()
  expect(within(stageTrack()).getByRole("radio", { name: "Jarayonda" })).toBeEnabled()
  expect(screen.queryByRole("button", { name: "Vazifani o'chirish" })).not.toBeInTheDocument()
  expect(await screen.findByRole("heading", { name: "Tarix" })).toBeInTheDocument()
})

test("with two or more locations the page says the task's; with one there is nothing to say", async () => {
  await signIn(ALI)
  const { call } = seedTasks()
  const first = open(call.id)
  expect(pairsOf(await info()).map(([name]) => name)).not.toContain("Lokatsiya")
  first.unmount()

  const chilonzor = addLocation(1, "Chilonzor")
  call.locationId = chilonzor.id
  open(call.id)

  await waitFor(() => expect(pairsOf(screen.getByRole("region", { name: "Ma'lumot" }))).toContainEqual(["Lokatsiya", "Chilonzor"]))
})
