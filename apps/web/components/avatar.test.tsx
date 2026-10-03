import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { tone } from "@/lib/initials"
import { Avatar } from "./avatar"

test("Avatar shows a name's initials in its seed's tone, as decoration", () => {
  render(<Avatar name="Ali Valiyev" seed="998901234567" />)

  const avatar = screen.getByText("AV")
  expect(avatar).toHaveAttribute("aria-hidden", "true")
  expect(avatar).toHaveAttribute("data-tone", String(tone("998901234567")))
})

test("Avatar without a name shows an icon instead", () => {
  const { container } = render(<Avatar name={null} seed="998944445566" />)

  const avatar = container.querySelector('[data-slot="avatar"]')
  expect(avatar).toHaveTextContent("")
  expect(avatar?.querySelector("svg")).toBeInTheDocument()
})
