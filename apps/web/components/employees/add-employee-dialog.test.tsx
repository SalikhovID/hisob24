import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { expect, test } from "vitest"
import { ALI, membersOf } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { AddEmployeeDialog } from "./add-employee-dialog"

// Opened is the sheet as the page's plus opens it: open from the start,
// closed when it says so.
function Opened(props: Omit<ComponentProps<typeof AddEmployeeDialog>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true)
  return <AddEmployeeDialog {...props} open={open} onOpenChange={setOpen} />
}

test("an employee is added in the prototype's sheet, opened from outside: the phone and the name rows, what a new employee may do said under them", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} />)

  const sheet = await screen.findByRole("dialog", { name: "Xodim qo'shish" })
  expect(sheet).toHaveAccessibleDescription("Xodim shu raqam bilan tizimga kiradi: SMS kod yoki Telegram bot orqali.")
  expect(within(sheet).getByText("Yangi xodim rolsiz va hamma lokatsiyada ishlaydi. Keyin o'zgartirish mumkin.")).toBeInTheDocument()
  expect(within(sheet).getByLabelText("Ism")).toHaveAttribute("placeholder", "Ism Familiya")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Telefon raqamini to'liq kiriting")).toBeInTheDocument()
  expect(within(sheet).getByText("Ismni kiriting")).toBeInTheDocument()
  await user.type(within(sheet).getByLabelText("Telefon"), "907778899")
  await user.type(within(sheet).getByLabelText("Ism"), "Yangi Xodim")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(membersOf(1).map((m) => m.phone)).toContain("998907778899"))
  expect((await screen.findAllByText("Xodim qo'shildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("the API's refusal stays in the sheet, and nobody is added", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} />)

  const sheet = await screen.findByRole("dialog", { name: "Xodim qo'shish" })
  // The owner's own number is a member already.
  await user.type(within(sheet).getByLabelText("Telefon"), "901234567")
  await user.type(within(sheet).getByLabelText("Ism"), "Ali")
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Bu raqam kompaniyangizga allaqachon qo'shilgan")).toBeInTheDocument()
  expect(screen.getByRole("dialog", { name: "Xodim qo'shish" })).toBeInTheDocument()
  expect(membersOf(1)).toHaveLength(3)
})
