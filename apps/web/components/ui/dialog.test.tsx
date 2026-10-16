import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog"

// The interface speaks Uzbek, to screen readers too.
test("an open dialog's close button is named in Uzbek", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Sarlavha</DialogTitle>
      </DialogContent>
    </Dialog>,
  )

  expect(await screen.findByRole("button", { name: "Yopish" })).toBeInTheDocument()
})

test("a dialog comes up as a sheet named by its title; the close button at its head closes it", async () => {
  const change = vi.fn()
  render(
    <Dialog open onOpenChange={change}>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Mijoz qo&apos;shish</DialogTitle>
          <DialogDescription>Turni tanlang.</DialogDescription>
        </DialogHeader>
        <p>Tana</p>
        <DialogFooter>
          <button type="button">Qo&apos;shish</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  )
  const dialog = await screen.findByRole("dialog", { name: "Mijoz qo'shish" })
  expect(dialog).toHaveAttribute("data-tall", "true")
  expect(dialog).toHaveAccessibleDescription("Turni tanlang.")
  // The grab handle is decoration; the body scrolls, the footer stays.
  expect(dialog.querySelector('[data-slot="dialog-grab"]')).toHaveAttribute("aria-hidden", "true")
  expect(screen.getByRole("button", { name: "Qo'shish" }).closest('[data-slot="dialog-footer"]')).toBeInTheDocument()
  await userEvent.click(screen.getByRole("button", { name: "Yopish" }))
  expect(change).toHaveBeenCalledWith(false, expect.anything())
})

test("a sheet is the prototype's: its own color, 40px round, a white edge; its close button a small glass", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mijoz</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  )
  const sheet = await screen.findByRole("dialog", { name: "Mijoz" })
  expect(sheet).toHaveClass("rounded-sheet", "bg-sheet", "shadow-[0_-12px_50px_rgba(60,40,120,.18),inset_0_0_0_1px_var(--glass-edge),inset_0_1.5px_0_var(--glass-edge)]")
  const close = screen.getByRole("button", { name: "Yopish" }).firstElementChild
  expect(close).toHaveClass("glass-chip")
  expect(close).not.toHaveClass("bg-muted")
})

test("a sheet's head and its main button's bar wear the sheet's own color, so what scrolls under them is hidden; the color is opaque, so it does not show twice", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mijoz</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <button type="button">Saqlash</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
  )
  await screen.findByRole("dialog", { name: "Mijoz" })
  const head = document.querySelector('[data-slot="dialog-header"]')
  const foot = document.querySelector('[data-slot="dialog-footer"]')
  expect(head).toHaveClass("bg-sheet")
  expect(foot).toHaveClass("from-sheet")
})

test("a sheet stops short of what lies over the screen's top (Telegram's controls in full screen), a tall one too", async () => {
  render(
    <Dialog open>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Sozlama</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  )
  const sheet = await screen.findByRole("dialog", { name: "Sozlama" })
  expect(sheet).toHaveClass("max-h-[calc(100dvh-18px-var(--safe-top))]", "data-tall:h-[calc(100dvh-18px-var(--safe-top))]")
  expect(sheet).not.toHaveClass("max-h-[calc(100dvh-18px)]")
})
