import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Refusal } from "./refusal"

test("Refusal says the API's reason as an alert, the reason being its own text", () => {
  render(<Refusal>Bu raqam kompaniyangizga allaqachon qo&apos;shilgan</Refusal>)

  const alert = screen.getByRole("alert")
  expect(alert).toHaveTextContent("Bu raqam kompaniyangizga allaqachon qo'shilgan")
  // The pages (and their tests) find the reason by its text: it must not be
  // wrapped away from the alert itself.
  expect(screen.getByText("Bu raqam kompaniyangizga allaqachon qo'shilgan")).toBe(alert)
  expect(alert.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
})
