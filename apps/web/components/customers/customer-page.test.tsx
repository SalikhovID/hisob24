import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test, vi } from "vitest"
import { api, call } from "@/lib/api"
import { formatDate } from "@/lib/format"
import { keep } from "@/lib/use-kept"
import { addDays, ALI, db, localToday, seedCatalog, seedCustomers, seedSixKinds, seedTasks, seedWarehouse, typesOf, VALI } from "@/mocks/data"
import { addLocation, asosiyOf } from "@/test/locations"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { rowParts } from "@/test/rows"
import { giveRole } from "@/test/roles"
import { choose, optionsOf } from "@/test/select"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { enterSale } from "@/test/stock"
import { CustomerPage } from "./customer-page"
import { moved } from "@/test/moves"

// open puts the test on a customer's page.
function open(id: number) {
  setLocation(`/customers/${id}`, { id: String(id) })
  return renderWithProviders(<CustomerPage id={id} />)
}

// pairsOf reads a list of names and values as [name, value] of each line.
const pairsOf = (region: HTMLElement) =>
  Array.from(region.querySelectorAll("dt")).map((term) => [term.textContent, term.nextElementSibling?.textContent ?? null])

const info = () => screen.findByRole("region", { name: "Ma'lumot" })

// figure is the balance as it reads: its label, then the amount.
const figure = (balance: HTMLElement) => balance.querySelector("[data-slot=hero]")?.textContent?.replace(/\s+/g, " ").trim()

test("a customer's page shows who it is, every field of its type in order, and who entered it", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  seedSixKinds()

  open(dilshod.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeInTheDocument()
  expect(screen.getByText("Jismoniy · +998 91 111 22 33")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Mijozlar" })).toHaveAttribute("href", "/customers")
  expect(pairsOf(await info())).toEqual([
    ["Telefon", "+998 91 111 22 33"],
    ["F.I.Sh.", "Dilshod Karimov"],
    ["Manba", "Instagram"],
    // The fields left empty are there too, with a dash.
    ["Yoshi", "—"],
    ["Jinsi", "—"],
    ["Tillar", "—"],
    ["Kanallar", "—"],
    ["Qo'shgan", "Vali Aliyev"],
    ["Qo'shilgan", "02.10.2026"],
  ])
})

test("an option that was turned off since is still the customer's answer", async () => {
  await signIn(ALI)
  const { malika } = seedCustomers()

  open(malika.id)

  expect(within(await info()).getByText("YouTube")).toBeInTheDocument()
})

test("a customer with no name goes by the phone, which is then not said again under it", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  dilshod.values = {}

  open(dilshod.id)

  expect(await screen.findByRole("heading", { level: 1, name: "+998 91 111 22 33" })).toBeInTheDocument()
  expect(screen.getByText("Jismoniy")).toBeInTheDocument()
  expect(screen.queryByText("Jismoniy · +998 91 111 22 33")).not.toBeInTheDocument()
})

