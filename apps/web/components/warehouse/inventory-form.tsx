"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ListPlusIcon, PlusIcon, XIcon } from "lucide-react"
import { useEffect } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
import { Button } from "@/components/ui/button"
import { FieldError, FieldGroup } from "@/components/ui/field"
import { formatQuantity, unitLabel } from "@/lib/format"
import { useStockAt } from "@/lib/queries"
import { type CountLineForm, differenceOf, emptyCount, type InventoryForm as InventoryFormValues, type InventoryOutput, inventorySchema, signedQuantity } from "@/lib/stock"
import type { StockRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toISO } from "@/lib/warehouse"
import { ProductPicker } from "./pickers"

// InventoryForm is a count of the current location as it is entered or
// edited (logic/warehouse.md, 5.2): the moment, the lines (a product found
// by name, or every product in stock at once; what the journal expected at
// the moment, what was counted, the difference) and a note. The stock
// expected follows the moment typed; an inventory being edited is counted
// without its own moves (excludeId).
export function InventoryForm({
  companyId,
  locationId,
  excludeId = 0,
  defaults,
  onSubmit,
  submitLabel,
  pending,
  refusal,
}: {
  companyId: number
  locationId: number
  excludeId?: number
  defaults: InventoryFormValues
  onSubmit: (inventory: InventoryOutput) => void
  submitLabel: string
  pending: boolean
  refusal?: string
}) {
  const form = useForm<InventoryFormValues, unknown, InventoryOutput>({ resolver: zodResolver(inventorySchema), defaultValues: defaults })
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" })
  const items = useWatch({ control: form.control, name: "items" }) ?? []
  const at = useWatch({ control: form.control, name: "at" })
  const stock = useStockAt(companyId, locationId, toISO(at), excludeId)
  const expectedOf = (productId: number) => stock.data?.find((row) => row.product_id === productId)?.quantity ?? "0.000"
  const itemsError = form.formState.errors.items
  const linesMessage = itemsError?.root?.message ?? (itemsError as { message?: string } | undefined)?.message

  // The stock expected is counted anew when the moment changes, or when
  // the answer arrives: every line takes what the journal expected then.
  const known = stock.data
  useEffect(() => {
    if (!known) return
    form.getValues("items").forEach((line, index) => {
      if (!line.product_id) return
      const expected = known.find((row) => row.product_id === line.product_id)?.quantity ?? "0.000"
      if (line.expected !== expected) form.setValue(`items.${index}.expected`, expected)
    })
  }, [known, form])

  // addAll puts every product in stock at the moment into the lines, counted
  // as expected, after the lines already there (empty ones aside).
  const addAll = (rows: StockRow[]) => {
    const kept = form.getValues("items").filter((line) => line.product_id)
    const held = new Set(kept.map((line) => line.product_id))
    const added: CountLineForm[] = rows.filter((row) => !held.has(row.product_id)).map((row) => ({ product_id: row.product_id, product_name: row.name, unit: row.unit, expected: row.quantity, counted: row.quantity }))
    replace([...kept, ...added])
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FieldGroup>
        <TextField control={form.control} name="at" label="Vaqt" type="datetime-local" />
      </FieldGroup>

      <section aria-labelledby="inventory-lines" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="inventory-lines" className="text-base font-semibold">
            Mahsulotlar
          </h2>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pending || !stock.data} onClick={() => stock.data && addAll(stock.data)}>
              <ListPlusIcon />
              Hammasini qo&apos;shish
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => append(emptyCount())}>
              <PlusIcon />
              Qator qo&apos;shish
            </Button>
          </div>
        </div>
        {fields.map((line, index) => {
          const current = items[index]
          const difference = current?.product_id ? differenceOf(current.expected || "0", current.counted) : null
          return (
            <fieldset
              key={line.id}
              aria-label={`${index + 1}-qator`}
              className="grid gap-3 rounded-xl border bg-card p-3 md:grid-cols-[minmax(0,1fr)_minmax(6rem,auto)_8rem_minmax(6rem,auto)_2.5rem] md:items-start"
            >
              <Controller
                control={form.control}
                name={`items.${index}.product_id`}
                render={({ field, fieldState }) => (
                  <ProductPicker
                    companyId={companyId}
                    value={field.value ? { id: field.value, name: current?.product_name ?? "", unit: current?.unit ?? null, last_price: null } : null}
                    onChange={(pick) => {
                      field.onChange(pick?.id ?? 0)
                      form.setValue(`items.${index}.product_name`, pick?.name ?? "")
                      form.setValue(`items.${index}.unit`, pick?.unit ?? null)
                      form.setValue(`items.${index}.expected`, pick ? expectedOf(pick.id) : "")
                    }}
                    error={fieldState.error?.message}
                    disabled={pending}
                  />
                )}
              />
              <div className="flex flex-col gap-2 text-sm">
                <span className="text-[0.8125rem] leading-5 font-medium">Tizim</span>
                <span className="inline-flex h-9 items-center tabular-nums">
                  {current?.product_id ? formatQuantity(current.expected || "0", current.unit) : <span className="text-muted-foreground">—</span>}
                </span>
              </div>
              <div className="relative">
                <TextField control={form.control} name={`items.${index}.counted`} label="Sanalgan" inputMode="decimal" autoComplete="off" className={current?.unit ? "pr-14" : undefined} />
                {current?.unit && (
                  <span className="pointer-events-none absolute top-[calc(1.25rem+0.5rem)] right-3 inline-flex h-9 items-center text-sm text-muted-foreground">{unitLabel(current.unit)}</span>
                )}
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <span className="text-[0.8125rem] leading-5 font-medium">Farq</span>
                <span className={cn("inline-flex h-9 items-center tabular-nums", difference?.startsWith("-") && "text-destructive", difference && Number(difference) > 0 && "text-emerald-700 dark:text-emerald-400")}>
                  {difference === null ? <span className="text-muted-foreground">—</span> : signedQuantity(difference, current?.unit ?? null)}
                </span>
              </div>
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
      </section>

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
