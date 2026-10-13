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