test("a customer that is not there, or is another company's, is said to be not found, with the way back", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { dilshod } = seedCustomers()
  const { unmount } = open(999)

  expect(await screen.findByRole("heading", { level: 1, name: "Mijoz topilmadi" })).toBeInTheDocument()
  expect(screen.getByText("Bu mijoz o'chirilgan yoki sizning kompaniyangizniki emas.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "Mijozlar" })).toHaveAttribute("href", "/customers")
  expect(screen.queryByRole("region", { name: "Ma'lumot" })).not.toBeInTheDocument()
  unmount()

  // Vali's own company has no such customer.
  await chooseCompany(2)
  open(dilshod.id)
  expect(await screen.findByRole("heading", { level: 1, name: "Mijoz topilmadi" })).toBeInTheDocument()
})

test("while the customer loads the page holds its place; a failed load says why and tries again", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  server.use(
    http.get("*/api/app/customers/:id", () =>
      HttpResponse.json({ error: "internal_error", message: "Mijoz yuklanmadi: ichki xatolik" }, { status: 500 }),
    ),
  )
  const { user } = open(dilshod.id)

  expect(screen.getByRole("heading", { level: 1, name: "Mijoz" })).toBeInTheDocument()
  expect(screen.getByLabelText("Yuklanmoqda")).toBeInTheDocument()
  expect(await screen.findByRole("alert")).toHaveTextContent("Mijoz yuklanmadi: ichki xatolik")

  server.resetHandlers()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(await screen.findByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeInTheDocument()
})

// edit opens the dialog that edits the customer on screen.
async function edit(user: ReturnType<typeof open>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Tahrirlash" }))
  return screen.findByRole("dialog", { name: "Mijozni tahrirlash" })
}

test("an employee edits the customer in a dialog that opens with its phone and answers", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { dilshod } = seedCustomers()
  const { user } = open(dilshod.id)

  const dialog = await edit(user)

  // The type was chosen when the customer was entered: it is not asked again.
  expect(within(dialog).queryByRole("radiogroup", { name: "Mijoz turi" })).not.toBeInTheDocument()
  expect(within(dialog).getByText("Jismoniy")).toBeInTheDocument()
  expect(within(dialog).getByLabelText("Telefon raqami")).toHaveValue("91 111 22 33")
  expect(within(dialog).getByLabelText("F.I.Sh.")).toHaveValue("Dilshod Karimov")
  expect(within(dialog).getByLabelText("Manba")).toHaveTextContent("Instagram")

  await user.clear(within(dialog).getByLabelText("F.I.Sh."))
  await user.type(within(dialog).getByLabelText("F.I.Sh."), "Dilshod Karimovich")
  await choose(user, within(dialog).getByLabelText("Manba"), "LinkedIn")
  await user.clear(within(dialog).getByLabelText("Telefon raqami"))
  await user.type(within(dialog).getByLabelText("Telefon raqami"), "911112299")
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Mijoz saqlandi")).toBeInTheDocument()
  expect(await screen.findByRole("heading", { level: 1, name: "Dilshod Karimovich" })).toBeInTheDocument()
  expect(pairsOf(await info()).slice(0, 3)).toEqual([
    ["Telefon", "+998 91 111 22 99"],
    ["F.I.Sh.", "Dilshod Karimovich"],
    ["Manba", "LinkedIn"],
  ])
  expect(dilshod.phone).toBe("998911112299")
})

test("the dialog opens with the customer as it is now, whatever was typed and left before", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  const { user } = open(dilshod.id)
  let dialog = await edit(user)
  await user.type(within(dialog).getByLabelText("F.I.Sh."), " tashlab ketilgan")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  dialog = await edit(user)

  expect(within(dialog).getByLabelText("F.I.Sh.")).toHaveValue("Dilshod Karimov")
})

test("an option that is turned off is offered to the customer who has it, and to nobody else", async () => {
  await signIn(ALI)
  const { dilshod, malika } = seedCustomers()
  const youtube = db.dropdowns[0].options[2]
  const first = open(malika.id)

  let dialog = await edit(first.user)

  expect(await optionsOf(first.user, within(dialog).getByLabelText("Manba"))).toEqual(["Tanlanmagan", "Instagram", "LinkedIn", "YouTube"])
  expect(within(dialog).getByLabelText("Manba")).toHaveTextContent("YouTube")
  await first.user.clear(within(dialog).getByLabelText("F.I.Sh."))
  await first.user.type(within(dialog).getByLabelText("F.I.Sh."), "Malika Yusupova (VIP)")
  await first.user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(Object.values(malika.values)).toEqual(["Malika Yusupova (VIP)", youtube.id])
  first.unmount()

  const second = open(dilshod.id)
  dialog = await edit(second.user)
  expect(await optionsOf(second.user, within(dialog).getByLabelText("Manba"))).toEqual(["Tanlanmagan", "Instagram", "LinkedIn"])
})

