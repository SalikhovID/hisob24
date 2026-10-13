import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { ALI, db, membersOf, VALI } from "@/mocks/data"
import { renderWithProviders } from "@/test/render"
import { signIn } from "@/test/session"
import { RemoveEmployeeDialog } from "./remove-employee-button"

const vali = () => membersOf(1).find((m) => m.phone === VALI)!

test("the question is opened from outside (the employee's sheet), has no button of its own, and closes when answered", async () => {
  await signIn(ALI)
  const onOpenChange = vi.fn()
  const { user } = renderWithProviders(<RemoveEmployeeDialog companyId={1} companyName="Olma Savdo" employee={vali()} open onOpenChange={onOpenChange} />)

  const dialog = await screen.findByRole("alertdialog", { name: "Xodimni o'chirasizmi?" })
  expect(dialog).toHaveTextContent("Vali Aliyev Olma Savdo kompaniyasiga kira olmaydi. Keyin qayta qo'shish mumkin.")
  expect(screen.queryByRole("button", { name: /^O'chirish: / })).not.toBeInTheDocument()
  await user.click(within(dialog).getByRole("button", { name: "O'chirish" }))

  await waitFor(() => expect(db.members[VALI].find((m) => m.companyId === 1)).toBeUndefined())
  expect((await screen.findAllByText("Xodim o'chirildi")).length).toBeGreaterThan(0)
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
