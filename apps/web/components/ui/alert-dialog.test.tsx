import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog"
import { Dialog, DialogContent, DialogTitle } from "./dialog"

test("an alert dialog asks its question in the middle of the screen, its two buttons side by side", async () => {
  render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mijozni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>«Ali Valiyev» o&apos;chiriladi.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
          <AlertDialogAction variant="destructive">O&apos;chirish</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  )
  const dialog = await screen.findByRole("alertdialog", { name: "Mijozni o'chirasizmi?" })
  expect(dialog).toHaveAccessibleDescription("«Ali Valiyev» o'chiriladi.")
  expect(screen.getByRole("button", { name: "Bekor qilish" })).toHaveAttribute("data-slot", "alert-dialog-cancel")
  expect(screen.getByRole("button", { name: "O'chirish" })).toHaveAttribute("data-slot", "alert-dialog-action")
})

test("an alert is the prototype's confirm: a sheet from the bottom on a phone, a 420px dialog in the middle on the web; its words at the left, its buttons at the right on the web", async () => {
  render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rolni o&apos;chirasizmi?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>,
  )
  const dialog = await screen.findByRole("alertdialog", { name: "Rolni o'chirasizmi?" })
  expect(dialog).toHaveClass("inset-x-0", "bottom-0", "rounded-t-sheet", "bg-sheet", "text-left", "md:top-1/2", "md:w-[420px]", "md:rounded-xl", "md:shadow-float")
  expect(screen.getByText("Rolni o'chirasizmi?")).toHaveClass("text-[17px]", "font-semibold", "md:text-[15px]")
  expect(screen.getByRole("button", { name: "Bekor qilish" }).parentElement).toHaveClass("md:justify-end")
  // The quiet way out is a ghost, as the prototype's.
  expect(screen.getByRole("button", { name: "Bekor qilish" })).toHaveClass("text-muted-foreground")
})

test("behind an alert the rest of the screen is dimmed by the scrim, nothing blurred", async () => {
  render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rolni o&apos;chirasizmi?</AlertDialogTitle>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>,
  )
  await screen.findByRole("alertdialog", { name: "Rolni o'chirasizmi?" })
  expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toHaveClass("bg-scrim")
})

test("an alert over a sheet draws a scrim of its own over the sheet", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <DialogTitle>Xodim</DialogTitle>
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xodimni o&apos;chirasizmi?</AlertDialogTitle>
            </AlertDialogHeader>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>,
  )
  await screen.findByRole("alertdialog", { name: "Xodimni o'chirasizmi?" })
  expect(document.querySelectorAll('[data-slot="alert-dialog-overlay"]')).toHaveLength(1)
})
