import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { api, call } from "@/lib/api"
import { ALI, db, seedCustomers, seedSixKinds, typesOf, VALI } from "@/mocks/data"
import { router, setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { server } from "@/test/server"
import { chooseCompany, signIn } from "@/test/session"
import { CustomerPage } from "./customer-page"

// open puts the test on a customer's page.
function open(id: number) {
  setLocation(`/customers/${id}`, { id: String(id) })
  return renderWithProviders(<CustomerPage id={id} />)
}

// pairsOf reads a list of names and values as [name, value] of each line.
const pairsOf = (region: HTMLElement) =>
  Array.from(region.querySelectorAll("dt")).map((term) => [term.textContent, term.nextElementSibling?.textContent ?? null])

const info = () => screen.findByRole("region", { name: "Ma'lumot" })

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
  const [instagram] = db.dropdowns[0].options
  const { user } = open(dilshod.id)

  const dialog = await edit(user)

  // The type was chosen when the customer was entered: it is not asked again.
  expect(within(dialog).queryByRole("radiogroup", { name: "Mijoz turi" })).not.toBeInTheDocument()
  expect(within(dialog).getByText("Jismoniy")).toBeInTheDocument()
  expect(within(dialog).getByLabelText("Telefon raqami")).toHaveValue("91 111 22 33")
  expect(within(dialog).getByLabelText("F.I.Sh.")).toHaveValue("Dilshod Karimov")
  expect(within(dialog).getByLabelText("Manba")).toHaveValue(String(instagram.id))

  await user.clear(within(dialog).getByLabelText("F.I.Sh."))
  await user.type(within(dialog).getByLabelText("F.I.Sh."), "Dilshod Karimovich")
  await user.selectOptions(within(dialog).getByLabelText("Manba"), "LinkedIn")
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

// optionsOf are what a select offers, by their names.
const optionsOf = (select: HTMLElement) =>
  within(select)
    .getAllByRole("option")
    .map((option) => option.textContent)

test("an option that is turned off is offered to the customer who has it, and to nobody else", async () => {
  await signIn(ALI)
  const { dilshod, malika } = seedCustomers()
  const youtube = db.dropdowns[0].options[2]
  const first = open(malika.id)

  let dialog = await edit(first.user)

  expect(optionsOf(within(dialog).getByLabelText("Manba"))).toEqual(["Tanlanmagan", "Instagram", "LinkedIn", "YouTube"])
  expect(within(dialog).getByLabelText("Manba")).toHaveValue(String(youtube.id))
  await first.user.clear(within(dialog).getByLabelText("F.I.Sh."))
  await first.user.type(within(dialog).getByLabelText("F.I.Sh."), "Malika Yusupova (VIP)")
  await first.user.click(within(dialog).getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(Object.values(malika.values)).toEqual(["Malika Yusupova (VIP)", youtube.id])
  first.unmount()

  const second = open(dilshod.id)
  dialog = await edit(second.user)
  expect(optionsOf(within(dialog).getByLabelText("Manba"))).toEqual(["Tanlanmagan", "Instagram", "LinkedIn"])
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

  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
  let confirm = await screen.findByRole("alertdialog", { name: "Mijozni o'chirasizmi?" })
  expect(confirm).toHaveTextContent("Dilshod Karimov mijozlar ro'yxatidan olib tashlanadi. Qayta tiklab bo'lmaydi.")
  await user.click(within(confirm).getByRole("button", { name: "Bekor qilish" }))
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
  expect(dilshod.deleted).toBeUndefined()

  await user.click(screen.getByRole("button", { name: "O'chirish" }))
  confirm = await screen.findByRole("alertdialog", { name: "Mijozni o'chirasizmi?" })
  await user.click(within(confirm).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/customers"))
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

  await user.click(await screen.findByRole("button", { name: "O'chirish" }))
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
