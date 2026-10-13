"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Foot, Group } from "@/components/kit/group"
import { MainBar, MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { Refusal } from "@/components/refusal"
import { currencyOf, currencyOptions, isMulti, trimRate, useAccounts, useCurrencies, UZS } from "@/lib/currencies"
import { type PurchaseForm as PurchaseFormValues, type PurchaseOutput, purchaseSchema, purchaseTotal } from "@/lib/warehouse"
import { LinesField } from "./lines-field"
import { PaymentsField } from "./payments-field"
import { SupplierPicker } from "./pickers"

// PurchaseForm is a purchase as it is entered or edited (logic/warehouse.md,
// 4.1–4.3), as the prototype's document form: the supplier picked in a
// sheet, the moment, the currency and rate (with more than the so'm) as
// rows; the lines with their prices as cards (LinesField); the payments out
// of the accounts; a note; what saving does, said under it; the main button
// in the bar at the bottom. The location is the page's (locationName says it).
export function PurchaseForm({
  companyId,
  defaults,
  onSubmit,
  submitLabel,
  pending,
  refusal,
  locationName,
}: {
  companyId: number
  defaults: PurchaseFormValues
  onSubmit: (purchase: PurchaseOutput) => void
  submitLabel: string
  pending: boolean
  refusal?: string
  locationName?: string
}) {
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const form = useForm<PurchaseFormValues, unknown, PurchaseOutput>({ resolver: zodResolver(purchaseSchema), defaultValues: defaults })
  const items = useWatch({ control: form.control, name: "items" })
  const currencyId = Number(useWatch({ control: form.control, name: "currency_id" })) || UZS
  const total = purchaseTotal(items)
  const currency = currencyOf(currencies, currencyId)

  // Another currency: its standard rate is offered while none is typed.
  useEffect(() => {
    if (currencyId === UZS || form.getValues("rate") !== "") return
    const rate = currencyOf(currencies, currencyId).rate
    if (rate !== null) form.setValue("rate", trimRate(rate))
  }, [currencyId, currencies, form])

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col [&>*]:shrink-0">
      {refusal && <Refusal className="mb-4">{refusal}</Refusal>}
      <Group>
        <Controller
          control={form.control}
          name="supplier_id"
          render={({ field, fieldState }) => (
            <SupplierPicker
              companyId={companyId}
              value={field.value ? { id: field.value, name: form.getValues("supplier_name") } : null}
              onChange={(item) => {
                field.onChange(item?.id ?? 0)
                form.setValue("supplier_name", item?.name ?? "")
              }}
              error={fieldState.error?.message}
              disabled={pending}
            />
          )}
        />
        <TextRow control={form.control} name="at" label="Vaqt" type="datetime-local" />
        {isMulti(currencies) && <SelectRow control={form.control} name="currency_id" label="Valyuta" options={currencyOptions(currencies)} />}
        {isMulti(currencies) && currencyId !== UZS && (
          <AmountRow control={form.control} name="rate" label={`1 ${currency.code} = ? so'm`} placeholder="kurs" suffix={null} />
        )}
      </Group>

      <LinesField form={form} companyId={companyId} withPrice currencyId={currencyId} pending={pending} />

      <PaymentsField form={form} accounts={accounts} currencies={currencies} documentCurrency={currencyId} total={Number(total)} pending={pending} />

      <Group>
        <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
      </Group>
      {locationName && (
        <Foot>Saqlangach mahsulotlar «{locationName}» qoldig&apos;iga qo&apos;shiladi, to&apos;lanmagan qismi ta&apos;minotchi qarziga yoziladi.</Foot>
      )}
      <MainBar>
        <MainButton type="submit" pending={pending}>
          {submitLabel}
        </MainButton>
      </MainBar>
    </form>
  )
}
