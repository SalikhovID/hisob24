"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { DateTimeRow } from "@/components/kit/date-sheet"
import { AmountRow, TextRow } from "@/components/kit/form-row"
import { Foot, Group } from "@/components/kit/group"
import { MainBar, MainButton } from "@/components/kit/main-button"
import { SelectRow } from "@/components/kit/picker-sheet"
import { Refusal } from "@/components/refusal"
import { LinesField } from "@/components/warehouse/lines-field"
import { PaymentsField } from "@/components/warehouse/payments-field"
import { currencyOf, currencyOptions, isMulti, trimRate, useAccounts, useCurrencies, UZS } from "@/lib/currencies"
import { type SaleForm as SaleFormValues, type SaleOutput, saleSchema } from "@/lib/sales"
import { purchaseTotal } from "@/lib/warehouse"
import { CustomerPicker } from "./customer-picker"

// SaleForm is a sale as it is entered or edited (logic/sales.md, 3.1–3.3),
// as the prototype's document form: the customer picked in a sheet (none:
// a retail sale, paid in full with it), the moment, the currency and rate
// (with more than the so'm) as rows; the lines of products and services
// with their sale prices as cards; the payments into the accounts; a note;
// what saving does, said under it; the main button in the bar at the
// bottom. The location is the page's (locationName says it). Without a way
// to the customers (withCustomers) the sale is retail alone.
export function SaleForm({
  companyId,
  withCustomers,
  defaults,
  onSubmit,
  submitLabel,
  pending,
  refusal,
  locationName,
}: {
  companyId: number
  withCustomers: boolean
  defaults: SaleFormValues
  onSubmit: (sale: SaleOutput) => void
  submitLabel: string
  pending: boolean
  refusal?: string
  locationName?: string
}) {
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const form = useForm<SaleFormValues, unknown, SaleOutput>({ resolver: zodResolver(saleSchema), defaultValues: defaults })
  const items = useWatch({ control: form.control, name: "items" })
  const customerId = useWatch({ control: form.control, name: "customer_id" })
  const currencyId = Number(useWatch({ control: form.control, name: "currency_id" })) || UZS
  const total = purchaseTotal(items)

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
        {withCustomers && (
          <Controller
            control={form.control}
            name="customer_id"
            render={({ field, fieldState }) => (
              <CustomerPicker
                companyId={companyId}
                value={field.value ? { id: field.value, name: form.getValues("customer_name") } : null}
                onChange={(item) => {
                  field.onChange(item?.id ?? 0)
                  form.setValue("customer_name", item?.name ?? "")
                }}
                error={fieldState.error?.message}
                disabled={pending}
              />
            )}
          />
        )}
        <DateTimeRow control={form.control} name="at" label="Vaqt" />
        {isMulti(currencies) && <SelectRow control={form.control} name="currency_id" label="Valyuta" options={currencyOptions(currencies)} />}
        {isMulti(currencies) && currencyId !== UZS && (
          <AmountRow control={form.control} name="rate" label={`1 ${currency.code} = ? so'm`} placeholder="kurs" suffix={null} />
        )}
      </Group>
      {!customerId && <Foot className="-mt-4">Chakana sotuv: to&apos;liq to&apos;langan bo&apos;lishi shart</Foot>}

      <LinesField form={form} companyId={companyId} withPrice currencyId={currencyId} pending={pending} kinds={["product", "service"]} offer="price" />

      <PaymentsField form={form} accounts={accounts} currencies={currencies} documentCurrency={currencyId} total={Number(total)} pending={pending} />

      <Group>
        <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
      </Group>
      {locationName && (
        <Foot>Saqlangach mahsulotlar «{locationName}» qoldig&apos;idan chiqadi, to&apos;lanmagan qismi mijoz qarziga yoziladi.</Foot>
      )}
      <MainBar>
        <MainButton type="submit" pending={pending}>
          {submitLabel}
        </MainButton>
      </MainBar>
    </form>
  )
}
