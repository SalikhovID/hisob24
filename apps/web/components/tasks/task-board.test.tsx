import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { formatDate } from "@/lib/format"
import { addDays, ALI, db, localToday, nextId, seedTasks, stagesOf } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { server } from "@/test/server"
import { signIn } from "@/test/session"
import { TasksPage } from "./tasks-page"

const board = () => screen.findByRole("region", { name: "Kanban" })
// column is a stage's column of the board; cards are the titles of the
// tasks in it, in order.
const column = (name: string) => within(screen.getByRole("region", { name: "Kanban" })).getByRole("region", { name })
const cards = (name: string) =>
  within(column(name))
    .queryAllByRole("listitem")
    .map((card) => within(card).getByRole("link").textContent)

const today = localToday()
const due = (days: number, relative: string | null) =>
  relative === null ? formatDate(addDays(today, days)) : `${formatDate(addDays(today, days))} · ${relative}`

test("the board shows a column per stage, in order, with the tasks due soonest first; the done column is folded", async () => {
  await signIn(ALI)
  const { bajarildi, call, dilshod } = seedTasks()
  setLocation("/tasks")

  renderWithProviders(<TasksPage />)

  const columns = within(await board()).getAllByRole("region")
  expect(columns.map((region) => region.getAttribute("aria-label"))).toEqual(["Yangi", "Jarayonda", "Bajarildi"])
  await waitFor(() => expect(cards("Yangi")).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))
  expect(cards("Jarayonda")).toEqual(["Shartnoma yuborish"])
  // The count of each column, and of the company.
  expect(within(column("Yangi")).getByText("2", { selector: "[data-slot=column-count]" })).toBeInTheDocument()
  expect(within(column("Jarayonda")).getByText("1", { selector: "[data-slot=column-count]" })).toBeInTheDocument()
  expect(within(column("Yangi")).getByText("Jami: 2")).toBeInTheDocument()
  expect(await screen.findByText("Kompaniyangiz vazifalari · 4 ta")).toBeInTheDocument()
  // The done column is folded: its name and count on a button, no cards.
  const folded = within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (1)" })
  expect(folded).toHaveAttribute("aria-expanded", "false")
  expect(cards("Bajarildi")).toEqual([])

  // A card: the title as the way into the task, the customer, the deadline,
  // the assignee and, under every type, the type.
  const [, card] = within(column("Yangi")).getAllByRole("listitem")
  expect(within(card).getByRole("link", { name: "Qo'ng'iroq qilish" })).toHaveAttribute("href", `/tasks/${call.id}`)
  expect(within(card).getByText("Dilshod Karimov")).toBeInTheDocument()
  expect(within(card).getByText(formatDate(addDays(today, 3)))).toBeInTheDocument()
  expect(within(card).getByText("3 kun qoldi")).toBeInTheDocument()
  expect(within(card).getByText("Vali Aliyev")).toBeInTheDocument()
  expect(within(card).getByText("Buyurtma")).toBeInTheDocument()
  expect(within(card).getByRole("button", { name: "Bosqich: Qo'ng'iroq qilish" })).toBeInTheDocument()
  expect(within(card).queryByText(String(dilshod.id))).not.toBeInTheDocument()
  // A late task's deadline is marked.
  const [late] = within(column("Yangi")).getAllByRole("listitem")
  expect(within(late).getByText("2 kun kechikdi").closest("[data-slot=deadline]")).toHaveClass("text-destructive")
  // Each column has a way to add a task into it.
  expect(within(column("Jarayonda")).getByRole("button", { name: "Vazifa qo'shish: Jarayonda" })).toBeInTheDocument()
  expect(bajarildi.done).toBe(true)
})

test("the done column opens and folds, and stays as it was left", async () => {
  await signIn(ALI)
  const { bajarildi } = seedTasks()
  setLocation("/tasks")
  const { user, unmount } = renderWithProviders(<TasksPage />)
  await board()
  await waitFor(() => expect(cards("Yangi")).toHaveLength(2))

  await user.click(within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (1)" }))

  await waitFor(() => expect(cards("Bajarildi")).toEqual(["Eski buyurtma"]))
  expect(within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (1)" })).toHaveAttribute("aria-expanded", "true")
  // In the done stage a deadline is the day alone.
  expect(within(column("Bajarildi")).getByText(due(-5, null))).toBeInTheDocument()
  expect(within(column("Bajarildi")).queryByText(/kechikdi/)).not.toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem(`tasks_board_open:1:${ALI}`)!)).toEqual([String(bajarildi.id)])

  unmount()
  renderWithProviders(<TasksPage />)
  await board()
  await waitFor(() => expect(cards("Bajarildi")).toEqual(["Eski buyurtma"]))

  await user.click(within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (1)" }))
  await waitFor(() => expect(cards("Bajarildi")).toEqual([]))
  expect(JSON.parse(localStorage.getItem(`tasks_board_open:1:${ALI}`)!)).toEqual([])
})

test("a card's stage menu moves the task to another column, where it takes its place by its deadline", async () => {
  await signIn(ALI)
  const { invoice, jarayonda } = seedTasks()
  setLocation("/tasks")
  const { user } = renderWithProviders(<TasksPage />)
  await board()
  await waitFor(() => expect(cards("Yangi")).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))

  await user.click(screen.getByRole("button", { name: "Bosqich: Hisob-faktura" }))
  const menu = await screen.findByRole("menu")
  expect(within(menu).getAllByRole("menuitemradio").map((item) => [item.textContent, item.getAttribute("aria-checked")])).toEqual([
    ["Yangi", "true"],
    ["Jarayonda", "false"],
    ["Bajarildi", "false"],
  ])
  await user.click(within(menu).getByRole("menuitemradio", { name: "Jarayonda" }))

  await waitFor(() => expect(cards("Jarayonda")).toEqual(["Hisob-faktura", "Shartnoma yuborish"]))
  expect(cards("Yangi")).toEqual(["Qo'ng'iroq qilish"])
  expect(within(column("Yangi")).getByText("Jami: 1")).toBeInTheDocument()
  expect(within(column("Jarayonda")).getByText("Jami: 2")).toBeInTheDocument()
  expect(db.tasks.find((task) => task.id === invoice.id)?.stageId).toBe(jarayonda.id)
  expect(screen.getByRole("status", { name: "Ko'chirishlar" })).toHaveTextContent("«Hisob-faktura» «Jarayonda» bosqichiga ko'chirildi")
  // The company still has four tasks.
  expect(screen.getByText("Kompaniyangiz vazifalari · 4 ta")).toBeInTheDocument()
})

