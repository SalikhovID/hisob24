import { render } from "@testing-library/react"
import { expect, test } from "vitest"
import { Avatar } from "./avatar"

const avatar = (container: HTMLElement) => container.querySelector('[data-slot="avatar"]') as HTMLElement

test("an avatar is the prototype's: the name's first letter, white on the name's own color, 32px (30px on the web), and is decoration", () => {
  const { container } = render(<Avatar name="Nodira Karimova" />)
  const mark = avatar(container)
  expect(mark).toHaveTextContent(/^N$/)
  expect(mark).toHaveAttribute("aria-hidden", "true")
  expect(mark.style.background).toBe("rgb(196, 122, 158)")
  expect(mark).toHaveClass("size-8", "md:size-[30px]", "text-white", "font-semibold")
})

test("a muted avatar (someone no longer active) is grey, its letter in the hint's ink", () => {
  const { container } = render(<Avatar name="Nodira Karimova" muted />)
  expect(avatar(container)).toHaveClass("bg-muted", "text-muted-foreground")
  expect(avatar(container).style.background).toBe("")
})

test("a record with a letter mark shows its first letter alone; one with no name shows an icon, muted", () => {
  const { container, rerender } = render(<Avatar name="olma" letter square />)
  expect(avatar(container)).toHaveTextContent(/^O$/)

  rerender(<Avatar name={null} />)
  expect(avatar(container)).toHaveClass("bg-muted", "text-muted-foreground")
  expect(avatar(container).querySelector("svg")).toBeInTheDocument()
})

test("a large avatar says its size for the styles", () => {
  const { container } = render(<Avatar name="Olma Savdo" size="lg" square />)
  expect(avatar(container)).toHaveAttribute("data-size", "lg")
  expect(avatar(container)).toHaveAttribute("data-square", "true")
})
