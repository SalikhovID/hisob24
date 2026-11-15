"use client"

import { useEffect, useRef } from "react"
import type { FieldPath, FieldValues, PathValue, UseFormReturn } from "react-hook-form"
import { FormRow } from "@/components/kit/form-row"
import { rateLine } from "@/lib/currencies"
import { formatRate } from "@/lib/format"
import type { CompanyCurrency } from "@/lib/types"

// RateRow says the rate a document in another currency than the so'm is
// written at; none is typed (2026-11-15). It is the document's own when it
// has one (an edited document's), else the standard one in force, which the
// API takes for the document's moment (the rate is sent empty).
export function RateRow({ currency, rate }: { currency: CompanyCurrency; rate: string }) {
  const text = rate.trim() !== "" ? `1 ${currency.code} = ${formatRate(rate)} so'm` : rateLine(currency)
  return (
    <FormRow label="Kurs" stack>
      <p data-slot="rate-line" className="pl-1 text-base tabular-nums md:pl-0">
        {text}
      </p>
    </FormRow>
  )
}

// useRateFollowsCurrency forgets a document's rate when its currency changes:
// the new currency's standard rate is the API's to take. The rate the form
// comes with (an edited document's own) stays until then; a currency the
// session tells late (an account not known yet) is no change.
export function useRateFollowsCurrency<T extends FieldValues & { rate: string }, TOut extends FieldValues>(form: UseFormReturn<T, unknown, TOut>, currencyId: number | null): void {
  const last = useRef(currencyId)
  useEffect(() => {
    const before = last.current
    if (currencyId === null || before === currencyId) return
    last.current = currencyId
    if (before === null) return
    form.setValue("rate" as FieldPath<T>, "" as PathValue<T, FieldPath<T>>)
  }, [currencyId, form])
}
