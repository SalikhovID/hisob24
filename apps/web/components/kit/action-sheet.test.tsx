import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
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

test("an action sheet's lists are flat white cards, 14px round, their rows apart by hairlines", async () => {
  render(
    <ActionSheet
      open
      onOpenChange={() => {}}
      items={[
        { label: "Tahrirlash", onSelect: () => {} },
        { label: "O'chirish", onSelect: () => {}, danger: true },
      ]}
    />,
  )
  const menu = await screen.findByRole("menu")
  expect(menu).toHaveClass("rounded-[14px]", "bg-popover")
  expect(menu.className).not.toContain("glass-edge")
  expect(screen.getByRole("menuitem", { name: "O'chirish" })).toHaveClass("border-t", "border-separator")
  expect(screen.getByRole("button", { name: "Bekor qilish" }).parentElement).toHaveClass("rounded-[14px]", "bg-popover")
})

test("an action sheet over a sheet draws a scrim of its own over the sheet", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Buyurtma</DialogTitle>
        <ActionSheet open onOpenChange={() => {}} items={[{ label: "Tahrirlash", onSelect: () => {} }]} />
      </DialogContent>
    </Dialog>,
  )
  await screen.findByRole("menu")
  expect(document.querySelectorAll('[data-slot="action-sheet-overlay"]')).toHaveLength(1)
})

test("behind an action sheet the rest of the screen is dimmed by the scrim, nothing blurred", async () => {
  render(<ActionSheet open onOpenChange={() => {}} items={[{ label: "Tahrirlash", onSelect: () => {} }]} />)
  await screen.findByRole("menu")
  expect(document.querySelector('[data-slot="action-sheet-overlay"]')).toHaveClass("bg-scrim")
})
