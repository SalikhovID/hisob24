import { expect, test } from "vitest"
import { initials } from "./initials"

test("initials are the first letters of a name's first two words", () => {
  expect(initials("Ali Valiyev")).toBe("AV")
  expect(initials("Vali")).toBe("V")
  expect(initials("  ali   valiyev ")).toBe("AV")
  expect(initials("Dilnoza Rahimova Karimovna")).toBe("DR")
})
