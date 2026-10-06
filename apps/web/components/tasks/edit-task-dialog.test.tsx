import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import { expect, test } from "vitest"
import { addDays, ALI, db, localToday, seedTasks, VALI } from "@/mocks/data"
import { setLocation } from "@/test/navigation"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { TaskPage } from "./task-page"

const today = localToday()

// openDialog puts the test on a task's page and opens the dialog to edit it.
async function openDialog(id: number) {
  setLocation(`/tasks/${id}`, { id: String(id) })
  const rendered = renderWithProviders(<TaskPage id={id} />)
  await rendered.user.click(await screen.findByRole("button", { name: "Tahrirlash" }))
  return { ...rendered, dialog: await screen.findByRole("dialog", { name: "Vazifani tahrirlash" }) }
}

const setDate = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })

test("the edit dialog opens with the task as it is, its customer shown and not asked about, and saves what changed", async () => {
  await signIn(ALI)
  const { call, dilshod, yangi, jarayonda, izoh, summa, kanal } = seedTasks()
  const { user, dialog } = await openDialog(call.id)

  expect(within(dialog).getByText("Buyurtma · mijoz va tur o'zgarmaydi")).toBeInTheDocument()
  const customer = within(dialog).getByRole("region", { name: "Mavjud mijoz" })
  expect(within(customer).getByText("Dilshod Karimov")).toBeInTheDocument()
  expect(within(customer).getByRole("link", { name: "Mijozni ochish" })).toHaveAttribute("href", `/customers/${dilshod.id}`)
  expect(within(dialog).queryByRole("combobox", { name: "Telefon raqami" })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole("button", { name: "Boshqa mijoz" })).not.toBeInTheDocument()
  expect(within(dialog).queryByRole("radiogroup", { name: "Vazifa turi" })).not.toBeInTheDocument()
  expect(within(dialog).getByLabelText("Nomi")).toHaveValue("Qo'ng'iroq qilish")
  expect(within(dialog).getByLabelText("Muddat")).toHaveValue(addDays(today, 3))
  expect(within(dialog).getByLabelText("Bosqich")).toHaveValue(String(yangi.id))
  expect(within(dialog).getByLabelText("Mas'ul")).toHaveValue(VALI)
  expect(within(dialog).getByLabelText("Izoh")).toHaveValue("Ertalab qo'ng'iroq")
  expect(within(dialog).getByLabelText("Summa")).toHaveValue("45000")
  const channels = within(dialog).getByRole("group", { name: "Kanal" })
  expect(within(channels).getByRole("checkbox", { name: "Instagram" })).toBeChecked()
  expect(within(channels).getByRole("checkbox", { name: "LinkedIn" })).toBeChecked()

  await user.clear(within(dialog).getByLabelText("Nomi"))
  await user.type(within(dialog).getByLabelText("Nomi"), " Qayta qo'ng'iroq ")
  setDate(within(dialog).getByLabelText("Muddat"), addDays(today, 5))
  await user.selectOptions(within(dialog).getByLabelText("Bosqich"), "Jarayonda")
  await user.selectOptions(within(dialog).getByLabelText("Mas'ul"), "Tanlanmagan")
  await user.clear(within(dialog).getByLabelText("Izoh"))
  await user.type(within(dialog).getByLabelText("Izoh"), "Kechqurun")
  await user.clear(within(dialog).getByLabelText("Summa"))
  await user.click(within(channels).getByRole("checkbox", { name: "Instagram" }))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByText("Vazifa saqlandi")).toBeInTheDocument()
  expect(await screen.findByRole("heading", { level: 1, name: "Qayta qo'ng'iroq" })).toBeInTheDocument()
  expect(screen.getByText(/Buyurtma · Jarayonda/)).toBeInTheDocument()
  expect(db.tasks.find((task) => task.id === call.id)).toMatchObject({
    title: "Qayta qo'ng'iroq",
    deadline: addDays(today, 5),
    stageId: jarayonda.id,
    assignee: null,
    customerId: dilshod.id,
    values: { [izoh.id]: "Kechqurun", [kanal.id]: [db.dropdowns[0].options[1].id] },
  })
  expect(db.tasks.find((task) => task.id === call.id)?.values[summa.id]).toBeUndefined()
})

test("an assignee who left the company stays offered, marked so, and stays on the task through an edit", async () => {
  await signIn(ALI)
  const { call } = seedTasks()
  db.members[VALI] = db.members[VALI].filter((membership) => membership.companyId !== 1)
  const { user, dialog } = await openDialog(call.id)

  const assignee = within(dialog).getByLabelText("Mas'ul")
  await waitFor(() =>
    expect(within(assignee).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Tanlanmagan",
      "Ali Valiyev",
      "Sardor Karimov",
      "Vali Aliyev (chiqarilgan)",
    ]),
  )
  expect(assignee).toHaveValue(VALI)

  setDate(within(dialog).getByLabelText("Muddat"), addDays(today, 4))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(db.tasks.find((task) => task.id === call.id)).toMatchObject({ assignee: VALI, deadline: addDays(today, 4) })
})

test("what is wrong with the edit is said in the API's words", async () => {
  await signIn(ALI)
  const { call } = seedTasks()
  const { user, dialog } = await openDialog(call.id)

  await user.clear(within(dialog).getByLabelText("Nomi"))
  await user.clear(within(dialog).getByLabelText("Izoh"))
  await user.click(within(dialog).getByRole("button", { name: "Saqlash" }))

  expect(await within(dialog).findByText("Vazifa nomini kiriting")).toBeInTheDocument()
  expect(within(dialog).getByText("«Izoh» maydonini to'ldiring")).toBeInTheDocument()
  expect(db.tasks.find((task) => task.id === call.id)?.title).toBe("Qo'ng'iroq qilish")
})

test("the dialog opens with the task as it is every time", async () => {
  await signIn(ALI)
  const { call } = seedTasks()
  const { user, dialog } = await openDialog(call.id)
  await user.type(within(dialog).getByLabelText("Nomi"), " yarim")
  await user.keyboard("{Escape}")
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

  await user.click(screen.getByRole("button", { name: "Tahrirlash" }))

  expect(within(await screen.findByRole("dialog", { name: "Vazifani tahrirlash" })).getByLabelText("Nomi")).toHaveValue("Qo'ng'iroq qilish")
})
