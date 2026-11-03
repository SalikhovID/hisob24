import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Button } from "./button"

test("a button is the prototype's: 32px, 8px round, 13px medium", () => {
  render(<Button>Saqlash</Button>)
  expect(screen.getByRole("button", { name: "Saqlash" })).toHaveClass("h-8", "rounded-md", "px-3", "text-[13px]", "font-medium")
})

test("the accent is filled, a secondary one white and ringed, a ghost grey, a deletion soft red", () => {
  render(
    <>
      <Button>Saqlash</Button>
      <Button variant="secondary">Tahrirlash</Button>
      <Button variant="outline">Yana yuklash</Button>
      <Button variant="ghost">Bekor qilish</Button>
      <Button variant="destructive">O&apos;chirish</Button>
    </>,
  )
  expect(screen.getByRole("button", { name: "Saqlash" })).toHaveClass("bg-primary", "text-primary-foreground")
  expect(screen.getByRole("button", { name: "Tahrirlash" })).toHaveClass("bg-card", "text-foreground", "shadow-[var(--card-shadow),0_0_0_1px_var(--ink-4)]")
  expect(screen.getByRole("button", { name: "Yana yuklash" })).toHaveClass("bg-card", "text-accent-text")
  expect(screen.getByRole("button", { name: "Bekor qilish" })).toHaveClass("text-muted-foreground", "hover:bg-ink-1")
  expect(screen.getByRole("button", { name: "O'chirish" })).toHaveClass("bg-destructive-soft", "text-destructive")
})

test("a large button is the prototype's full one: 50px, 12px round and 17px semibold on a phone; 40px and 13px on the web", () => {
  render(<Button size="lg">Qo&apos;shish</Button>)
  expect(screen.getByRole("button", { name: "Qo'shish" })).toHaveClass("h-[50px]", "rounded-xl", "text-[17px]", "font-semibold", "md:h-10", "md:rounded-md", "md:text-[13px]", "md:font-medium")
})

test("a mini button is a small quiet button in the accent's words", () => {
  render(
    <Button variant="secondary" size="mini">
      Qo&apos;shish
    </Button>,
  )
  expect(screen.getByRole("button", { name: "Qo'shish" })).toHaveClass("h-8", "rounded-md", "text-accent-text")
})

test("an icon button is the prototype's 30px square, a round one its 36px circle", () => {
  render(
    <>
      <Button variant="ghost" size="icon" aria-label="Yopish" />
      <Button size="round" aria-label="Qo'shish" />
    </>,
  )
  expect(screen.getByRole("button", { name: "Yopish" })).toHaveClass("size-[30px]", "rounded-md")
  expect(screen.getByRole("button", { name: "Qo'shish" })).toHaveClass("size-9", "rounded-full")
})
