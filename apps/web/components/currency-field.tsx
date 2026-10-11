"use client"

import { type Control, type FieldPath, type FieldValues, useWatch } from "react-hook-form"
import { SelectField } from "@/components/select-field"
import { TextField } from "@/components/text-field"
import { currencyOf, currencyOptions, UZS } from "@/lib/currencies"
import type { CompanyCurrency } from "@/lib/types"

// CurrencyField is a document's currency and rate (logic/currencies.md,
// section 5): the currency from the company's, and, for one that is not
// the so'm, its rate in so'm ("1 USD = ? so'm"; the standard one is
// offered, another typed makes the document's own). Shown when the company
// works in more than the so'm.
export function CurrencyField<T extends FieldValues, TOut extends FieldValues = T>({
  control,
  currencyName,
  rateName,
  currencies,
}: {
  control: Control<T, unknown, TOut>
  currencyName: FieldPath<T>
  rateName: FieldPath<T>
  currencies: readonly CompanyCurrency[]
}) {
  const chosen = useWatch({ control, name: currencyName }) as unknown
  const currencyId = Number(chosen ?? UZS) || UZS
  const currency = currencyOf(currencies, currencyId)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField control={control} name={currencyName} label="Valyuta" options={currencyOptions(currencies)} />
      {currencyId !== UZS && <TextField control={control} name={rateName} label={`1 ${currency.code} = ? so'm`} inputMode="decimal" autoComplete="off" />}
    </div>
  )
}
