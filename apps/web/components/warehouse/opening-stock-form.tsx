"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { DateTimeRow } from "@/components/kit/date-sheet"
import { SegmentedRow, TextRow } from "@/components/kit/form-row"
import { Group } from "@/components/kit/group"
import { MainBar, MainButton } from "@/components/kit/main-button"
import { Refusal } from "@/components/refusal"
import { currencyCodes, currencyOf, isMulti, useCurrencies, UZS } from "@/lib/currencies"
import { type OpeningStockForm as OpeningStockFormValues, type OpeningStockOutput, openingStockSchema } from "@/lib/stock"
import { LinesField } from "./lines-field"
import { RateRow, useRateFollowsCurrency } from "./rate-row"

// OpeningStockForm is the stock a location starts with, as it is entered or
// edited (logic/warehouse.md, 5.3), as the prototype's document form: a
// purchase without a supplier or payments: the moment, the currency (with
// more than the so'm) and the rate it is written at, said, not asked
// (RateRow), as rows, the lines with their prices as
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

  // Another currency: no rate is asked; the one the document is written at
  // is said (an edited one's own until its currency changes).
  const rate = useWatch({ control: form.control, name: "rate" })
  const at = useWatch({ control: form.control, name: "at" })
  useRateFollowsCurrency(form, currencyId)

  const currency = currencyOf(currencies, currencyId)
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col [&>*]:shrink-0">
      {refusal && <Refusal className="mb-4">{refusal}</Refusal>}
      <Group>
        <DateTimeRow control={form.control} name="at" label="Vaqt" />
        {isMulti(currencies) && <SegmentedRow control={form.control} name="currency_id" label="Valyuta" options={currencyCodes(currencies)} />}
        {isMulti(currencies) && currencyId !== UZS && <RateRow currency={currency} rate={rate} at={at} />}
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
