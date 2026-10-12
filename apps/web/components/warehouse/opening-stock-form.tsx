"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { CurrencyField } from "@/components/currency-field"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { FieldGroup } from "@/components/ui/field"
import { currencyOf, isMulti, trimRate, useCurrencies, UZS } from "@/lib/currencies"
import { type OpeningStockForm as OpeningStockFormValues, type OpeningStockOutput, openingStockSchema } from "@/lib/stock"
import { LinesField } from "./lines-field"

// OpeningStockForm is the stock a location starts with, as it is entered or
// edited (logic/warehouse.md, 5.3): a purchase without a supplier or
// payments: the moment, the currency and rate (with more than the so'm),
// the lines with their prices and a note. The location is the page's.
export function OpeningStockForm({
  companyId,
  defaults,
  onSubmit,
  submitLabel,
  pending,
  refusal,
}: {
  companyId: number
  defaults: OpeningStockFormValues
  onSubmit: (opening: OpeningStockOutput) => void
  submitLabel: string
  pending: boolean
  refusal?: string
}) {
  const currencies = useCurrencies()
  const form = useForm<OpeningStockFormValues, unknown, OpeningStockOutput>({ resolver: zodResolver(openingStockSchema), defaultValues: defaults })
  const currencyId = Number(form.watch("currency_id")) || UZS

  // Another currency: its standard rate is offered while none is typed.
  useEffect(() => {
    if (currencyId === UZS || form.getValues("rate") !== "") return
    const rate = currencyOf(currencies, currencyId).rate
    if (rate !== null) form.setValue("rate", trimRate(rate))
  }, [currencyId, currencies, form])

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FieldGroup>
        <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
        {isMulti(currencies) && <CurrencyField control={form.control} currencyName="currency_id" rateName="rate" currencies={currencies} />}
      </FieldGroup>
      <LinesField form={form} companyId={companyId} withPrice currencyId={currencyId} pending={pending} />
      <FieldGroup>
        <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
      </FieldGroup>
      {refusal && <Refusal>{refusal}</Refusal>}
      <PendingButton type="submit" size="lg" className="px-3.5" pending={pending}>
        {submitLabel}
      </PendingButton>
    </form>
  )
}
