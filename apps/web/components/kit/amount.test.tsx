import { render, screen } from "@testing-library/react"
import { expect, test } from "vitest"
import { Amount, groupDigits, splitAmount } from "./amount"

test("the digits are grouped by thousands with a no-break space, the decimals kept apart", () => {
  expect(groupDigits("1250000")).toBe("1 250 000")
  expect(splitAmount("1250000.50")).toEqual({ whole: "1 250 000", decimals: ",50" })
  expect(splitAmount("12000.00")).toEqual({ whole: "12 000", decimals: "" })
  expect(splitAmount("7")).toEqual({ whole: "7", decimals: "" })
})

test("an amount reads as one number with its unit", () => {
  render(<Amount value="1250000.50" unit="so'm" />)
  const amount = screen.getByText((_, element) => element?.getAttribute("data-slot") === "amount")
  // jest-dom folds a no-break space into a space when it reads text.
  expect(amount).toHaveTextContent("1 250 000,50 so'm")
  expect(amount.querySelector('[data-slot="amount-whole"]')).toHaveTextContent("1 250 000")
  expect(amount.querySelector('[data-slot="amount-decimals"]')).toHaveTextContent(",50")
})
