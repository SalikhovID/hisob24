import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Button } from "./button"

test("a button wears the prototype's glass: the accent glossy, a quiet one a small glass, a deletion the red capsule", () => {
  render(
    <>
      <Button>Saqlash</Button>
      <Button variant="secondary">Bekor qilish</Button>
      <Button variant="outline">Yana yuklash</Button>
      <Button variant="destructive">O&apos;chirish</Button>
    </>,
  )
  expect(screen.getByRole("button", { name: "Saqlash" })).toHaveClass("glossy")
  expect(screen.getByRole("button", { name: "Bekor qilish" })).toHaveClass("glass-chip")
  expect(screen.getByRole("button", { name: "Yana yuklash" })).toHaveClass("glass-chip", "text-primary")
  expect(screen.getByRole("button", { name: "O'chirish" })).toHaveClass("glossy-red")
})

test("a mini button is a small capsule in the accent's ink, wearing its variant's fill", () => {
  render(
    <Button variant="secondary" size="mini">
      Qo&apos;shish
    </Button>,
  )
  const mini = screen.getByRole("button", { name: "Qo'shish" })
  expect(mini).toHaveClass("glass-chip", "rounded-full", "h-[34px]", "text-primary")
  expect(mini).not.toHaveClass("bg-muted")
})
