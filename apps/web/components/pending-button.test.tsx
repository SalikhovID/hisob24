import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { PendingButton } from "./pending-button"

test("PendingButton is disabled and busy while its request is on the way, under the same name", () => {
  const { rerender } = render(<PendingButton pending={false}>Qo&apos;shish</PendingButton>)

  const button = screen.getByRole("button", { name: "Qo'shish" })
  expect(button).toBeEnabled()
  expect(button).not.toHaveAttribute("aria-busy")
  expect(button.querySelector("svg")).not.toBeInTheDocument()

  rerender(<PendingButton pending>Qo&apos;shish</PendingButton>)

  const waiting = screen.getByRole("button", { name: "Qo'shish" })
  expect(waiting).toBeDisabled()
  expect(waiting).toHaveAttribute("aria-busy", "true")
  expect(waiting.querySelector("svg")).toBeInTheDocument()
})
