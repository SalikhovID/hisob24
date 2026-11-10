import { expect, test } from "vitest"
import { maskAmount } from "./amount-input"

// What is typed, pasted or set in a money field is shown with its thousands
// apart by a space and its decimals after a comma; what is no part of a
// number goes.
test.each([
  ["", ""],
  ["0", "0"],
  ["7", "7"],
  ["999", "999"],
  ["1000", "1 000"],
  ["1000000", "1 000 000"],
  ["1234567890123", "1 234 567 890 123"],
  // Already shown: shown again as it is.
  ["1 000 000", "1 000 000"],
  // A no-break space (copied from a figure on screen) is no part of the number.
  ["1 000", "1 000"],
  ["1000000,5", "1 000 000,5"],
  // A dot is a comma; the decimals are left as they are, zeros and all.
  ["1000000.50", "1 000 000,50"],
  ["12000.00", "12 000,00"],
  ["12800.5000", "12 800,5000"],
  // A comma typed waits for its decimals; with no whole part there is a zero.
  ["1000,", "1 000,"],
  [",", "0,"],
  [".5", "0,5"],
  // One comma only: the digits after a second one go on as decimals.
  ["12,3,4", "12,34"],
  ["12ab3", "123"],
  ["-5", "5"],
  // No zeros in front, but a lone zero stays.
  ["007", "7"],
  ["00", "0"],
  ["0,05", "0,05"],
])("maskAmount(%j) = %j", (typed, shown) => {
  expect(maskAmount(typed)).toBe(shown)
})
