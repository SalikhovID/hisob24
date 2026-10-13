import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog"
import { SheetForm } from "./sheet-form"

test("a form in a sheet is the body's own, with its footer at the bottom: the body leaves it no padding under it", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Varaq</DialogTitle>
        <SheetForm aria-label="Forma">
          <DialogFooter>
            <button type="submit">Saqlash</button>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>,
  )

  const form = await screen.findByRole("form", { name: "Forma" })
  expect(form).toHaveAttribute("novalidate")
  expect(form.parentElement).toHaveAttribute("data-slot", "dialog-body")
  expect(form.parentElement!.className).toContain("has-[>[data-slot=sheet-form]>[data-slot=dialog-footer]]:pb-0")
})
