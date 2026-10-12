"use client"

import { PlusIcon, XIcon } from "lucide-react"
import { Controller, type FieldPath, type FieldValues, useFieldArray, type UseFormReturn, useWatch } from "react-hook-form"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { convert, currencyOf, useCurrencies } from "@/lib/currencies"
import { formatAmount, formatMoney, unitLabel } from "@/lib/format"
import type { LastPrice } from "@/lib/types"
import { emptyLine, type LineForm, lineAmount, purchaseTotal } from "@/lib/warehouse"
import { ProductPicker } from "./pickers"

// WithLines is a form that holds the lines of a goods document.
type WithLines = { items: LineForm[] }

// LinesField is the lines of a goods document (logic/warehouse.md, 4.1,
// 5.1, 5.3): each a product found by name or SKU, its quantity in its
// unit and, with prices, its price (offered as the last one paid, turned
// into the document's currency) and what the line comes to; under them,
// with prices, what the lines come to. The form's items are LineForm
// rows, whatever else it holds.
export function LinesField<TForm extends WithLines & FieldValues, TOut extends FieldValues>({
  form,
  companyId,
  withPrice,
  currencyId,
  pending,
  heading = "Mahsulotlar",
}: {
  form: UseFormReturn<TForm, unknown, TOut>
  companyId: number
  withPrice: boolean
  currencyId: number
  pending: boolean
  heading?: string
}) {
  // The names of the lines' fields: the form holds them as items.
  const path = (name: string) => name as FieldPath<TForm>
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" as never })
  const items = (useWatch({ control: form.control, name: path("items") }) ?? []) as LineForm[]
  const currencies = useCurrencies()
  const currency = currencyOf(currencies, currencyId)
  const total = purchaseTotal(items)
  const itemsError = form.formState.errors.items
  const linesMessage = (itemsError as { root?: { message?: string }; message?: string } | undefined)?.root?.message ?? (itemsError as { message?: string } | undefined)?.message
  const set = (name: string, value: unknown) => form.setValue(path(name), value as never)

  // offered is a product's last price in the document's currency: as is
  // when the currencies match, turned by the rates in force otherwise.
  const offered = (price: LastPrice | null): string | null => {
    if (!price) return null
    if (price.currency_id === currencyId) return price.amount
    const turned = convert(Number(price.amount), price.currency_id, currencyId, currencies)
    return turned === null ? null : String(turned)
  }

  return (
    <section aria-labelledby="document-lines" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="document-lines" className="text-base font-semibold">
          {heading}
        </h2>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => append(emptyLine() as never)}>
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
            className={
              withPrice
                ? "grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[minmax(0,1fr)_8rem_9rem_minmax(7rem,auto)_2.5rem] md:items-start"
                : "grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[minmax(0,1fr)_9rem_2.5rem] md:items-start"
            }
          >
            <Controller
              control={form.control}
              name={path(`items.${index}.product_id`)}
              render={({ field, fieldState }) => (
                <ProductPicker
                  companyId={companyId}
                  value={
                    field.value
                      ? // The unit stands at the quantity, not in the chip.
                        { id: Number(field.value), name: current?.product_name ?? "", unit: current?.unit ?? null, last_price: null }
                      : null
                  }
                  onChange={(pick) => {
                    field.onChange(pick?.id ?? 0)
                    set(`items.${index}.product_name`, pick?.name ?? "")
                    set(`items.${index}.unit`, pick?.unit ?? null)
                    // The price it was last bought at is offered; one typed stays.
                    const price = withPrice ? offered(pick?.last_price ?? null) : null
                    if (price !== null && !form.getValues(path(`items.${index}.price`))) set(`items.${index}.price`, price)
                  }}
                  error={fieldState.error?.message}
                  disabled={pending}
                />
              )}
            />
            <div className="relative">
              <TextField control={form.control} name={path(`items.${index}.quantity`)} label="Miqdor" inputMode="decimal" autoComplete="off" className={current?.unit ? "pr-14" : undefined} />
              {current?.unit && (
                <span className="pointer-events-none absolute top-[calc(1.25rem+0.5rem)] right-3 inline-flex h-9 items-center text-sm text-muted-foreground">{unitLabel(current.unit)}</span>
              )}
            </div>
            {withPrice && <TextField control={form.control} name={path(`items.${index}.price`)} label="Narx" inputMode="decimal" autoComplete="off" />}
            {withPrice && (
              <div className="flex flex-col gap-2 text-sm">
                <span className="text-[0.8125rem] leading-5 font-medium">Summa</span>
                <span className="inline-flex h-9 items-center tabular-nums">{amount === null ? <span className="text-muted-foreground">—</span> : formatAmount(amount)}</span>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive md:mt-7"
              aria-label={`${index + 1}-qatorni olib tashlash`}
              disabled={pending}
              onClick={() => remove(index)}
            >
              <XIcon />
            </Button>
          </fieldset>
        )
      })}
      {linesMessage && <FieldError errors={[{ message: linesMessage }]} />}
      {withPrice && (
        <p className="flex items-baseline justify-end gap-2 text-sm">
          <span className="text-muted-foreground">Jami</span>
          <span className="text-base font-semibold tabular-nums">{formatMoney(total, currency)}</span>
        </p>
      )}
    </section>
  )
}
