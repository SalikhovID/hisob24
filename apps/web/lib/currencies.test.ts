import { expect, test } from "vitest"
import { currencyOf, currencyOptions, isMulti, rateLine, som } from "./currencies"
import type { CompanyCurrency } from "./types"

const usd: CompanyCurrency = { id: 2, code: "USD", name: "AQSH dollari", symbol: "$", rate: "12800.0000" }
const eur: CompanyCurrency = { id: 3, code: "EUR", name: "Yevro", symbol: "€", rate: null }

test("isMulti says whether the company works in more than the so'm", () => {
  expect(isMulti([som])).toBe(false)
  expect(isMulti([som, usd])).toBe(true)
})

test("currencyOf finds a currency by id and falls back to the so'm", () => {
  expect(currencyOf([som, usd], 2)).toBe(usd)
  expect(currencyOf([som, usd], 9)).toBe(som)
})

test("currencyOptions offers the currencies by code and name", () => {
  expect(currencyOptions([som, usd])).toEqual([
    { value: "1", label: "UZS — O'zbek so'mi" },
    { value: "2", label: "USD — AQSH dollari" },
  ])
})

test("rateLine says what a currency is worth, or that no rate was set", () => {
  expect(rateLine(usd)).toBe("1 USD = 12 800 so'm")
  expect(rateLine(eur)).toBe("Kurs kiritilmagan")
})
