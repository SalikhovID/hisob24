import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { ActionSheet } from "./action-sheet"

test("an action sheet lists what can be done; a choice does it and closes the sheet", async () => {
  const edit = vi.fn()
  const remove = vi.fn()
  const change = vi.fn()
  render(
    <ActionSheet
      open
      onOpenChange={change}
      title="Yetkazib berish · 30 000 so'm"
      items={[
        { label: "Tahrirlash", onSelect: edit },
        { label: "O'chirish", onSelect: remove, danger: true },
      ]}
    />,
  )
  const dialog = await screen.findByRole("dialog", { name: "Yetkazib berish · 30 000 so'm" })
  expect(dialog).toBeInTheDocument()
  expect(screen.getByRole("menuitem", { name: "O'chirish" })).toHaveAttribute("data-danger", "true")
  await userEvent.click(screen.getByRole("menuitem", { name: "Tahrirlash" }))
  expect(edit).toHaveBeenCalledTimes(1)
  expect(change).toHaveBeenCalledWith(false)
  await userEvent.click(screen.getByRole("button", { name: "Bekor qilish" }))
  expect(change).toHaveBeenLastCalledWith(false, expect.anything())
})

test("a choice among states marks the current one", () => {
  render(
    <ActionSheet
      open
      onOpenChange={() => {}}
      items={[
        { label: "Asosiy", onSelect: () => {}, checked: true },
        { label: "Chilonzor", onSelect: () => {}, checked: false },
      ]}
    />,
  )
  expect(screen.getByRole("menuitemradio", { name: "Asosiy" })).toHaveAttribute("aria-checked", "true")
  expect(screen.getByRole("menuitemradio", { name: "Chilonzor" })).toHaveAttribute("aria-checked", "false")
})
