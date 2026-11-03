import { expect, test } from "vitest"
import { initials, shortName, TONES, tone, avatarColor, firstLetter } from "./initials"

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

test("tone is a stable place in the palette, and not the same one for everybody", () => {
  const seeds = ["998901234567", "998902223344", "998933334455", "998944445566", "998975556677", 1, 2, 461603558]

  const tones = seeds.map(tone)

  expect(seeds.map(tone)).toEqual(tones)
  tones.forEach((value) => {
    expect(Number.isInteger(value)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThan(TONES)
  })
  expect(new Set(tones).size).toBeGreaterThan(2)
  expect(tone(1)).toBe(tone("1"))
})

test("a short name is the first word and the next one's first letter", () => {
  expect(shortName("Ali Valiyev")).toBe("Ali V.")
  expect(shortName("Dilshod Karimov Akbarovich")).toBe("Dilshod K.")
  expect(shortName("Ali")).toBe("Ali")
  expect(shortName("  Ali   Valiyev ")).toBe("Ali V.")
})

test.each([
  ["Nodira Karimova", "#c47a9e"],
  ["Jasur Toshmatov", "#6f9b7d"],
  ["Malika Ergasheva", "#8c9ab0"],
  ["Sharq Qurilish MChJ", "#7b86c7"],
  ['"Sharq Qurilish" MChJ', "#7b86c7"],
  ["Aziza Rahimova", "#c2a35a"],
])("a name gets the prototype's avatar color, the same every time: %s", (name, color) => {
  expect(avatarColor(name)).toBe(color)
})

test("a name's letter is its first letter or digit; none without one", () => {
  expect(firstLetter("nodira Karimova")).toBe("N")
  expect(firstLetter('"Sharq Qurilish" MChJ')).toBe("S")
  expect(firstLetter("  ")).toBeNull()
  expect(firstLetter(null)).toBeNull()
})
