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

test("a value that is set, not typed (a price saved, a price offered), is shown masked as well, and is left as it is", () => {
  const change = vi.fn()
  render(<Host initial="12000.00" onChange={change} />)
  expect(field()).toHaveValue("12 000,00")
  expect(change).not.toHaveBeenCalled()
})
