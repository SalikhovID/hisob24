import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { formatDate } from "@/lib/format"
import { addDays, ALI, db, localToday, seedTasks, VALI } from "@/mocks/data"
import { addLocation } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { choose, optionsOf } from "@/test/select"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { TaskPage } from "./task-page"

// open puts the test on a task's page.
function open(id: number) {
  setLocation(`/tasks/${id}`, { id: String(id) })
  return renderWithProviders(<TaskPage id={id} />)
}

// pairsOf reads a list of names and values as [name, value] of each line.
const pairsOf = (region: HTMLElement) =>
  Array.from(region.querySelectorAll("dt")).map((term) => [term.textContent, term.nextElementSibling?.textContent ?? null])

const info = () => screen.findByRole("region", { name: "Ma'lumot" })
const today = localToday()
const due = (days: number, relative: string | null) =>
  relative === null ? formatDate(addDays(today, days)) : `${formatDate(addDays(today, days))} · ${relative}`

test("a task's page shows what it is, its customer, every field of its type in order, and who entered it; the owner sees its history", async () => {
  await signIn(ALI)
  const { call, dilshod } = seedTasks()

  open(call.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeInTheDocument()
  expect(screen.getByText(/Buyurtma · Yangi/)).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Vazifalar" })).toHaveAttribute("href", "/tasks")
  const customer = screen.getByRole("region", { name: "Mijoz" })
  expect(within(customer).getByRole("link", { name: "Dilshod Karimov" })).toHaveAttribute("href", `/customers/${dilshod.id}`)
  await waitFor(() => expect(within(customer).getByText("Jismoniy · +998 91 111 22 33")).toBeInTheDocument())
  expect(pairsOf(await info())).toEqual([
    ["Nomi", "Qo'ng'iroq qilish"],
    ["Muddat", due(3, "3 kun qoldi")],
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

test("a late task's deadline is marked on its page; a task with nobody assigned and no answers shows dashes", async () => {
  await signIn(ALI)
  const { invoice, contract } = seedTasks()
  const { unmount } = open(invoice.id)

  await screen.findByRole("heading", { level: 1, name: "Hisob-faktura" })
  expect(screen.getAllByText("2 kun kechikdi")[0].closest("[data-slot=deadline]")).toHaveClass("text-destructive")

  unmount()
  open(contract.id)
  await screen.findByRole("heading", { level: 1, name: "Shartnoma yuborish" })
  expect(pairsOf(await info())).toEqual([
    ["Nomi", "Shartnoma yuborish"],
    ["Muddat", due(0, "Bugun")],
    ["Bosqich", "Jarayonda"],
    ["Mas'ul", "—"],
    ["Qo'shgan", "Vali Aliyev"],
    ["Qo'shilgan", "02.10.2026"],
  ])
})

test("the stage is changed from the page at once", async () => {
  await signIn(ALI)
  const { call, bajarildi } = seedTasks()
  const { user } = open(call.id)
  await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })
  const stage = screen.getByRole("combobox", { name: "Bosqich" })
  expect(stage).toHaveTextContent("Yangi")
  expect(await optionsOf(user, stage)).toEqual(["Yangi", "Jarayonda", "Bajarildi"])

  await choose(user, stage, "Bajarildi")

  expect(await screen.findByText("Bosqich o'zgartirildi")).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText(/Buyurtma · Bajarildi/)).toBeInTheDocument())
  expect(db.tasks.find((task) => task.id === call.id)?.stageId).toBe(bajarildi.id)
  // In the done stage the deadline is the day alone.
  expect(pairsOf(await info())[1]).toEqual(["Muddat", due(3, null)])
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
    http.get("*/api/app/tasks/:id", () => HttpResponse.json({ error: "internal_error", message: "Vazifa yuklanmadi: ichki xatolik" }, { status: 500 })),
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

  await user.click(screen.getByRole("button", { name: "O'chirish" }))
  const confirm = await screen.findByRole("alertdialog", { name: "Vazifani o'chirasizmi?" })
  expect(within(confirm).getByText("«Qo'ng'iroq qilish» vazifalar ro'yxatidan olib tashlanadi. Qayta tiklab bo'lmaydi.")).toBeInTheDocument()
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Vazifa o'chirildi")).toBeInTheDocument()
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/tasks"))
  expect(db.tasks.find((task) => task.id === call.id)?.deleted).toBe(true)
})

test("a deletion the API refuses says why and keeps the task", async () => {
  await signIn(ALI)
  const { call } = seedTasks()
  server.use(http.delete("*/api/app/tasks/:id", () => HttpResponse.json({ error: "conflict", message: "Vazifani hozir o'chirib bo'lmaydi" }, { status: 409 })))
  const { user } = open(call.id)
  await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })

  await user.click(screen.getByRole("button", { name: "O'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Vazifani hozir o'chirib bo'lmaydi")).toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
  expect(db.tasks.find((task) => task.id === call.id)?.deleted).toBeUndefined()
})

test("an employee whose role holds tasks.view alone sees the task without a way to change it, move it or see its history", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["tasks.view", "customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { call } = seedTasks()
  open(call.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeInTheDocument()
  await info()
  expect(screen.queryByRole("button", { name: "Tahrirlash" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "O'chirish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("combobox", { name: "Bosqich" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Tarix" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

test("the task's actions follow the role: editing and moving here, with the history; not deleting", async () => {
  giveRole(VALI, 1, "Operator", ["tasks.view", "tasks.edit", "tasks.history"])
  await signIn(VALI)
  await chooseCompany(1)
  const { call } = seedTasks()
  open(call.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Qo'ng'iroq qilish" })).toBeInTheDocument()
  await info()
  expect(screen.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: "Bosqich" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "O'chirish" })).not.toBeInTheDocument()
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
