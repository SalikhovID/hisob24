import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { expect, test, vi } from "vitest"
import { AmountInput } from "./amount-input"

// Host holds the value as a form does: what the input hands over is what it
// is given back.
function Host({ initial = "", onChange }: { initial?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <AmountInput
      aria-label="Narx"
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

const field = () => screen.getByRole("textbox", { name: "Narx" })

test("digits typed are shown with their thousands apart, and what is handed over is what is shown", async () => {
  const change = vi.fn()
  render(<Host onChange={change} />)
  await userEvent.type(field(), "1000000")
  expect(field()).toHaveValue("1 000 000")
  expect(change).toHaveBeenLastCalledWith("1 000 000")
})

test("a digit typed in the middle leaves the caret after it, however the groups shift", async () => {
  render(<Host initial="234 567" />)
  await userEvent.type(field(), "9", { initialSelectionStart: 1, initialSelectionEnd: 1 })
  expect(field()).toHaveValue("2 934 567")
  expect(field()).toHaveProperty("selectionStart", 3)
  // The next digit goes in after it.
  await userEvent.keyboard("8")
  expect(field()).toHaveValue("29 834 567")
  expect(field()).toHaveProperty("selectionStart", 4)
})

// The space between the thousands is no part of the number: taking only it
// away would change nothing (it comes back), so a key that meets it takes
// the digit beside it away.
test("Backspace right after the space between thousands takes away the digit before it, not the space alone", async () => {
  render(<Host initial="1 234" />)
  await userEvent.type(field(), "{Backspace}", { initialSelectionStart: 2, initialSelectionEnd: 2 })
  expect(field()).toHaveValue("234")
  expect(field()).toHaveProperty("selectionStart", 0)
})

test("Delete right before the space between thousands takes away the digit after it, not the space alone", async () => {
  render(<Host initial="1 234" />)
  await userEvent.type(field(), "{Delete}", { initialSelectionStart: 1, initialSelectionEnd: 1 })
  expect(field()).toHaveValue("134")
  expect(field()).toHaveProperty("selectionStart", 1)
})

test("Backspace on a digit takes away that digit alone", async () => {
  render(<Host initial="1 234" />)
  await userEvent.type(field(), "{Backspace}", { initialSelectionStart: 5, initialSelectionEnd: 5 })
  expect(field()).toHaveValue("123")
  expect(field()).toHaveProperty("selectionStart", 3)
})

test("a value that is set, not typed (a price saved, a price offered), is shown masked as well, and is left as it is", () => {
  const change = vi.fn()
  render(<Host initial="12000.00" onChange={change} />)
  expect(field()).toHaveValue("12 000,00")
  expect(change).not.toHaveBeenCalled()
})
