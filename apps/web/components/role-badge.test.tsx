import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { RoleBadge } from "./role-badge"

test("RoleBadge names the role, and marks the owner's apart with a dot", () => {
  render(
    <>
      <RoleBadge role="owner" />
      <RoleBadge role="user" />
    </>,
  )

  const owner = screen.getByText("Egasi")
  expect(owner).toHaveAttribute("data-role", "owner")
  expect(owner.querySelector('[data-slot="dot"]')).toBeInTheDocument()
  const user = screen.getByText("Xodim")
  expect(user).toHaveAttribute("data-role", "user")
  expect(user.querySelector('[data-slot="dot"]')).not.toBeInTheDocument()
})
