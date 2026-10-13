import { screen, waitFor, within } from "@testing-library/react"
import { expect, test, vi } from "vitest"
import { renderWithProviders } from "@/test/render"
import { choose } from "@/test/select"
import { AddFieldSheet, EditFieldSheet } from "./field-sheet"

const manba = { id: 5, name: "Manba", options: [] }

test("a field is asked in the prototype's sheet: the name a row, the kind and (for a choice) its dropdown picked in sheets, the marks as switches", async () => {
  const add = vi.fn().mockResolvedValue(undefined)
  const onOpenChange = vi.fn()
  const { user } = renderWithProviders(<AddFieldSheet dropdowns={[manba]} unique add={add} open onOpenChange={onOpenChange} />)

  const sheet = await screen.findByRole("dialog", { name: "Maydon qo'shish" })
  expect(within(sheet).getByLabelText("Nomi")).toHaveAttribute("placeholder", "Masalan, Manba")
  expect(within(sheet).getByLabelText("Turi")).toHaveTextContent("Matn")
  // Text may be told not to repeat; a choice may not.
  expect(within(sheet).getByRole("switch", { name: "Takrorlanmasin" })).toBeInTheDocument()
  expect(within(sheet).getByText("Takrorlanmas maydon qiymati ikki mijozda bir xil bo'lmaydi (masalan, INN).")).toBeInTheDocument()
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Nomni kiriting")).toBeInTheDocument()

  await user.type(within(sheet).getByLabelText("Nomi"), "Manba")
  await choose(user, within(sheet).getByLabelText("Turi"), "Dropdown (bitta tanlov)")
  expect(within(sheet).queryByRole("switch", { name: "Takrorlanmasin" })).not.toBeInTheDocument()
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))
  expect(await within(sheet).findByText("Dropdownni tanlang")).toBeInTheDocument()
  await choose(user, within(sheet).getByLabelText("Dropdown"), "Manba")
  await user.click(within(sheet).getByRole("switch", { name: "Majburiy" }))
  await user.click(within(sheet).getByRole("button", { name: "Qo'shish" }))

  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  expect(add.mock.calls[0][0]).toEqual({ label: "Manba", kind: "dropdown", required: true, is_unique: false, dropdown_id: 5 })
  expect((await screen.findAllByText("Maydon qo'shildi")).length).toBeGreaterThan(0)
})

test("with no dropdown yet a choice says where to make one; where fields may not be unique nothing asks it", async () => {
  const { user } = renderWithProviders(<AddFieldSheet dropdowns={[]} unique={false} add={vi.fn()} open onOpenChange={() => {}} />)

  const sheet = await screen.findByRole("dialog", { name: "Maydon qo'shish" })
  expect(within(sheet).queryByRole("switch", { name: "Takrorlanmasin" })).not.toBeInTheDocument()
  await choose(user, within(sheet).getByLabelText("Turi"), "Radio (bitta tanlov)")
  expect(within(sheet).getByText("Hali dropdown yo'q: avval Sozlamalarda dropdown yarating.")).toBeInTheDocument()
})

test("a field is changed in its sheet: its kind said, not asked (it stays as made), the marks as switches, the way to delete it", async () => {
  const save = vi.fn().mockResolvedValue(undefined)
  const onDelete = vi.fn()
  const onOpenChange = vi.fn()
  const { user } = renderWithProviders(
    <EditFieldSheet
      field={{ label: "INN", kind: "string", required: false, is_unique: true }}
      kind="Matn"
      unique
      save={save}
      onDelete={onDelete}
      open
      onOpenChange={onOpenChange}
    />,
  )

  const sheet = await screen.findByRole("dialog", { name: "Maydonni tahrirlash" })
  expect(within(sheet).getByLabelText("Nomi")).toHaveValue("INN")
  expect(within(sheet).getByText("Maydon turi yaratilgandan keyin o'zgarmaydi.")).toBeInTheDocument()
  expect(within(sheet).queryByRole("button", { name: /^Turi/ })).not.toBeInTheDocument()
  expect(within(sheet).getByText("Matn")).toBeInTheDocument()
  expect(within(sheet).getByRole("switch", { name: "Takrorlanmasin" })).toBeChecked()
  await user.click(within(sheet).getByRole("switch", { name: "Majburiy" }))
  await user.click(within(sheet).getByRole("button", { name: "Saqlash" }))
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  expect(save.mock.calls[0][0]).toEqual({ label: "INN", required: true, is_unique: true })

  await user.click(within(sheet).getByRole("button", { name: "Maydonni o'chirish" }))
  expect(onDelete).toHaveBeenCalled()
})
