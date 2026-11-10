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

test("a sheet is the prototype's: the page's own grey, the whole width, 38px round on top; its title at the left, the close button a plain icon at the right", async () => {
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
  expect(sheet).toHaveClass("inset-x-0", "bottom-0", "rounded-t-sheet", "bg-sheet")
  expect(screen.getByText("Mijoz")).toHaveClass("text-[17px]", "font-semibold", "md:text-[15px]")
  expect(document.querySelector('[data-slot="dialog-header"]')).toHaveClass("text-left")
  const close = screen.getByRole("button", { name: "Yopish" })
  expect(close).toHaveClass("right-3", "size-[30px]", "rounded-md", "text-icon")
})

test("behind a sheet the rest of the screen is dimmed by the scrim, nothing blurred", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mijoz</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  )
  await screen.findByRole("dialog", { name: "Mijoz" })
  expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass("bg-scrim")
})

test("a sheet over a sheet draws a scrim of its own over the sheet under; pressing that scrim closes the top sheet only", async () => {
  const under = vi.fn()
  const over = vi.fn()
  render(
    <Dialog open onOpenChange={under}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Xarajat qo&apos;shish</DialogTitle>
        </DialogHeader>
        <Dialog open onOpenChange={over}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kategoriya</DialogTitle>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>,
  )
  await screen.findByRole("dialog", { name: "Kategoriya" })
  const scrims = document.querySelectorAll('[data-slot="dialog-overlay"]')
  expect(scrims).toHaveLength(2)
  await userEvent.click(scrims[1])
  expect(over).toHaveBeenCalledWith(false, expect.anything())
  expect(under).not.toHaveBeenCalled()
})

test("a sheet's head and its main button's bar wear the sheet's own color, flat; on the web the bar is ruled off by a hairline", async () => {
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
  expect(foot).toHaveClass("bg-sheet", "md:border-t", "md:border-line-faint")
  expect(foot?.className).not.toContain("bg-gradient")
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

test("on a wide screen a sheet is the prototype's dialog: in the middle of the screen, 480px wide, 12px round, floating, with no handle", async () => {
  render(
    <Dialog open>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Mijoz</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  )
  const sheet = await screen.findByRole("dialog", { name: "Mijoz" })
  expect(sheet).toHaveClass(
    "md:top-1/2",
    "md:bottom-auto",
    "md:left-1/2",
    "md:w-[480px]",
    "md:-translate-x-1/2",
    "md:-translate-y-1/2",
    "md:rounded-xl",
    "md:shadow-float",
    "md:max-h-[calc(100dvh-64px)]",
    "md:data-tall:h-[calc(100dvh-64px)]",
  )
  expect(document.querySelector('[data-slot="dialog-grab"]')).toHaveClass("md:hidden")
})

// A scroller that scrolls up and down scrolls sideways too unless it is told
// not to (overflow-y: auto makes overflow-x: visible into auto), and a thumb
// then pulls the form a little to the side, on iOS with the elastic bounce.
test("a sheet's body is moved up and down only: nothing sideways, the page behind not dragged at its ends", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mijoz</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  )
  await screen.findByRole("dialog", { name: "Mijoz" })
  expect(document.querySelector('[data-slot="dialog-body"]')).toHaveClass(
    "overflow-y-auto",
    "overflow-x-hidden",
    "overscroll-y-contain",
    "overscroll-x-none",
    "touch-pan-y",
  )
})

test("a full sheet is a screen of its own on a phone: edge to edge, square, no handle, coming in from the right and starting under what lies over the top; on a wide screen it is the dialog in the middle all the same", async () => {
  render(
    <Dialog open>
      <DialogContent tall full>
        <DialogHeader>
          <DialogTitle>Buyurtma</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  )
  const full = await screen.findByRole("dialog", { name: "Buyurtma" })
  expect(full).toHaveAttribute("data-full", "true")
  // The whole screen, no gap above it, no round corners; Telegram's controls
  // (--safe-top) are not under its head.
  expect(full).toHaveClass("inset-0", "max-h-none", "rounded-none", "pt-safe")
  expect(full).not.toHaveClass("bottom-0", "rounded-t-sheet", "data-starting-style:translate-y-full", "data-ending-style:translate-y-full")
  // It does not rise from the bottom: it comes in from the right, as a page of
  // the app does (the page's own keyframes: a dialog mounted open has no
  // starting style to move from, so a transition would not run), and goes back
  // there when it is closed while it is still mounted.
  expect(full).toHaveClass("max-md:animate-[page-from-right_420ms_var(--ease-drawer)_both]", "max-md:data-ending-style:translate-x-full")
  expect(full).not.toHaveClass("max-md:data-starting-style:translate-x-full")
  // No handle: there is nothing to pull down.
  expect(document.querySelector('[data-slot="dialog-grab"]')).toBeNull()
  // The close button stands under the controls too.
  expect(screen.getByRole("button", { name: "Yopish" })).toHaveClass("top-[calc(var(--safe-top)_+_14px)]", "md:top-3")
  // From md up nothing of this is left: the dialog in the middle, as any.
  expect(full).toHaveClass(
    "md:pt-0",
    "md:top-1/2",
    "md:bottom-auto",
    "md:left-1/2",
    "md:w-[480px]",
    "md:-translate-x-1/2",
    "md:-translate-y-1/2",
    "md:rounded-xl",
    "md:max-h-[calc(100dvh-64px)]",
    "md:data-tall:h-[calc(100dvh-64px)]",
  )
})

test("a sheet that is not asked to be full stays the sheet from the bottom", async () => {
  render(
    <Dialog open>
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Mijoz</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>,
  )
  const sheet = await screen.findByRole("dialog", { name: "Mijoz" })
  expect(sheet).not.toHaveAttribute("data-full")
  expect(sheet).toHaveClass("inset-x-0", "bottom-0", "rounded-t-sheet", "data-starting-style:translate-y-full", "data-ending-style:translate-y-full")
  expect(sheet).not.toHaveClass("inset-0", "rounded-none", "pt-safe")
  expect(document.querySelector('[data-slot="dialog-grab"]')).not.toBeNull()
  expect(screen.getByRole("button", { name: "Yopish" })).toHaveClass("top-3.5")
})
