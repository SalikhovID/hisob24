import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { formatDate } from "@/lib/format"
import { addDays, ALI, db, localToday, nextId, seedOrders, stagesOf, VALI } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { giveRole } from "@/test/roles"
import { choose } from "@/test/select"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { ghostClass } from "./order-card"
import { OrdersPage } from "./orders-page"

const board = () => screen.findByRole("region", { name: "Kanban" })
// column is a stage's column of the board; cards are the titles of the
// orders in it, in order.
const column = (name: string) => within(screen.getByRole("region", { name: "Kanban" })).getByRole("region", { name })
const cards = (name: string) =>
  within(column(name))
    .queryAllByRole("listitem")
    .map((card) => card.querySelector('[data-slot="card-title"]')?.textContent)

const today = localToday()
// due writes a card's deadline: the day and the month, and how far it is.
const due = (days: number, relative: string) => `${formatDate(addDays(today, days)).slice(0, 5)} · ${relative}`

test("the board shows a column per stage, in order, with the orders due soonest first; the done column is folded", async () => {
  await signIn(ALI)
  const { bajarildi, call, dilshod } = seedOrders()
  setLocation("/orders")

  renderWithProviders(<OrdersPage />)

  const columns = within(await board()).getAllByRole("region")
  expect(columns.map((region) => region.getAttribute("aria-label"))).toEqual(["Yangi", "Jarayonda", "Bajarildi"])
  await waitFor(() => expect(cards("Yangi")).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))
  expect(cards("Jarayonda")).toEqual(["Shartnoma yuborish"])
  // The count of each column, and of the company.
  expect(within(column("Yangi")).getByText("2", { selector: "[data-slot=column-count]" })).toBeInTheDocument()
  expect(within(column("Jarayonda")).getByText("1", { selector: "[data-slot=column-count]" })).toBeInTheDocument()
  expect(within(column("Yangi")).getByText("Jami: 2")).toBeInTheDocument()
  expect(await screen.findByText("4 ta")).toBeInTheDocument()
  // The done column is folded: its name and count on a button, no cards.
  const folded = within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (1)" })
  expect(folded).toHaveAttribute("aria-expanded", "false")
  expect(cards("Bajarildi")).toEqual([])

  // A card is the way into its order: the title, the customer, the deadline,
  // the assignee and, under every type, the type.
  const [, card] = within(column("Yangi")).getAllByRole("listitem")
  const link = within(card).getByRole("link")
  expect(link).toHaveAttribute("href", `/orders/${call.id}`)
  expect(within(link).getByText("Dilshod Karimov")).toBeInTheDocument()
  expect(within(link).getByText(due(3, "3 kun qoldi"))).toBeInTheDocument()
  expect(within(link).getByText("Vali A.")).toBeInTheDocument()
  expect(within(link).getByText("Montaj")).toBeInTheDocument()
  expect(within(card).getByRole("button", { name: "Bosqich: Qo'ng'iroq qilish" })).toBeInTheDocument()
  expect(within(card).queryByText(String(dilshod.id))).not.toBeInTheDocument()
  // A late order's deadline is red.
  const [late] = within(column("Yangi")).getAllByRole("listitem")
  expect(within(late).getByText(due(-2, "2 kun kechikdi"))).toHaveClass("text-destructive")
  // Each column has a way to add an order into it; the board says how a card is moved.
  expect(within(column("Jarayonda")).getByRole("button", { name: "Vazifa qo'shish: Jarayonda" })).toBeInTheDocument()
  expect(screen.getByText("Kartani bosib turing va boshqa ustunga suring yoki ⋯ orqali bosqichni almashtiring.")).toBeInTheDocument()
  expect(bajarildi.done).toBe(true)
})

