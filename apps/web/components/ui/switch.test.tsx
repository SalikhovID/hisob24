import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Switch } from "./switch"

test("a switch is a switch: it says whether it is on, and a press turns it", async () => {
  const change = vi.fn()
  render(<Switch aria-label="Majburiy" checked={false} onCheckedChange={change} />)
  const toggle = screen.getByRole("switch", { name: "Majburiy" })
  expect(toggle).toHaveAttribute("aria-checked", "false")
  await userEvent.click(toggle)
  expect(change).toHaveBeenCalledWith(true, expect.anything())
})

test("a label beside the switch names it, and a press on the label turns it", async () => {
  const change = vi.fn()
  render(
    <>
      <label htmlFor="final">Yakuniy bosqich</label>
      <Switch id="final" checked onCheckedChange={change} />
    </>,
  )
  expect(screen.getByRole("switch", { name: "Yakuniy bosqich" })).toHaveAttribute("aria-checked", "true")
  await userEvent.click(screen.getByText("Yakuniy bosqich"))
  expect(change).toHaveBeenCalledWith(false, expect.anything())
})
