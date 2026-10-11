"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, XIcon } from "lucide-react"
import { useEffect } from "react"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { CurrencyField } from "@/components/currency-field"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { convert, currencyOf, isMulti, trimRate, useAccounts, useCurrencies, UZS } from "@/lib/currencies"
import { formatAmount, formatMoney, unitLabel } from "@/lib/format"
import { emptyLine, lineAmount, type PurchaseForm as PurchaseFormValues, type PurchaseOutput, purchaseSchema, purchaseTotal } from "@/lib/warehouse"
import { PaymentsField } from "./payments-field"
import { ProductPicker, SupplierPicker } from "./pickers"

// PurchaseForm is a purchase as it is entered or edited (logic/warehouse.md,
// 4.1–4.3): the supplier found by name, the moment, the currency and rate
// (with more than the so'm), the lines (a product found by name or SKU, its
// quantity in its unit, its price, offered as the last one paid turned into
// the document's currency, and what the line comes to), what the lines
// come to, the payments out of the accounts and a note. The location is the
// page's.
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
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const items = form.watch("items")
  const currencyId = Number(form.watch("currency_id")) || UZS
  const currency = currencyOf(currencies, currencyId)
  const total = purchaseTotal(items)
  const itemsError = form.formState.errors.items
  const linesMessage = itemsError?.root?.message ?? (itemsError as { message?: string } | undefined)?.message

  // Another currency: its standard rate is offered while none is typed.
  useEffect(() => {
    if (currencyId === UZS || form.getValues("rate") !== "") return
    const rate = currencyOf(currencies, currencyId).rate
    if (rate !== null) form.setValue("rate", trimRate(rate))
  }, [currencyId, currencies, form])

  // offered is a product's last price in the document's currency: as is
  // when the currencies match, turned by the rates in force otherwise.
  const offered = (price: { amount: string; currency_id: number } | null): string | null => {
    if (!price) return null
    if (price.currency_id === currencyId) return price.amount
    const turned = convert(Number(price.amount), price.currency_id, currencyId, currencies)
    return turned === null ? null : String(turned)
  }

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

      <section aria-labelledby="purchase-lines" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="purchase-lines" className="text-base font-semibold">
            Mahsulotlar
          </h2>
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine())}>
            <PlusIcon />
            Qator qo&apos;shish
          </Button>
        </div>
        {fields.map((line, index) => {
          const current = items[index]
          const amount = current ? lineAmount(current.quantity, current.price) : null
          return (
            <fieldset
              key={line.id}
              aria-label={`${index + 1}-qator`}
              className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[minmax(0,1fr)_8rem_9rem_minmax(7rem,auto)_2.5rem] md:items-start"
            >
              <Controller
                control={form.control}
                name={`items.${index}.product_id`}
                render={({ field, fieldState }) => (
                  <ProductPicker
                    companyId={companyId}
                    value={
                      field.value
                        ? // The unit stands at the quantity, not in the chip.
                          { id: field.value, name: current?.product_name ?? "", unit: current?.unit ?? null, last_price: null }
                        : null
                    }
                    onChange={(pick) => {
                      field.onChange(pick?.id ?? 0)
                      form.setValue(`items.${index}.product_name`, pick?.name ?? "")
                      form.setValue(`items.${index}.unit`, pick?.unit ?? null)
                      // The price it was last bought at is offered; one typed stays.
                      const price = offered(pick?.last_price ?? null)
                      if (price !== null && !form.getValues(`items.${index}.price`)) form.setValue(`items.${index}.price`, price)
                    }}
                    error={fieldState.error?.message}
                    disabled={pending}
                  />
                )}
              />
              <div className="relative">
                <TextField control={form.control} name={`items.${index}.quantity`} label="Miqdor" inputMode="decimal" autoComplete="off" className={current?.unit ? "pr-14" : undefined} />
                {current?.unit && (
                  <span className="pointer-events-none absolute top-[calc(1.25rem+0.5rem)] right-3 inline-flex h-9 items-center text-sm text-muted-foreground">{unitLabel(current.unit)}</span>
                )}
              </div>
              <TextField control={form.control} name={`items.${index}.price`} label="Narx" inputMode="decimal" autoComplete="off" />
              <div className="flex flex-col gap-2 text-sm">
                <span className="text-[0.8125rem] leading-5 font-medium">Summa</span>
                <span className="inline-flex h-9 items-center tabular-nums">{amount === null ? <span className="text-muted-foreground">—</span> : formatAmount(amount)}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive md:mt-7"
                aria-label={`${index + 1}-qatorni olib tashlash`}
                onClick={() => remove(index)}
              >
                <XIcon />
              </Button>
            </fieldset>
          )
        })}
        {linesMessage && <FieldError errors={[{ message: linesMessage }]} />}
        <p className="flex items-baseline justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Jami</span>
          <span className="text-base font-semibold tabular-nums">{formatMoney(total, currency)}</span>
        </p>
      </section>

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
