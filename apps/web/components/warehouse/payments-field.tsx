"use client"

import { PlusIcon, XIcon } from "lucide-react"
import { type FieldPath, type FieldValues, useFieldArray, type UseFormReturn, useWatch } from "react-hook-form"
import { Foot, Group, Row, SectionHeading } from "@/components/kit/group"
import { SelectRow } from "@/components/kit/picker-sheet"
import { accountCurrency, accountOptions, convert, currencyOf } from "@/lib/currencies"
import { formatMoney } from "@/lib/format"
import type { AppAccount, CompanyCurrency } from "@/lib/types"
import { amountOf, type PaymentLineForm } from "@/lib/warehouse"
import { LineInput } from "./lines-field"

// WithPayments is a form that holds the payment lines of a document.
type WithPayments = { payments: PaymentLineForm[] }

// PaymentsField is the payments entered with a purchase (logic/warehouse.md,
// 4.1) or a sale (logic/sales.md, 3.1) as the prototype's cards: each an
// account picked in a sheet and an amount in the account's currency, with
// «To'liq» to fill it with what is left of the total (in the line's
// currency by the rates in force); a row adds one; what is left is said
// under them.
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
    <section aria-labelledby="document-payments">
      <SectionHeading>
        <span id="document-payments">{heading}</span>
      </SectionHeading>
      {fields.map((line, index) => {
        const current = lines[index]
        const own = accountCurrency(accounts, currencies, Number(current?.bank_account_id))
        return (
          <fieldset key={line.id} aria-label={`${index + 1}-to'lov`} data-slot="payment-card" className="mb-2.5 min-w-0 overflow-hidden rounded-[24px] surface">
            <div className="flex items-center">
              <div className="min-w-0 flex-1">
                <SelectRow
                  control={form.control}
                  name={path(`payments.${index}.bank_account_id`)}
                  label="Akkaunt"
                  options={accountOptions(accounts, currencies, Number(current?.bank_account_id))}
                  disabled={pending}
                />
              </div>
              <button
                type="button"
                aria-label={`${index + 1}-to'lovni olib tashlash`}
                disabled={pending}
                onClick={() => remove(index)}
                className="mr-1.5 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <XIcon aria-hidden="true" strokeWidth={2.4} className="size-[18px]" />
              </button>
            </div>
            <div className="flex items-center border-t-[0.5px] border-border pr-3">
              <div className="min-w-0 flex-1">
                <LineInput control={form.control} name={path(`payments.${index}.amount`)} label="Summa" suffix={own.symbol} disabled={pending} />
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => fill(index)}
                className="h-[34px] shrink-0 rounded-full bg-primary-soft px-3.5 text-md font-semibold text-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                To&apos;liq
              </button>
            </div>
          </fieldset>
        )
      })}
      <Group className="mb-3.5">
        <Row
          variant="link"
          onClick={pending ? undefined : () => append({ bank_account_id: first ? String(first.id) : "", amount: "" } as never)}
          title={
            <span className="flex items-center gap-2">
              <PlusIcon aria-hidden="true" strokeWidth={2.6} className="size-5" />
              To&apos;lov qo&apos;shish
            </span>
          }
        />
      </Group>
      {fields.length > 0 && <Foot className="-mt-2">Qolgan: {formatMoney(String(remaining), currency)}</Foot>}
    </section>
  )
}
