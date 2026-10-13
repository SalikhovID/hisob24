import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { renderWithProviders } from "@/test/render"
import { StageDialog } from "./stage-dialog"

test("a stage is asked in the prototype's sheet, opened from outside: the name a row, the colors as swatches with the chosen one named, the final mark a switch with what it means", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined)
  const onOpenChange = vi.fn()
  const { user } = renderWithProviders(
    <StageDialog title="Bosqich qo'shish" description="Masalan: Yangi, Jarayonda, Bajarildi." submit="Qo'shish" done="Bosqich qo'shildi" open onOpenChange={onOpenChange} onSubmit={onSubmit} />,
  )

  const sheet = await screen.findByRole("dialog", { name: "Bosqich qo'shish" })
  expect(within(sheet).getByLabelText("Nomi")).toHaveAttribute("placeholder", "Masalan, Jarayonda")
  expect(within(sheet).getByText("Bu bosqichdagi vazifa bajarilgan hisoblanadi: muddati o'tgan deb belgilanmaydi.")).toBeInTheDocument()
  await user.type(within(sheet).getByLabelText("Nomi"), "Kutilmoqda")
  await user.click(within(within(sheet).getByRole("radiogroup", { name: "Rangi" })).getByRole("radio", { name: "Moviy" }))
  expect(within(sheet).getByText("Rangi · Moviy")).toBeInTheDocument()
  await user.click(within(sheet).getByRole("switch", { name: "Yakuniy bosqich" }))
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  expect(onSubmit.mock.calls[0][0]).toEqual({ name: "Kutilmoqda", color: "teal", is_done: true })
  expect(within(sheet).queryByRole("button", { name: "Bosqichni o'chirish" })).not.toBeInTheDocument()
})

test("a stage being changed comes filled in, and may be deleted from its sheet: the danger row hands it to the caller", async () => {
  const onDelete = vi.fn()
  const { user } = renderWithProviders(
    <StageDialog
      title="Bosqichni tahrirlash"
      description="Bu bosqichdagi vazifalar o'z joyida qoladi."
      initial={{ name: "Jarayonda", color: "amber", is_done: false }}
      submit="Saqlash"
      done="Bosqich saqlandi"
      open
      onOpenChange={() => {}}
      onSubmit={vi.fn()}
      onDelete={onDelete}
    />,
  )

  const sheet = await screen.findByRole("dialog", { name: "Bosqichni tahrirlash" })
  expect(within(sheet).getByLabelText("Nomi")).toHaveValue("Jarayonda")
  expect(within(sheet).getByRole("radio", { name: "Sariq" })).toBeChecked()
  expect(within(sheet).getByRole("switch", { name: "Yakuniy bosqich" })).not.toBeChecked()
  await user.click(within(sheet).getByRole("button", { name: "Bosqichni o'chirish" }))
  expect(onDelete).toHaveBeenCalled()
})
