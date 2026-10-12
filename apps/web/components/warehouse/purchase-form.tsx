"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { CurrencyField } from "@/components/currency-field"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { FieldGroup } from "@/components/ui/field"
import { currencyOf, isMulti, trimRate, useAccounts, useCurrencies, UZS } from "@/lib/currencies"
import { type PurchaseForm as PurchaseFormValues, type PurchaseOutput, purchaseSchema, purchaseTotal } from "@/lib/warehouse"
import { LinesField } from "./lines-field"
import { PaymentsField } from "./payments-field"
import { SupplierPicker } from "./pickers"

// PurchaseForm is a purchase as it is entered or edited (logic/warehouse.md,
// 4.1–4.3): the supplier found by name, the moment, the currency and rate
// (with more than the so'm), the lines with their prices (LinesField), the
// payments out of the accounts and a note. The location is the page's.
export function PurchaseForm({
  companyId,
  defaults,
  onSubmit,
  submitLabel,
  pending,
  refusal,
}: {
  companyId: number
  defaults: PurchaseFormValues
  onSubmit: (purchase: PurchaseOutput) => void
  submitLabel: string
  pending: boolean
  refusal?: string
}) {
  const currencies = useCurrencies()
  const accounts = useAccounts()
  const form = useForm<PurchaseFormValues, unknown, PurchaseOutput>({ resolver: zodResolver(purchaseSchema), defaultValues: defaults })
  const items = form.watch("items")
  const currencyId = Number(form.watch("currency_id")) || UZS
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
        <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
        {isMulti(currencies) && <CurrencyField control={form.control} currencyName="currency_id" rateName="rate" currencies={currencies} />}
      </FieldGroup>

      <LinesField form={form} companyId={companyId} withPrice currencyId={currencyId} pending={pending} />

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