test("the done column opens and folds, and stays as it was left", async () => {
  await signIn(ALI)
  const { bajarildi } = seedOrders()
  setLocation("/orders")
  const { user, unmount } = renderWithProviders(<OrdersPage />)
  await board()
  await waitFor(() => expect(cards("Yangi")).toHaveLength(2))

  await user.click(within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (1)" }))

  await waitFor(() => expect(cards("Bajarildi")).toEqual(["Eski buyurtma"]))
  expect(within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (1)" })).toHaveAttribute("aria-expanded", "true")
  // In the done stage a deadline says it is done.
  expect(within(column("Bajarildi")).getByText(due(-5, "bajarildi"))).toBeInTheDocument()
  expect(within(column("Bajarildi")).queryByText(/kechikdi/)).not.toBeInTheDocument()
  expect(JSON.parse(localStorage.getItem(`orders_board_open:1:${ALI}`)!)).toEqual([String(bajarildi.id)])

  unmount()
  renderWithProviders(<OrdersPage />)
  await board()
  await waitFor(() => expect(cards("Bajarildi")).toEqual(["Eski buyurtma"]))

  await user.click(within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (1)" }))
  await waitFor(() => expect(cards("Bajarildi")).toEqual([]))
  expect(JSON.parse(localStorage.getItem(`orders_board_open:1:${ALI}`)!)).toEqual([])
})

test("a card's stage menu moves the order to another column, where it takes its place by its deadline", async () => {
  await signIn(ALI)
  const { invoice, jarayonda } = seedOrders()
  setLocation("/orders")
  const { user } = renderWithProviders(<OrdersPage />)
  await board()
  await waitFor(() => expect(cards("Yangi")).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))

  await user.click(screen.getByRole("button", { name: "Bosqich: Hisob-faktura" }))
  // The stages, in a sheet named by the order.
  expect(await screen.findByRole("dialog", { name: "«Hisob-faktura» bosqichi" })).toBeInTheDocument()
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
  expect(db.orders.find((order) => order.id === invoice.id)?.stageId).toBe(jarayonda.id)
  expect(screen.getByRole("status", { name: "Ko'chirishlar" })).toHaveTextContent("«Hisob-faktura» «Jarayonda» bosqichiga ko'chirildi")
  // The location still has four orders.
  expect(screen.getByText("4 ta")).toBeInTheDocument()
})

test("a move the API refuses puts the card back and says why; the stages are asked for again", async () => {
  await signIn(ALI)
  seedOrders()
  setLocation("/orders")
  let stagesAsked = 0
  server.use(
    http.get("*/api/app/order-stages", () => {
      stagesAsked += 1
      return HttpResponse.json(stagesOf(1))
    }),
    http.patch("*/api/app/orders/:id/stage", () =>
      HttpResponse.json({ error: "validation_error", message: "Bosqichni tanlang" }, { status: 400 }),
    ),
  )
  const { user } = renderWithProviders(<OrdersPage />)
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

// many enters n more orders into Yangi, due after the seed's.
function many(n: number) {
  const { call } = seedOrders()
  for (let i = 0; i < n; i += 1) {
    db.orders.push({ ...call, id: nextId(), title: `Vazifa ${String(i).padStart(2, "0")}`, deadline: addDays(today, 10), values: { ...call.values } })
  }
}

test("a column shows twenty orders and offers more; Jami says how many there are", async () => {
  await signIn(ALI)
  many(21)
  setLocation("/orders")
  const { user } = renderWithProviders(<OrdersPage />)
  await board()

  await waitFor(() => expect(cards("Yangi")).toHaveLength(20))
  expect(within(column("Yangi")).getByText("Jami: 23")).toBeInTheDocument()
  expect(cards("Yangi").slice(-2)).toEqual(["Vazifa 16", "Vazifa 17"])
  expect(within(column("Jarayonda")).queryByRole("button", { name: "Yana" })).not.toBeInTheDocument()

  await user.click(within(column("Yangi")).getByRole("button", { name: "Yana" }))

  await waitFor(() => expect(cards("Yangi")).toHaveLength(23))
  expect(cards("Yangi").slice(-1)).toEqual(["Vazifa 20"])
  expect(within(column("Yangi")).queryByRole("button", { name: "Yana" })).not.toBeInTheDocument()
  expect(await screen.findByText("25 ta")).toBeInTheDocument()
})

test("the type chip, the search and the assignee narrow every column", async () => {
  await signIn(ALI)
  seedOrders()
  setLocation("/orders")
  const { user } = renderWithProviders(<OrdersPage />)
  await board()
  await waitFor(() => expect(cards("Yangi")).toHaveLength(2))

  await user.click(screen.getByRole("radio", { name: "Montaj" }))
  await waitFor(() => expect(cards("Jarayonda")).toEqual([]))
  expect(cards("Yangi")).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"])
  expect(within(column("Jarayonda")).getByText("Kartani shu yerga suring")).toBeInTheDocument()
  // Under a type the type is not said on every card, and the count is not the location's.
  expect(within(column("Yangi")).queryByText("Montaj")).not.toBeInTheDocument()
  expect(screen.queryByText("4 ta")).not.toBeInTheDocument()

  await user.click(screen.getByRole("radio", { name: "Barchasi" }))
  await user.type(screen.getByRole("searchbox", { name: "Qidirish" }), "shartnoma")
  await waitFor(() => expect(cards("Yangi")).toEqual([]))
  expect(cards("Jarayonda")).toEqual(["Shartnoma yuborish"])

  await user.clear(screen.getByRole("searchbox", { name: "Qidirish" }))
  await choose(user, await screen.findByRole("button", { name: "Barcha mas'ullar" }), "Vali Aliyev")
  await waitFor(() => expect(cards("Yangi")).toEqual(["Qo'ng'iroq qilish"]))
  expect(cards("Jarayonda")).toEqual([])
})

test("a board with no orders says so in every column", async () => {
  await signIn(ALI)
  setLocation("/orders")

  renderWithProviders(<OrdersPage />)

  await board()
  // A column with no card is where one may be dragged.
  await waitFor(() => expect(within(column("Yangi")).getByText("Kartani shu yerga suring")).toBeInTheDocument())
  expect(within(column("Jarayonda")).getByText("Kartani shu yerga suring")).toBeInTheDocument()
  expect(within(column("Bajarildi")).getByRole("button", { name: "Bajarildi (0)" })).toBeInTheDocument()
  expect(await screen.findByText("0 ta")).toBeInTheDocument()
})

test("an employee whose role holds orders.view alone sees the board without the stage menus or a way to add", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  seedOrders()
  setLocation("/orders")
  renderWithProviders(<OrdersPage />)

  await board()
  await waitFor(() => expect(cards("Yangi")).toEqual(["Hisob-faktura", "Qo'ng'iroq qilish"]))
  expect(screen.queryByRole("button", { name: /^Bosqich: / })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: /^Vazifa qo'shish/ })).not.toBeInTheDocument()
  expect(screen.queryByText(/Kartani bosib turing/)).not.toBeInTheDocument()
})

test("the board is the prototype's glass: a column a faint glass with a white rim, a card frosted glass, the dragged copy a sheet's glass lifted high", async () => {
  await signIn(ALI)
  seedOrders()
  setLocation("/orders")

  renderWithProviders(<OrdersPage />)

  await board()
  await waitFor(() => expect(cards("Yangi")).toHaveLength(2))
  expect(column("Yangi")).toHaveClass("bg-(--col)", "shadow-(--rim)", "rounded-[28px]")
  expect(column("Yangi")).not.toHaveClass("bg-muted")
  const [card] = within(column("Yangi")).getAllByRole("listitem")
  expect(card).toHaveClass("surface", "rounded-[20px]")
  expect(card).not.toHaveClass("bg-card")
  expect(ghostClass.split(" ")).toEqual(expect.arrayContaining(["rounded-[20px]", "bg-sheet-cell", "backdrop-blur-[20px]", "shadow-[var(--rim),0_22px_46px_rgba(60,40,120,.22)]"]))
})

test("on a wide screen the board stays in the page's column, its columns 300px wide, as the prototype's web view", async () => {
  await signIn(ALI)
  seedOrders()
  setLocation("/orders")

  renderWithProviders(<OrdersPage />)

  const kanban = await board()
  await waitFor(() => expect(cards("Yangi")).toHaveLength(2))
  expect(kanban).toHaveClass("md:mx-0", "md:px-0", "md:scroll-px-0")
  expect(kanban).not.toHaveClass("md:-mx-6")
  expect(column("Yangi")).toHaveClass("md:w-[300px]")
})