test("an edit that is refused says why in the dialog, and leads to the customer who has the phone", async () => {
  await signIn(ALI)
  const { dilshod, malika } = seedCustomers()
  const { user } = open(dilshod.id)
  const dialog = await edit(user)
  await user.clear(within(dialog).getByLabelText("Telefon raqami"))
  await user.type(within(dialog).getByLabelText("Telefon raqami"), "955556677")

  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  expect(await within(dialog).findByText("Bu raqamli mijoz allaqachon bor")).toBeInTheDocument()
  expect(within(dialog).getByRole("link", { name: "Mijozni ochish" })).toHaveAttribute("href", `/customers/${malika.id}`)
  expect(dilshod.phone).toBe("998911112233")
  // What the form itself finds wrong is said under the field.
  await user.clear(within(dialog).getByLabelText("F.I.Sh."))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  expect(await within(dialog).findByText("«F.I.Sh.» maydonini to'ldiring")).toBeInTheDocument()
})

test("an employee deletes the customer after being asked, and is taken back to the list", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { dilshod } = seedCustomers()
  const { user } = open(dilshod.id)

  await user.click(await screen.findByRole("button", { name: "Mijozni o'chirish" }))
  let confirm = await screen.findByRole("alertdialog", { name: "Mijozni o'chirasizmi?" })
  expect(confirm).toHaveTextContent("Dilshod Karimov mijozlar ro'yxatidan olib tashlanadi. Qayta tiklab bo'lmaydi.")
  await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(dilshod.deleted).toBeUndefined()

  await user.click(screen.getByRole("button", { name: "Mijozni o'chirish" }))
  confirm = await screen.findByRole("alertdialog", { name: "Mijozni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/customers"))
  expect(moved()).toBe("back")
  expect(await screen.findByText("Mijoz o'chirildi")).toBeInTheDocument()
  expect(dilshod.deleted).toBe(true)
})

test("a delete that is refused says why, and the customer stays", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  server.use(
    http.delete("*/api/app/customers/:id", () =>
      HttpResponse.json({ error: "internal_error", message: "Mijoz o'chmadi: ichki xatolik" }, { status: 500 }),
    ),
  )
  const { user } = open(dilshod.id)

  await user.click(await screen.findByRole("button", { name: "Mijozni o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Mijoz o'chmadi: ichki xatolik")).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(router.replace).not.toHaveBeenCalled()
  expect(screen.getByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeInTheDocument()
})

// The history is a list of entries: who did what and when, then what changed.
const slot = (element: Element, name: string) => element.querySelector(`[data-slot="${name}"]`)?.textContent ?? null
const headOf = (entry: HTMLElement) => ["history-action", "history-actor", "history-time"].map((name) => slot(entry, name))
const changesOf = (entry: HTMLElement) =>
  Array.from(entry.querySelectorAll('[data-slot="history-change"]')).map((change) =>
    ["change-label", "change-old", "change-new"].map((name) => slot(change, name)),
  )
const history = async () => within(await screen.findByRole("list", { name: "Tarix" })).getAllByRole("listitem")

test("the owner sees what happened to the customer, the latest first: who, when, and each field before and after", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  const [fish] = typesOf(1)[0].fields
  // Ali gives Dilshod another phone and takes the source away.
  await call(
    api.PUT("/app/customers/{id}", {
      params: { path: { id: dilshod.id } },
      body: { phone: "998911112299", values: { [fish.id]: "Dilshod Karimov" } },
    }),
  )

  open(dilshod.id)

  expect(await screen.findByRole("heading", { level: 2, name: "Tarix" })).toBeInTheDocument()
  const entries = await history()
  expect(entries.map(headOf)).toEqual([
    ["Tahrirlandi", "Ali Valiyev", "02.10.2026 11:04"],
    ["Qo'shildi", "Vali Aliyev", "02.10.2026 11:01"],
  ])
  expect(changesOf(entries[0])).toEqual([
    ["Telefon", "+998 91 111 22 33", "+998 91 111 22 99"],
    // An answer that was taken away: a dash stands where it was.
    ["Manba", "Instagram", "—"],
  ])
  expect(changesOf(entries[1])).toEqual([])
})

