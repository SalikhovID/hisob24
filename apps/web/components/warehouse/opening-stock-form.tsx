"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { DateTimeRow } from "@/components/kit/date-sheet"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainBar, MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { Refusal } from "@/components/refusal"
import { currencyOf, currencyOptions, isMulti, trimRate, useCurrencies, UZS } from "@/lib/currencies"
import { type OpeningStockForm as OpeningStockFormValues, type OpeningStockOutput, openingStockSchema } from "@/lib/stock"
import { LinesField } from "./lines-field"

// OpeningStockForm is the stock a location starts with, as it is entered or
// edited (logic/warehouse.md, 5.3), as the prototype's document form: a
// purchase without a supplier or payments: the moment, the currency and
// rate (with more than the so'm) as rows, the lines with their prices as
// cards, a note, the main button in the bar at the bottom. The location is
// the page's.
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
  const currencyId = Number(useWatch({ control: form.control, name: "currency_id" })) || UZS

  // Another currency: its standard rate is offered while none is typed.
  useEffect(() => {
    if (currencyId === UZS || form.getValues("rate") !== "") return
    const rate = currencyOf(currencies, currencyId).rate
    if (rate !== null) form.setValue("rate", trimRate(rate))
  }, [currencyId, currencies, form])

  const currency = currencyOf(currencies, currencyId)
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col [&>*]:shrink-0">
      {refusal && <Refusal className="mb-4">{refusal}</Refusal>}
      <Group>
        <DateTimeRow control={form.control} name="at" label="Vaqt" />
        {isMulti(currencies) && <SelectRow control={form.control} name="currency_id" label="Valyuta" options={currencyOptions(currencies)} />}
        {isMulti(currencies) && currencyId !== UZS && (
          <AmountRow control={form.control} name="rate" label={`1 ${currency.code} = ? so'm`} placeholder="kurs" suffix={null} />
        )}
      </Group>
      <LinesField form={form} companyId={companyId} withPrice currencyId={currencyId} pending={pending} />
      <Group>
        <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
      </Group>
      <MainBar>
        <MainButton type="submit" pending={pending}>
          {submitLabel}
        </MainButton>
      </MainBar>
    </form>
  )
}
