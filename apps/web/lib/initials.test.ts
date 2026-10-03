import { expect, test } from "vitest"
import { initials } from "./initials"

test("initials are the first letters of a name's first two words", () => {
  expect(initials("Ali Valiyev")).toBe("AV")
  expect(initials("Vali")).toBe("V")
  expect(initials("  ali   valiyev ")).toBe("AV")
  expect(initials("Dilnoza Rahimova Karimovna")).toBe("DR")
})

test("initials skip what is not the name: a note in brackets, quotes, a dash", () => {
  expect(initials("Vali (hisobchi)")).toBe("V")
  expect(initials("Dilnoza Rahimova (bosh hisobchi)")).toBe("DR")
  expect(initials("«Olma» savdo")).toBe("OS")
  expect(initials("O'ktam G'ulomov")).toBe("OG")
  expect(initials("Али Валиев")).toBe("АВ")
  expect(initials("24 Market")).toBe("2M")
})

test("no name gives no initials", () => {
  expect(initials(null)).toBeNull()
  expect(initials(undefined)).toBeNull()
  expect(initials("")).toBeNull()
  expect(initials("—")).toBeNull()
  expect(initials("(hisobchi)")).toBeNull()
})
