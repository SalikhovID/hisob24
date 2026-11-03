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

test("the switch is the prototype's: the iOS 51 by 31 green one on a phone, a 32 by 18 one in the accent on the web; the thumb white", () => {
  render(<Switch aria-label="Faol" defaultChecked />)
  const track = screen.getByRole("switch", { name: "Faol" })
  expect(track).toHaveClass("h-[31px]", "w-[51px]", "md:h-[18px]", "md:w-8", "bg-ink-5", "data-checked:bg-switch-on")
  const thumb = track.querySelector('[data-slot="switch-thumb"]')
  expect(thumb).toHaveClass("size-[27px]", "md:size-[14px]", "bg-white", "data-checked:translate-x-[22px]", "md:data-checked:translate-x-4")
})
