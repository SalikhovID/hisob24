import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { PendingButton } from "./pending-button"

test("PendingButton is busy while its request is on the way, under the same name, and cannot be pressed again", async () => {
  const press = vi.fn()
  const { rerender } = render(
    <PendingButton pending={false} onClick={press}>
      Qo&apos;shish
    </PendingButton>,
  )

  const button = screen.getByRole("button", { name: "Qo'shish" })
  expect(button).toBeEnabled()
  expect(button).not.toHaveAttribute("aria-busy")
  expect(button).not.toHaveAttribute("aria-disabled")
  expect(button.querySelector("svg")).not.toBeInTheDocument()

  rerender(
    <PendingButton pending onClick={press}>
      Qo&apos;shish
    </PendingButton>,
  )

  const waiting = screen.getByRole("button", { name: "Qo'shish" })
  expect(waiting).toHaveAttribute("aria-busy", "true")
  expect(waiting).toHaveAttribute("aria-disabled", "true")
  expect(waiting.querySelector("svg")).toBeInTheDocument()
  await userEvent.click(waiting)
  expect(press).not.toHaveBeenCalled()
})

test("PendingButton keeps the keyboard's place while it waits", () => {
  const { rerender } = render(<PendingButton pending={false}>Saqlash</PendingButton>)
  const button = screen.getByRole("button", { name: "Saqlash" })
  button.focus()

  rerender(<PendingButton pending>Saqlash</PendingButton>)

  // A button the browser itself disables cannot hold focus: the keyboard's
  // place would fall back to the page. Off for presses, it stays reachable.
  expect(button).not.toBeDisabled()
  expect(button).toHaveFocus()
})

test("a PendingButton disabled for a reason of its own is plainly disabled", () => {
  render(
    <PendingButton pending={false} disabled>
      Saqlash
    </PendingButton>,
  )

  expect(screen.getByRole("button", { name: "Saqlash" })).toBeDisabled()
})
