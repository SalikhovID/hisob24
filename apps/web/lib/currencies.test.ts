import { act, renderHook } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { expect, test } from "vitest"
import { currencyOf, currencyOptions, isMulti, rateLine, som, useOfferedRate } from "./currencies"
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

// The rates the hook offers from: the dollar and the euro set, the rouble not yet.
const euro: CompanyCurrency = { ...eur, rate: "14000.0000" }
const rouble: CompanyCurrency = { id: 4, code: "RUB", name: "Rossiya rubli", symbol: "₽", rate: null }
const rated = [som, usd, euro, rouble]

// useRated is a form's rate field under useOfferedRate: the form comes with
// the rate given, for the currency given (null: one not known yet).
function useRated(currencyId: number | null, rate = "", open = true) {
  const form = useForm<{ rate: string }>({ defaultValues: { rate } })
  useOfferedRate(form, currencyId, rated, open)
  return form
}

test("useOfferedRate offers another currency its standard rate while none is typed; a rate the form comes with stays; the so'm and a closed dialog take none", () => {
  expect(renderHook(() => useRated(2)).result.current.getValues("rate")).toBe("12800")
  expect(renderHook(() => useRated(2, "13000")).result.current.getValues("rate")).toBe("13000")
  expect(renderHook(() => useRated(1)).result.current.getValues("rate")).toBe("")
  expect(renderHook(() => useRated(2, "", false)).result.current.getValues("rate")).toBe("")
})

test("useOfferedRate: another currency chosen takes its own standard rate, not the one typed for the currency before; one with no rate set asks for it", () => {
  const { result, rerender } = renderHook(({ id }: { id: number }) => useRated(id), { initialProps: { id: 1 } })
  const rate = () => result.current.getValues("rate")

  rerender({ id: 2 })
  expect(rate()).toBe("12800")
  act(() => result.current.setValue("rate", "13000"))
  rerender({ id: 3 })
  expect(rate()).toBe("14000")
  rerender({ id: 4 })
  expect(rate()).toBe("")
  rerender({ id: 1 })
  rerender({ id: 2 })
  expect(rate()).toBe("12800")
})

test("useOfferedRate: a currency not known yet (an account the session has not told) is no change; the document keeps its own rate until its currency is changed", () => {
  const { result, rerender } = renderHook(({ id }: { id: number | null }) => useRated(id, "13000"), { initialProps: { id: null as number | null } })
  const rate = () => result.current.getValues("rate")

  expect(rate()).toBe("13000")
  rerender({ id: 2 })
  expect(rate()).toBe("13000")
  rerender({ id: 3 })
  expect(rate()).toBe("14000")
})
