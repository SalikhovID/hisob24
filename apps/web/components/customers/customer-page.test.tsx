import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { expect, test } from "vitest"
import { ALI, db, seedCustomers, seedSixKinds, VALI } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
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
