import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCustomers, seedSixKinds, typesOf, VALI } from "@/mocks/data"
import { identityOf } from "@/test/identity"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { chooseCompany, signIn } from "@/test/session"
import { CustomersPage } from "./customers-page"

// names are the customers the table shows, in order.
const names = () =>
  within(screen.getByRole("table", { name: "Mijozlar" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => identityOf(within(row).getByRole("rowheader"))[0])

// openDialog opens the page and its dialog for a new customer.
async function openDialog(href = "/customers") {
  setLocation(href)
  const rendered = renderWithProviders(<CustomersPage />)
  await rendered.user.click(await screen.findByRole("button", { name: "Mijoz qo'shish" }))
  return { ...rendered, dialog: await screen.findByRole("dialog", { name: "Mijoz qo'shish" }) }
}

test("an employee enters a customer: the type's fields are the form, and the list shows the customer at once", async () => {
  await signIn(VALI)
  await chooseCompany(1)
  seedCustomers()
  const { user, dialog } = await openDialog()

  // The first type is chosen; its fields follow the phone, in their order.
  const types = within(dialog).getByRole("radiogroup", { name: "Mijoz turi" })
  expect(within(types).getAllByRole("radio").map((radio) => [radio.textContent, radio.getAttribute("aria-checked")])).toEqual([
    ["Jismoniy", "true"],
    ["Yuridik", "false"],
  ])
  expect(within(dialog).getByLabelText("Telefon raqami")).toHaveValue("")
  expect(within(dialog).getByLabelText("F.I.Sh.")).toHaveValue("")
  expect(within(dialog).getByLabelText("Manba")).toHaveValue("")
  expect(within(dialog).queryByLabelText("INN")).not.toBeInTheDocument()

  await user.type(within(dialog).getByLabelText("Telefon raqami"), "901112233")
  await user.type(within(dialog).getByLabelText("F.I.Sh."), "Yangi Mijoz")
  await user.selectOptions(within(dialog).getByLabelText("Manba"), "LinkedIn")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Mijoz qo'shildi")).toBeInTheDocument()
  await waitFor(() => expect(names()).toEqual(["Yangi Mijoz", "Malika Yusupova", "Anor Tekstil MChJ", "Dilshod Karimov"]))
  expect(await screen.findByText("Kompaniyangiz mijozlari · 4 ta")).toBeInTheDocument()
  const [jismoniy] = typesOf(1)
  const [fish, manba] = jismoniy.fields
  expect(db.customers.at(-1)).toMatchObject({
    typeId: jismoniy.id,
    phone: "998901112233",
    values: { [fish.id]: "Yangi Mijoz", [manba.id]: db.dropdowns[0].options[1].id },
    by: VALI,
  })
})

test("the dialog opens empty every time", async () => {
  await signIn(ALI)
  const { user, dialog } = await openDialog()
  await user.type(within(dialog).getByLabelText("F.I.Sh."), "Yarim yozilgan")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(screen.getByRole("button", { name: "Mijoz qo'shish" }))

  expect(within(await screen.findByRole("dialog", { name: "Mijoz qo'shish" })).getByLabelText("F.I.Sh.")).toHaveValue("")
})

test("choosing another type swaps the fields and keeps the phone", async () => {
  await signIn(ALI)
  const { user, dialog } = await openDialog()
  await user.type(within(dialog).getByLabelText("Telefon raqami"), "901112233")
  await user.type(within(dialog).getByLabelText("F.I.Sh."), "Yozib qo'yilgan")

  await user.click(within(dialog).getByRole("radio", { name: "Yuridik" }))

  expect(within(dialog).getByRole("radio", { name: "Yuridik" })).toHaveAttribute("aria-checked", "true")
  expect(within(dialog).queryByLabelText("F.I.Sh.")).not.toBeInTheDocument()
  expect(within(dialog).getByLabelText("Nomi")).toHaveValue("")
  expect(within(dialog).getByLabelText("INN")).toHaveValue("")
  expect(within(dialog).getByLabelText("Telefon raqami")).toHaveValue("90 111 22 33")

  await user.type(within(dialog).getByLabelText("Nomi"), "Yangi MChJ")
  await user.type(within(dialog).getByLabelText("INN"), "305556677")
  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  const [, yuridik] = typesOf(1)
  const [nomi, inn] = yuridik.fields
  expect(db.customers.at(-1)).toMatchObject({
    typeId: yuridik.id,
    phone: "998901112233",
    values: { [nomi.id]: "Yangi MChJ", [inn.id]: 305556677 },
  })
  // What was typed for the other type did not come along.
  expect(Object.keys(db.customers.at(-1)!.values)).toHaveLength(2)
})

test("under a tab the dialog opens with that tab's type", async () => {
  await signIn(ALI)
  const [, yuridik] = typesOf(1)

  const { dialog } = await openDialog(`/customers?type=${yuridik.id}`)

  expect(within(dialog).getByRole("radio", { name: "Yuridik" })).toHaveAttribute("aria-checked", "true")
  expect(within(dialog).getByLabelText("INN")).toBeInTheDocument()
  expect(within(dialog).queryByLabelText("F.I.Sh.")).not.toBeInTheDocument()
})

test("a company with one type is asked for no type", async () => {
  await signIn(ALI)
  db.types.find((type) => type.companyId === 1 && type.name === "Yuridik")!.deleted = true

  const { dialog } = await openDialog()

  expect(within(dialog).queryByRole("radiogroup")).not.toBeInTheDocument()
  expect(within(dialog).getByLabelText("F.I.Sh.")).toBeInTheDocument()
})

test("a field of each kind has an input of its own, and every answer is saved", async () => {
  await signIn(ALI)
  const { yosh, jinsi, tillar, kanallar, jins, til } = seedSixKinds()
  const { user, dialog } = await openDialog()

  // A whole number is typed on the digits keyboard.
  expect(within(dialog).getByLabelText("Yoshi")).toHaveAttribute("inputmode", "numeric")
  // A radio shows its options at once; one that may stay empty can be taken back.
  const radios = within(dialog).getByRole("radiogroup", { name: "Jinsi" })
  expect(within(radios).getAllByRole("radio")).toHaveLength(3)
  expect(within(radios).getByRole("radio", { name: "Tanlanmagan" })).toHaveAttribute("aria-checked", "true")
  // Checkboxes: one for each option that is offered (Ingliz is turned off).
  const boxes = within(dialog).getByRole("group", { name: "Tillar" })
  expect(within(boxes).getAllByRole("checkbox")).toHaveLength(2)
  // A dropdown of several is a button that says what is chosen.
  const several = within(dialog).getByRole("button", { name: /Kanallar/ })
  expect(several).toHaveTextContent("Tanlanmagan")

  await user.type(within(dialog).getByLabelText("Telefon raqami"), "901112233")
  await user.type(within(dialog).getByLabelText("F.I.Sh."), "Olti Tur")
  await user.type(within(dialog).getByLabelText("Yoshi"), "30")
  await user.selectOptions(within(dialog).getByLabelText("Manba"), "Instagram")
  await user.click(within(radios).getByRole("radio", { name: "Ayol" }))
  await user.click(within(boxes).getByRole("checkbox", { name: "Rus" }))
  await user.click(within(boxes).getByRole("checkbox", { name: "O'zbek" }))
  await user.click(several)
  const menu = await screen.findByRole("menu")
  expect(within(menu).getAllByRole("menuitemcheckbox").map((item) => item.textContent)).toEqual(["Instagram", "LinkedIn"])
  await user.click(within(menu).getByRole("menuitemcheckbox", { name: "LinkedIn" }))
  await user.click(within(menu).getByRole("menuitemcheckbox", { name: "Instagram" }))
  expect(several).toHaveTextContent("Instagram, LinkedIn")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())

  await user.click(within(dialog).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  const [fish, manba] = typesOf(1)[0].fields
  const [instagram, linkedin] = db.dropdowns[0].options
  expect(db.customers.at(-1)!.values).toEqual({
    [fish.id]: "Olti Tur",
    [yosh.id]: 30,
    [manba.id]: instagram.id,
    [jinsi.id]: jins.options[1].id,
    [tillar.id]: [til.options[0].id, til.options[1].id],
    [kanallar.id]: [instagram.id, linkedin.id],
  })
})