test("a move the API refuses puts the card back and says why; the stages are asked for again", async () => {
  await signIn(ALI)
  seedTasks()
  setLocation("/tasks")
  let stagesAsked = 0
  server.use(
    http.get("*/api/app/task-stages", () => {
      stagesAsked += 1
      return HttpResponse.json(stagesOf(1))
    }),
    http.patch("*/api/app/tasks/:id/stage", () =>
      HttpResponse.json({ error: "validation_error", message: "Bosqichni tanlang" }, { status: 400 }),
    ),
  )
  const { user } = renderWithProviders(<TasksPage />)
  await board()
  await waitFor(() => expect(cards("Yangi")).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))
  const askedBefore = stagesAsked

  await user.click(screen.getByRole("button", { name: "Bosqich: Hisob-faktura" }))
  await user.click(within(await screen.findByRole("menu")).getByRole("menuitemradio", { name: "Bajarildi" }))

  expect(await screen.findByText("Bosqichni tanlang")).toBeInTheDocument()
  await waitFor(() => expect(cards("Yangi")).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))
  expect(within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (1)" })).toBeInTheDocument()
  await waitFor(() => expect(stagesAsked).toBeGreaterThan(askedBefore))
})

// many enters n more tasks into Yangi, due after the seed's.
function many(n: number) {
  const { call } = seedTasks()
  for (let i = 0; i < n; i += 1) {
    db.tasks.push({ ...call, id: nextId(), title: `Vazifa ${String(i).padStart(2, "0")}`, deadline: addDays(today, 10), values: { ...call.values } })
  }
}

test("a column shows twenty tasks and offers more; Jami says how many there are", async () => {
  await signIn(ALI)
  many(21)
  setLocation("/tasks")
  const { user } = renderWithProviders(<TasksPage />)
  await board()

  await waitFor(() => expect(cards("Yangi")).toHaveLength(20))
  expect(within(column("Yangi")).getByText("Jami: 23")).toBeInTheDocument()
  expect(cards("Yangi").slice(-2)).toEqual(["Vazifa 16", "Vazifa 17"])
  expect(within(column("Jarayonda")).queryByRole("button", { name: "Yana" })).not.toBeInTheDocument()

  await user.click(within(column("Yangi")).getByRole("button", { name: "Yana" }))

  await waitFor(() => expect(cards("Yangi")).toHaveLength(23))
  expect(cards("Yangi").slice(-1)).toEqual(["Vazifa 20"])
  expect(within(column("Yangi")).queryByRole("button", { name: "Yana" })).not.toBeInTheDocument()
  expect(await screen.findByText("Kompaniyangiz vazifalari · 25 ta")).toBeInTheDocument()
})

test("the type tab, the search and the assignee narrow every column", async () => {
  await signIn(ALI)
  seedTasks()
  setLocation("/tasks")
  const { user } = renderWithProviders(<TasksPage />)
  await board()
  await waitFor(() => expect(cards("Yangi")).toHaveLength(2))

  await user.click(screen.getByRole("tab", { name: "Buyurtma" }))
  await waitFor(() => expect(cards("Jarayonda")).toEqual([]))
  expect(cards("Yangi")).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"])
  expect(within(column("Jarayonda")).getByText("Vazifa yo'q")).toBeInTheDocument()
  // Under a tab the type is not said on every card.
  expect(within(column("Yangi")).queryByText("Buyurtma")).not.toBeInTheDocument()
  expect(screen.getByText("Kompaniyangiz vazifalari")).toBeInTheDocument()

  await user.click(screen.getByRole("tab", { name: "Barchasi" }))
  await user.type(screen.getByRole("searchbox", { name: "Qidirish" }), "shartnoma")
  await waitFor(() => expect(cards("Yangi")).toEqual([]))
  expect(cards("Jarayonda")).toEqual(["Shartnoma yuborish"])

  await user.clear(screen.getByRole("searchbox", { name: "Qidirish" }))
  await choose(user, await screen.findByRole("combobox", { name: "Mas'ul" }), "Vali Aliyev")
  await waitFor(() => expect(cards("Yangi")).toEqual(["Qo'ng'iroq qilish"]))
  expect(cards("Jarayonda")).toEqual([])
})

test("a board with no tasks says so in every column", async () => {
  await signIn(ALI)
  setLocation("/tasks")

  renderWithProviders(<TasksPage />)

  await board()
  await waitFor(() => expect(within(column("Yangi")).getByText("Vazifa yo'q")).toBeInTheDocument())
  expect(within(column("Jarayonda")).getByText("Vazifa yo'q")).toBeInTheDocument()
  expect(within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (0)" })).toBeInTheDocument()
  expect(await screen.findByText("Kompaniyangiz vazifalari · 0 ta")).toBeInTheDocument()
})
