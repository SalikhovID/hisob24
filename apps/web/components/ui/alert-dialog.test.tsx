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

test("an alert is the prototype's glass card: 34px corners, a white edge over its shadow", async () => {
  render(
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rolni o&apos;chirasizmi?</AlertDialogTitle>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>,
  )
  const dialog = await screen.findByRole("alertdialog", { name: "Rolni o'chirasizmi?" })
  expect(dialog).toHaveClass("rounded-[34px]", "shadow-[var(--shadow),inset_0_0_0_1px_var(--glass-edge)]")
  expect(dialog).not.toHaveClass("rounded-[32px]")
})

test("behind an alert the rest of the screen is frosted: the scrim's tint over a blur of the page", async () => {
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
  expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toHaveClass("scrim")
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