test("an edit made on the page joins the history at once", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  const { user } = open(dilshod.id)
  expect(await history()).toHaveLength(1)
  const dialog = await edit(user)
  await user.type(within(dialog).getByLabelText("F.I.Sh."), "ovich")

  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(async () => expect(await history()).toHaveLength(2))
  expect(changesOf((await history())[0])).toEqual([["F.I.Sh.", "Dilshod Karimov", "Dilshod Karimovovich"]])
})

test("the history is the owner's: an employee is shown none, and none is asked for", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  const { dilshod } = seedCustomers()
  let asked = false
  server.use(
    http.get("*/api/app/customers/:id/history", () => {
      asked = true
      return HttpResponse.json([])
    }),
  )

  open(dilshod.id)

  expect(await info()).toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Tarix" })).not.toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Tarix" })).not.toBeInTheDocument()
  expect(asked).toBe(false)
})

test("a history that did not load says why and offers to try again", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  server.use(
    http.get("*/api/app/customers/:id/history", () =>
      HttpResponse.json({ error: "internal_error", message: "Tarix yuklanmadi: ichki xatolik" }, { status: 500 }),
    ),
  )
  const { user } = open(dilshod.id)

  expect(await screen.findByRole("alert")).toHaveTextContent("Tarix yuklanmadi: ichki xatolik")
  // The customer itself is on the page all the same.
  expect(await info()).toBeInTheDocument()

  server.resetHandlers()
  await user.click(screen.getByRole("button", { name: "Qayta urinish" }))
  expect(await history()).toHaveLength(1)
})

test("two changes of one name in an entry are both shown", async () => {
  // The owner may name a field "Telefon": an edit then changes two things of that name.
  const errors = vi.spyOn(console, "error").mockImplementation(() => {})
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  server.use(
    http.get("*/api/app/customers/:id/history", () =>
      HttpResponse.json([
        {
          id: 1,
          action: "updated",
          actor_name: "Ali Valiyev",
          created_at: "2026-10-02T06:05:00Z",
          changes: [
            { label: "Telefon", old: "+998 91 111 22 33", new: "+998 91 111 22 99" },
            { label: "Telefon", old: "", new: "71 200 00 00" },
          ],
        },
      ]),
    ),
  )

  open(dilshod.id)

  expect(changesOf((await history())[0])).toEqual([
    ["Telefon", "+998 91 111 22 33", "+998 91 111 22 99"],
    ["Telefon", "—", "71 200 00 00"],
  ])
  expect(errors).not.toHaveBeenCalled()
  errors.mockRestore()
})

// The customer's tasks, on its page (logic/tasks.md, 6).
const tasksOf = () => screen.findByRole("region", { name: "Vazifalar" })

test("a customer's page lists its tasks, the one due soonest first, with their stage and deadline, and says how many", async () => {
  await signIn(ALI)
  const { dilshod, call, old } = seedTasks()
  const today = localToday()

  open(dilshod.id)

  const region = await tasksOf()
  const rows = within(await within(region).findByRole("list", { name: "Vazifalar" })).getAllByRole("link")
  expect(rows.map((row) => rowParts(row).title)).toEqual(["Eski buyurtma", "Qo'ng'iroq qilish"])
  expect(rows[0]).toHaveAttribute("href", `/tasks/${old.id}`)
  expect(rows[1]).toHaveAttribute("href", `/tasks/${call.id}`)
  // A done task says its stage where the others say how far their deadline is.
  expect(rowParts(rows[0])).toMatchObject({ sub: "Bajarildi · Ali V.", end: `${formatDate(addDays(today, -5)).slice(0, 5)} Bajarildi` })
  expect(rowParts(rows[1])).toMatchObject({ sub: "Yangi · Vali A.", end: `${formatDate(addDays(today, 3)).slice(0, 5)} 3 kun qoldi` })
  expect(within(region).getByText("Jami: 2")).toBeInTheDocument()
})

test("a customer with no tasks says so", async () => {
  await signIn(ALI)
  const { anor } = seedCustomers()

  open(anor.id)

  expect(await within(await tasksOf()).findByText("Bu mijozda vazifa yo'q")).toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Vazifalar" })).not.toBeInTheDocument()
})

