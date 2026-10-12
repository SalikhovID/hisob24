"use client"

import { PlusIcon, XIcon } from "lucide-react"
import { type FieldPath, type FieldValues, useFieldArray, type UseFormReturn, useWatch } from "react-hook-form"
import { SelectField } from "@/components/select-field"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { accountCurrency, accountOptions, convert, currencyOf } from "@/lib/currencies"
import { formatMoney } from "@/lib/format"
import type { AppAccount, CompanyCurrency } from "@/lib/types"
import { amountOf, type PaymentLineForm } from "@/lib/warehouse"

// PaymentsField is the payments entered with a purchase (logic/warehouse.md,
// 4.1) or a sale (logic/sales.md, 3.1): lines of an account and an amount
// in the account's currency.
// «To'liq» fills a line with what is left of the total, in the line's
// currency by the rates in force; what is left shows under the lines.
// WithPayments is a form that holds the payment lines of a document.
type WithPayments = { payments: PaymentLineForm[] }

export function PaymentsField<TForm extends WithPayments & FieldValues, TOut extends FieldValues>({
  form,
  accounts,
  currencies,
  documentCurrency,
  total,
  pending,
  heading = "To'lovlar",
}: {
  form: UseFormReturn<TForm, unknown, TOut>
  accounts: readonly AppAccount[]
  currencies: readonly CompanyCurrency[]
  documentCurrency: number
  total: number
  pending: boolean
  heading?: string
}) {
  const path = (name: string) => name as FieldPath<TForm>
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "payments" as never })
  const lines = (useWatch({ control: form.control, name: path("payments") }) ?? []) as PaymentLineForm[]
  const currency = currencyOf(currencies, documentCurrency)
  // What a line comes to in the document's currency; 0 while a rate is missing.
  const inDocument = (line: { bank_account_id: string; amount: string }) =>
    convert(amountOf(line.amount), accountCurrency(accounts, currencies, Number(line.bank_account_id)).id, documentCurrency, currencies) ?? 0
  const paid = lines.reduce((sum, line) => sum + inDocument(line), 0)
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100)
  const first = accounts.find((a) => a.is_active)
  // fill puts what is left (counting the other lines) into the line, in
  // its account's currency.
  const fill = (index: number) => {
    const line = lines[index]
    if (!line) return
    const left = total - (paid - inDocument(line))
    const own = accountCurrency(accounts, currencies, Number(line.bank_account_id)).id
    const amount = convert(Math.max(0, left), documentCurrency, own, currencies)
    form.setValue(path(`payments.${index}.amount`), (amount === null ? "" : String(amount)) as never, { shouldDirty: true })
  }

  return (
    <section aria-labelledby="document-payments" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="document-payments" className="text-base font-semibold">
          {heading}
        </h2>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => append({ bank_account_id: first ? String(first.id) : "", amount: "" } as never)}>
          <PlusIcon />
          To&apos;lov qo&apos;shish
        </Button>
      </div>
      {fields.map((line, index) => {
        const current = lines[index]
        return (
          <fieldset key={line.id} aria-label={`${index + 1}-to'lov`} className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[minmax(0,1fr)_10rem_auto_2.5rem] md:items-start">
            <SelectField
              control={form.control}
              name={path(`payments.${index}.bank_account_id`)}
              label="Akkaunt"
              placeholder="Tanlang"
              options={accountOptions(accounts, currencies, Number(current?.bank_account_id))}
            />
            <TextField control={form.control} name={path(`payments.${index}.amount`)} label="Summa" inputMode="decimal" autoComplete="off" />
            <Button type="button" variant="outline" className="h-9 md:mt-7" disabled={pending} onClick={() => fill(index)}>
              To&apos;liq
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive md:mt-7"
              aria-label={`${index + 1}-to'lovni olib tashlash`}
              onClick={() => remove(index)}
            >
              <XIcon />
            </Button>
          </fieldset>
        )
      })}
      {fields.length > 0 && (
        <p className="flex items-baseline justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Qolgan</span>
          <span className="font-medium tabular-nums">{formatMoney(String(remaining), currency)}</span>
        </p>
      )}
    </section>
  )
}
