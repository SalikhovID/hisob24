import { render } from "@testing-library/react"
import { expect, test } from "vitest"
import { tone } from "@/lib/initials"
import { Avatar } from "./avatar"

const avatar = (container: HTMLElement) => container.querySelector('[data-slot="avatar"]') as HTMLElement

test("an avatar shows the initials in the tint its seed always gets, and is decoration", () => {
  const { container } = render(<Avatar name="Ali Valiyev" seed="998901234567" />)
  const mark = avatar(container)
  expect(mark).toHaveTextContent("AV")
  expect(mark).toHaveAttribute("aria-hidden", "true")
  expect(mark).toHaveAttribute("data-tone", String(tone("998901234567")))
})

test("a record with a letter mark shows its first letter alone; one with no name shows an icon and no tint", () => {
  const { container, rerender } = render(<Avatar name="olma" seed={4} letter square />)
  expect(avatar(container)).toHaveTextContent(/^O$/)

  rerender(<Avatar name={null} seed={4} />)
  expect(avatar(container)).not.toHaveAttribute("data-tone")
  expect(avatar(container).querySelector("svg")).toBeInTheDocument()
})

test("a large avatar says its size for the styles", () => {
  const { container } = render(<Avatar name="Olma Savdo" seed={1} size="lg" square />)
  expect(avatar(container)).toHaveAttribute("data-size", "lg")
  expect(avatar(container)).toHaveAttribute("data-square", "true")
})
