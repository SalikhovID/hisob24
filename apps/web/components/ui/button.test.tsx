import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Button } from "./button"

test("a button is flat: the accent filled, a quiet one the plain fill, a deletion red", () => {
  render(
    <>
      <Button>Saqlash</Button>
      <Button variant="secondary">Bekor qilish</Button>
      <Button variant="outline">Yana yuklash</Button>
      <Button variant="destructive">O&apos;chirish</Button>
    </>,
  )
  expect(screen.getByRole("button", { name: "Saqlash" })).toHaveClass("bg-primary")
  expect(screen.getByRole("button", { name: "Bekor qilish" })).toHaveClass("bg-muted")
  expect(screen.getByRole("button", { name: "Yana yuklash" })).toHaveClass("bg-muted", "text-primary")
  expect(screen.getByRole("button", { name: "O'chirish" })).toHaveClass("bg-destructive")
})

test("a mini button is a small capsule in the accent's ink, wearing its variant's fill", () => {
  render(
    <Button variant="secondary" size="mini">
      Qo&apos;shish
    </Button>,
  )
  const mini = screen.getByRole("button", { name: "Qo'shish" })
  expect(mini).toHaveClass("bg-muted", "rounded-full", "h-[34px]", "text-primary")
})
