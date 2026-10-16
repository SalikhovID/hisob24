"use client"

import { PlusIcon, XIcon } from "lucide-react"
import { useId } from "react"
import { type Control, Controller, type FieldPath, type FieldValues, useFieldArray, type UseFormReturn, useWatch } from "react-hook-form"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { convert, currencyOf, useCurrencies } from "@/lib/currencies"
import { formatAmount, formatMoney, unitLabel } from "@/lib/format"
import type { LastPrice, ProductKind } from "@/lib/types"
import { cn } from "@/lib/utils"
import { emptyLine, type LineForm, lineAmount, purchaseTotal } from "@/lib/warehouse"
import { type Offer, ProductPicker } from "./pickers"

// WithLines is a form that holds the lines of a goods document.
type WithLines = { items: LineForm[] }

// LineInput is a number in a line's card (its quantity, its price): the
// name small over the input, the unit beside it, the error under it.
export function LineInput<T extends FieldValues, TOut extends FieldValues>({
  control,
  name,
  label,
  suffix,
  disabled,
}: {
  control: Control<T, unknown, TOut>
  name: FieldPath<T>
  label: string
  suffix?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div data-invalid={fieldState.invalid || undefined} className="group min-w-0 px-4 py-2 [&+&]:border-l-[0.5px] [&+&]:border-border">
          <label htmlFor={id} className="block text-sm text-muted-foreground group-data-invalid:text-destructive">
            {label}
          </label>
          <span className="flex items-center gap-2">
            <input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              disabled={disabled}
              aria-invalid={fieldState.invalid || undefined}
              aria-describedby={fieldState.error ? `${id}-error` : undefined}
              className="h-8 min-w-0 flex-1 bg-transparent text-base text-foreground tabular-nums outline-none placeholder:text-muted-foreground/80"
              {...field}
              value={field.value ?? ""}
            />
            {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
          </span>
          {fieldState.error && (
            <p id={`${id}-error`} role="alert" className="pt-1 text-xs text-destructive">
              {fieldState.error.message}
            </p>
          )}
        </div>
      )}
    />
  )
}

// LinesField is the lines of a goods document (logic/warehouse.md, 4.1,
// 5.1, 5.3) as the prototype's cards: each a product picked in a sheet (one
// of another line is not taken twice), its quantity in its unit and, with
// prices, its price (offered as the last one paid, turned into the
// document's currency) and what the line comes to; a row adds a line, a
// lone line is not taken away; under them, with prices, what the lines
// come to. The form's items are LineForm rows, whatever else it holds.
export function LinesField<TForm extends WithLines & FieldValues, TOut extends FieldValues>({
  form,
  companyId,
  withPrice,
  currencyId,
  pending,
  heading = "Mahsulotlar",
  kinds,
  offer = "last_price",
}: {
  form: UseFormReturn<TForm, unknown, TOut>
  companyId: number
  withPrice: boolean
  currencyId: number
  pending: boolean
  heading?: string
  // kinds are what the picker offers (the products alone unless told);
  // offer is the price it offers for a line: the last bought or the sale price.
  kinds?: readonly ProductKind[]
  offer?: Offer
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
  const chosen = items.map((item) => Number(item?.product_id) || 0).filter((id) => id > 0)

  // offered is a product's last price in the document's currency: as is
  // when the currencies match, turned by the rates in force otherwise.
  const offered = (price: LastPrice | null): string | null => {
    if (!price) return null
    if (price.currency_id === currencyId) return price.amount
    const turned = convert(Number(price.amount), price.currency_id, currencyId, currencies)
    return turned === null ? null : String(turned)
  }

  return (
    <section aria-labelledby="document-lines">
      <SectionHeading hint={`${fields.length} qator`}>
        <span id="document-lines">{heading}</span>
      </SectionHeading>
      {fields.map((line, index) => {
        const current = items[index]
        const amount = current ? lineAmount(current.quantity, current.price) : null
        const unit = current?.unit ? unitLabel(current.unit) : undefined
        return (
          <fieldset key={line.id} aria-label={`${index + 1}-qator`} data-slot="line-card" className="mb-2.5 min-w-0 overflow-hidden rounded-[24px] surface">
            <div className="flex items-center">
              <div className="min-w-0 flex-1">
                <Controller
                  control={form.control}
                  name={path(`items.${index}.product_id`)}
                  render={({ field, fieldState }) => (
                    <ProductPicker
                      companyId={companyId}
                      kinds={kinds}
                      offer={offer}
                      used={chosen}
                      value={field.value ? { id: Number(field.value), name: current?.product_name ?? "", unit: current?.unit ?? null, last_price: null, price: null } : null}
                      onChange={(pick) => {
                        field.onChange(pick?.id ?? 0)
                        set(`items.${index}.product_name`, pick?.name ?? "")
                        set(`items.${index}.unit`, pick?.unit ?? null)
                        // The price offered (the last bought, or the sale price) is
                        // put in; one typed stays.
                        const price = withPrice ? offered((offer === "price" ? pick?.price : pick?.last_price) ?? null) : null
                        if (price !== null && !form.getValues(path(`items.${index}.price`))) set(`items.${index}.price`, price)
                      }}
                      error={fieldState.error?.message}
                      disabled={pending}
                    />
                  )}
                />
              </div>
              {fields.length > 1 && (
                <button
                  type="button"
                  aria-label={`${index + 1}-qatorni olib tashlash`}
                  disabled={pending}
                  onClick={() => remove(index)}
                  className="mr-1.5 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <XIcon aria-hidden="true" strokeWidth={2.4} className="size-[18px]" />
                </button>
              )}
            </div>
            <div className={cn("grid border-t-[0.5px] border-border", withPrice ? "grid-cols-2" : "grid-cols-1")}>
              <LineInput control={form.control} name={path(`items.${index}.quantity`)} label="Miqdor" suffix={unit} disabled={pending} />
              {withPrice && <LineInput control={form.control} name={path(`items.${index}.price`)} label="Narx" suffix={currency.symbol} disabled={pending} />}
            </div>
            {withPrice && (
              <p className="flex justify-between border-t-[0.5px] border-border px-4 py-2.5 text-md text-muted-foreground">
                <span>Summa</span>
                <b className="font-semibold text-foreground tabular-nums">{amount === null ? "—" : formatAmount(amount)}</b>
              </p>
            )}
          </fieldset>
        )
      })}
      <Group className="mb-3.5">
        <Row
          variant="link"
          onClick={pending ? undefined : () => append(emptyLine() as never)}
          title={
            <span className="flex items-center gap-2">
              <PlusIcon aria-hidden="true" strokeWidth={2.6} className="size-5" />
              Qator qo&apos;shish
            </span>
          }
        />
      </Group>
      {linesMessage && (
        <p role="alert" className="-mt-2 mb-3.5 px-4 text-sm text-destructive">
          {linesMessage}
        </p>
      )}
      {withPrice && (
        <p className="mb-6 flex items-baseline justify-between gap-2 rounded-group surface px-4 py-3.5 text-base">
          <span className="text-muted-foreground">Jami</span>
          <b className="text-lg font-semibold tabular-nums">{formatMoney(total, currency)}</b>
        </p>
      )}
    </section>
  )
}
