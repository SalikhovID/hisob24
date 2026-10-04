import { screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { ALI, db, seedCustomers, typesOf, VALI } from "@/mocks/data"
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
