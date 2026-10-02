import { expect, test } from "vitest"
import { formatPhone, formatPhoneInput, phoneDigits } from "./phone"

// The field holds the number after +998, which sits beside it, so typing
// can never land inside the country code.
test.each([
  ["", ""],
  ["9", "9"],
  ["90", "90"],
  ["901", "90 1"],
  ["9012345", "90 123 45"],
  ["901234567", "90 123 45 67"],
  ["90 123 45 67", "90 123 45 67"],
  ["90 123 45 678", "90 123 45 67"],
  ["9a0", "90"],
  ["+998901234567", "90 123 45 67"],
  ["998901234567", "90 123 45 67"],
  ["+998 90 123 45 67", "90 123 45 67"],
  ["998123456", "99 812 34 56"],
])("formatPhoneInput(%j) = %j", (typed, shown) => {
  expect(formatPhoneInput(typed)).toBe(shown)
})

test.each([
  ["90 123 45 67", "998901234567"],
  ["99 812 34 56", "998998123456"],
  ["90 123 45 6", null],
  ["", null],
])("phoneDigits(%j) = %j", (field, digits) => {
  expect(phoneDigits(field)).toBe(digits)
})

test("formatPhone writes a number the API keeps for people to read", () => {
  expect(formatPhone("998901234567")).toBe("+998 90 123 45 67")
})
