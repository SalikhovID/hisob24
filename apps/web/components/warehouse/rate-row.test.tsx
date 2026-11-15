import { act, render, renderHook, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { expect, test } from "vitest"
import type { CompanyCurrency } from "@/lib/types"
import { RateRow, useRateFollowsCurrency } from "./rate-row"

const usd: CompanyCurrency = { id: 2, code: "USD", name: "AQSH dollari", symbol: "$", rate: "12800.0000" }
const eur: CompanyCurrency = { id: 3, code: "EUR", name: "Yevro", symbol: "€", rate: null }

// No rate is typed (2026-11-15): a document in another currency is written at
// the standard rate in force, or at its own when it has one (an edited one).
test("the rate row says the rate a document is written at, never asking for one", () => {
  const { unmount } = render(<RateRow currency={usd} rate="" />)
  expect(screen.getByText("Kurs")).toBeInTheDocument()
  expect(screen.getByText("1 USD = 12 800 so'm")).toBeInTheDocument()
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  unmount()

  const own = render(<RateRow currency={usd} rate="13000" />)
  expect(screen.getByText("1 USD = 13 000 so'm")).toBeInTheDocument()
  own.unmount()

  render(<RateRow currency={eur} rate="" />)
  expect(screen.getByText("Kurs kiritilmagan")).toBeInTheDocument()
})

// useRated is a form's rate under useRateFollowsCurrency, for the currency given.
function useRated(currencyId: number | null, rate: string) {
  const form = useForm<{ rate: string }>({ defaultValues: { rate } })
  useRateFollowsCurrency(form, currencyId)
  return form
}

test("a document's own rate stays until its currency changes; then the standard one is the API's to take", () => {
  const { result, rerender } = renderHook(({ currencyId }) => useRated(currencyId, "13000"), { initialProps: { currencyId: 2 as number | null } })
  expect(result.current.getValues("rate")).toBe("13000")

  act(() => rerender({ currencyId: 3 }))
  expect(result.current.getValues("rate")).toBe("")

  // A currency the session tells late (an account not known yet) is no change.
  const late = renderHook(({ currencyId }) => useRated(currencyId, "13000"), { initialProps: { currencyId: null as number | null } })
  act(() => late.rerender({ currencyId: 2 }))
  expect(late.result.current.getValues("rate")).toBe("13000")
})
