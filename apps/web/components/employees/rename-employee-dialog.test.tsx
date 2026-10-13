import { screen, waitFor, within } from "@testing-library/react"
import { type ComponentProps, useState } from "react"
import { expect, test } from "vitest"
import { ALI, db, membersOf, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { RenameEmployeeDialog } from "./rename-employee-dialog"

// Opened is the sheet as the employee's sheet opens it: open from the
// start, closed when it says so.
function Opened(props: Omit<ComponentProps<typeof RenameEmployeeDialog>, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(true)
  return <RenameEmployeeDialog {...props} open={open} onOpenChange={setOpen} />
}

const vali = () => membersOf(1).find((m) => m.phone === VALI)!

test("an employee's name is changed in a sheet opened from outside: the phone under its title, the name a row", async () => {
  await signIn(ALI)
  const { user } = renderWithProviders(<Opened companyId={1} employee={vali()} />)

  const sheet = await screen.findByRole("dialog", { name: "Ismni o'zgartirish" })
  expect(sheet).toHaveAccessibleDescription("+998 90 222 33 44")
  const name = within(sheet).getByLabelText("Ism")
  expect(name).toHaveValue("Vali Aliyev")
  expect(name.closest("[data-slot=form-row]")).not.toBeNull()
  await user.clear(name)
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  expect(await within(sheet).findByText("Ismni kiriting")).toBeInTheDocument()
  await user.type(name, "Vali Karimov")
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))

  await waitFor(() => expect(db.members[VALI].find((m) => m.companyId === 1)?.fullName).toBe("Vali Karimov"))
  expect((await screen.findAllByText("Ism o'zgartirildi")).length).toBeGreaterThan(0)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})
