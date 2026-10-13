import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"
import { Refusal } from "./refusal"

test("Refusal says the API's reason as an alert, the reason being its own text", () => {
  render(<Refusal>Bu raqam kompaniyangizga allaqachon qo&apos;shilgan</Refusal>)

  const alert = screen.getByRole("alert")
  expect(alert).toHaveTextContent("Bu raqam kompaniyangizga allaqachon qo'shilgan")
  // The pages (and their tests) find the reason by its text: it must not be
  // wrapped away from the alert itself.
  expect(screen.getByText("Bu raqam kompaniyangizga allaqachon qo'shilgan")).toBe(alert)
  // The icon stands beside the reason, outside the alert's text, for the eyes only.
  expect(alert.closest('[data-slot="refusal"]')?.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
})

test("a refusal may offer what to do about it, as buttons beside the reason", async () => {
  const open = vi.fn()
  render(
    <Refusal
      actions={
        <button type="button" onClick={open}>
          Mijozni ochish
        </button>
      }
    >
      Bu raqamli mijoz allaqachon bor
    </Refusal>,
  )
  expect(screen.getByRole("alert")).toHaveTextContent("Bu raqamli mijoz allaqachon bor")
  await userEvent.click(screen.getByRole("button", { name: "Mijozni ochish" }))
  expect(open).toHaveBeenCalledTimes(1)
})