test("a customer with tasks is not deleted: the API's reason is shown, and the customer stays", async () => {
  await signIn(ALI)
  const { dilshod } = seedTasks()
  const { user } = open(dilshod.id)
  await screen.findByRole("heading", { level: 1, name: "Dilshod Karimov" })

  await user.click(screen.getByRole("button", { name: "Mijozni o'chirish" }))
  await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "O'chirish" }))

  expect(await screen.findByText("Bu mijozda 2 ta vazifa bor")).toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
  expect(db.customers.find((customer) => customer.id === dilshod.id)?.deleted).toBeUndefined()
})

test("an employee whose role holds customers.view alone sees the customer without a way to change it, its history or its tasks", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { dilshod } = seedCustomers()
  open(dilshod.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeInTheDocument()
  await info()
  expect(screen.queryByRole("button", { name: "Tahrirlash" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Mijozni o'chirish" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Tarix" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Vazifalar" })).not.toBeInTheDocument()
  // What the customer owes is the sales' business (logic/sales.md, section 5).
  expect(screen.queryByRole("region", { name: "Balans" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Hisob harakati" })).not.toBeInTheDocument()
  expect(router.replace).not.toHaveBeenCalled()
})

// sold enters Dilshod's sale of 4 Olma at 3 000, 5 000 paid with it: 7 000 owed.
async function sold(dilshod: { id: number }, catalog: ReturnType<typeof seedCatalog>) {
  const cash = db.accounts[1][0].id
  return enterSale({ location_id: asosiyOf(1).id, customer_id: dilshod.id, at: "2026-10-05T09:00:00+05:00", items: [{ product_id: catalog.olma.id, quantity: "4", price: "3000" }], payments: [{ bank_account_id: cash, amount: "5000" }] })
}

test("the owner sees what the customer owes and their statement, with the sale and its payment, and may add a payment or an opening balance", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const { dilshod } = seedCustomers()
  await signIn(ALI)
  const sale = await sold(dilshod, catalog)
  open(dilshod.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeInTheDocument()
  const balance = await screen.findByRole("region", { name: "Balans" })
  expect(figure(balance)).toBe("Qarz 7 000 so'm")
  const statement = await screen.findByRole("region", { name: "Hisob harakati" })
  // The sale, and the payment entered with it, each lead to the sale.
  const links = within(statement).getAllByRole("link", { name: /Sotuv № 1/ })
  expect(links).toHaveLength(2)
  expect(links[0]).toHaveAttribute("href", `/sales/${sale.id}`)
  // A payment is the page's tile; an opening balance the statement's heading.
  expect(within(screen.getByRole("group", { name: "Amallar" })).getByRole("button", { name: "To'lov" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Boshlang'ich" })).toBeInTheDocument()
})

test("whoever may see the sales alone sees the balance and the statement, with no way to add to them", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const { dilshod } = seedCustomers()
  // The owner enters the sale; the watcher looks at it.
  await signIn(ALI)
  await sold(dilshod, catalog)
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view", "sales.view"])
  db.cooldown = false
  await signIn(VALI)
  await chooseCompany(1)
  open(dilshod.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeInTheDocument()
  expect(figure(await screen.findByRole("region", { name: "Balans" }))).toBe("Qarz 7 000 so'm")
  expect(await screen.findByRole("region", { name: "Hisob harakati" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Boshlang'ich" })).not.toBeInTheDocument()
  expect(within(screen.getByRole("group", { name: "Amallar" })).queryByRole("button", { name: "To'lov" })).not.toBeInTheDocument()
})

test("a payment from the customer is entered from its «To'lov» tile: the sheet is the customer's, what they owe under the amount", async () => {
  const catalog = seedCatalog()
  seedWarehouse(catalog)
  const { dilshod } = seedCustomers()
  await signIn(ALI)
  await sold(dilshod, catalog)
  const { user } = open(dilshod.id)

  await user.click(within(await screen.findByRole("group", { name: "Amallar" })).getByRole("button", { name: "To'lov" }))

  const dialog = await screen.findByRole("dialog", { name: "To'lov qo'shish" })
  expect(within(dialog).getByText("Dilshod Karimov")).toBeInTheDocument()
  expect(within(dialog).getByText(/Qarz: 7 000 so'm/)).toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "To'liq" }))
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))
  await waitFor(() =>
    expect(db.transactions.find((t) => t.kind === "customer_payment" && t.customerId === dilshod.id && t.linkedId === null)).toMatchObject({ total: 7000 }),
  )
})

test("the customer's actions follow the role: editing, the history and the tasks here; not deleting", async () => {
  giveRole(VALI, 1, "Sotuvchi", ["customers.view", "customers.edit", "customers.history", "orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { dilshod } = seedTasks()
  open(dilshod.id)

  expect(await screen.findByRole("heading", { level: 1, name: "Dilshod Karimov" })).toBeInTheDocument()
  await info()
  expect(screen.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Mijozni o'chirish" })).not.toBeInTheDocument()
  expect(await screen.findByRole("heading", { name: "Tarix" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Vazifalar" })).toBeInTheDocument()
})

// A customer's tasks are those of every location the member works in,
// whatever the current one (logic/locations.md, section 6).
test("a customer's tasks are of every location the member works in; with two or more locations each says its own", async () => {
  await signIn(ALI)
  const { dilshod, call } = seedTasks()
  const chilonzor = addLocation(1, "Chilonzor")
  call.locationId = chilonzor.id
  keep(`location:1:${ALI}`, String(asosiyOf(1).id))

  open(dilshod.id)

  const rows = within(await within(await tasksOf()).findByRole("list", { name: "Vazifalar" })).getAllByRole("link")
  expect(rows.map((row) => [rowParts(row).title, rowParts(row).sub])).toEqual([
    ["Eski buyurtma", "Bajarildi · Asosiy · Ali V."],
    ["Qo'ng'iroq qilish", "Yangi · Chilonzor · Vali A."],
  ])
})

test("the customer's tiles: editing for whoever may, and the call to its phone", async () => {
  await signIn(ALI)
  const { dilshod } = seedCustomers()
  open(dilshod.id)

  const tiles = within(await screen.findByRole("group", { name: "Amallar" }))
  expect(tiles.getByRole("button", { name: "Tahrirlash" })).toBeInTheDocument()
  expect(tiles.getByRole("link", { name: "Qo'ng'iroq" })).toHaveAttribute("href", "tel:+998911112233")
})

test("the customer's Vazifa tile enters a task for it: the sheet opens with the customer as its card", async () => {
  await signIn(ALI)
  const { dilshod } = seedTasks()
  const { user } = open(dilshod.id)

  await user.click(within(await screen.findByRole("group", { name: "Amallar" })).getByRole("button", { name: "Vazifa" }))

  const dialog = await screen.findByRole("dialog", { name: "Vazifa qo'shish" })
  const linked = within(dialog).getByRole("region", { name: "Mavjud mijoz" })
  expect(within(linked).getByText("Dilshod Karimov")).toBeInTheDocument()
  const task = within(dialog).getByRole("group", { name: "Vazifa" })
  await user.type(within(task).getByLabelText("Nomi"), "Mijoz sahifasidan")
  fireEvent.change(within(task).getByLabelText("Muddat"), { target: { value: localToday() } })
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(db.tasks.at(-1)).toMatchObject({ title: "Mijoz sahifasidan", customerId: dilshod.id })
  expect(await within(await tasksOf()).findByRole("link", { name: /^Mijoz sahifasidan/ })).toBeInTheDocument()
})

test("the tile to enter a task is there for whoever may add tasks, in a location", async () => {
  giveRole(VALI, 1, "Kuzatuvchi", ["customers.view", "orders.view"])
  await signIn(VALI)
  await chooseCompany(1)
  const { dilshod } = seedTasks()
  open(dilshod.id)

  expect(within(await screen.findByRole("group", { name: "Amallar" })).queryByRole("button", { name: "Vazifa" })).not.toBeInTheDocument()
})
