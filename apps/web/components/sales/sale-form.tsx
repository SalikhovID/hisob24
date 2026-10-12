"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { CurrencyField } from "@/components/currency-field"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { FieldGroup } from "@/components/ui/field"
import { LinesField } from "@/components/warehouse/lines-field"
import { PaymentsField } from "@/components/warehouse/payments-field"
import { currencyOf, isMulti, trimRate, useAccounts, useCurrencies, UZS } from "@/lib/currencies"
import { type SaleForm as SaleFormValues, type SaleOutput, saleSchema } from "@/lib/sales"
import { purchaseTotal } from "@/lib/warehouse"
import { CustomerPicker } from "./customer-picker"

// SaleForm is a sale as it is entered or edited (logic/sales.md, 3.1–3.3):
// the customer found by name or phone (none: a retail sale, paid in full
// with it), the moment, the currency and rate (with more than the so'm),
// the lines of products and services with their sale prices, the payments
// into the accounts and a note. The location is the page's. Without a way
// to the customers (withCustomers) the sale is retail alone.
export function SaleForm({
  companyId,
  withCustomers,
  defaults,
  onSubmit,
  submitLabel,
  pending,
  refusal,
}: {
  companyId: number
  withCustomers: boolean
  defaults: SaleFormValues
  onSubmit: (sale: SaleOutput) => void
  submitLabel: string
  pending: boolean
  refusal?: string
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FieldGroup>
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
        {!customerId && <p className="text-sm text-muted-foreground">Chakana sotuv: to&apos;liq to&apos;langan bo&apos;lishi shart</p>}
        <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
        {isMulti(currencies) && <CurrencyField control={form.control} currencyName="currency_id" rateName="rate" currencies={currencies} />}
      </FieldGroup>

      <LinesField form={form} companyId={companyId} withPrice currencyId={currencyId} pending={pending} kinds={["product", "service"]} offer="price" />

      <PaymentsField form={form} accounts={accounts} currencies={currencies} documentCurrency={currencyId} total={Number(total)} pending={pending} />

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
