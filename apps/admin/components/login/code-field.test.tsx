import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef, useState } from "react"
import { expect, test, vi } from "vitest"
import { CodeField } from "./code-field"

// Held keeps the field's value, as the login step that holds it does.
function Held({
  onComplete,
  invalid,
  disabled,
}: {
  onComplete: (code: string) => void
  invalid?: boolean
  disabled?: boolean
}) {
  const [value, setValue] = useState("")
  return <CodeField value={value} onChange={setValue} onComplete={onComplete} invalid={invalid} disabled={disabled} />
}

test("the sixth digit hands the code over", async () => {
  const onComplete = vi.fn()
  render(<Held onComplete={onComplete} />)
  const field = screen.getByRole("textbox", { name: "Kod" })

  await userEvent.type(field, "12345")
  expect(onComplete).not.toHaveBeenCalled()
  await userEvent.type(field, "6")

  expect(onComplete).toHaveBeenCalledWith("123456")
})

test("the code takes digits only", async () => {
  render(<Held onComplete={vi.fn()} />)
  const field = screen.getByRole("textbox", { name: "Kod" })

  await userEvent.type(field, "12ab3")

  expect(field).toHaveValue("123")
})

test("a refused code marks every box", () => {
  const { container } = render(<Held onComplete={vi.fn()} invalid />)

  const boxes = container.querySelectorAll('[data-slot="input-otp-slot"]')
  expect(boxes).toHaveLength(6)
  boxes.forEach((box) => expect(box).toHaveAttribute("aria-invalid", "true"))
})

test("while a code is checked the field takes nothing", () => {
  render(<Held onComplete={vi.fn()} disabled />)

  expect(screen.getByRole("textbox", { name: "Kod" })).toBeDisabled()
})

test("the field takes the keyboard as it appears", () => {
  render(<Held onComplete={vi.fn()} />)

  expect(screen.getByRole("textbox", { name: "Kod" })).toHaveFocus()
})

test("whoever holds the field can reach its input, to hand the keyboard back to it", () => {
  const input = createRef<HTMLInputElement>()
  render(<CodeField ref={input} value="" onChange={vi.fn()} onComplete={vi.fn()} />)

  expect(input.current).toBe(screen.getByRole("textbox", { name: "Kod" }))
})
