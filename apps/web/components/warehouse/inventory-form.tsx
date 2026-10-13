"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, XIcon } from "lucide-react"
import { useEffect } from "react"
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form"
import { TextRow } from "@/components/kit/form-row"
import { Group, Row, SectionHeading } from "@/components/kit/group"
import { MainBar, MainButton } from "@/components/kit/main-button"
import { Refusal } from "@/components/refusal"
import { formatQuantity, unitLabel } from "@/lib/format"
import { useStockAt } from "@/lib/queries"
import { type CountLineForm, differenceOf, emptyCount, type InventoryForm as InventoryFormValues, type InventoryOutput, inventorySchema, signedQuantity } from "@/lib/stock"
import type { StockRow } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toISO } from "@/lib/warehouse"
import { LineInput } from "./lines-field"
import { ProductPicker } from "./pickers"

// InventoryForm is a count of the current location as it is entered or
// edited (logic/warehouse.md, 5.2), as the prototype's document form: the
// moment as a row; the lines as cards (a product picked in a sheet, or
// every product in stock at once; what the journal expected at the moment,
// what was counted, the difference); a note; the main button in the bar at
// the bottom. The stock
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

  const chosen = items.map((item) => item?.product_id ?? 0).filter((id) => id > 0)
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-1 flex-col [&>*]:shrink-0">
      {refusal && <Refusal className="mb-4">{refusal}</Refusal>}
      <Group>
        <TextRow control={form.control} name="at" label="Vaqt" type="datetime-local" />
      </Group>

      <section aria-labelledby="inventory-lines">
        <SectionHeading
          action={
            <button type="button" disabled={pending || !stock.data} onClick={() => stock.data && addAll(stock.data)}>
              Hammasini qo&apos;shish
            </button>
          }
        >
          <span id="inventory-lines">Mahsulotlar</span>
        </SectionHeading>
        {fields.map((line, index) => {
          const current = items[index]
          const difference = current?.product_id ? differenceOf(current.expected || "0", current.counted) : null
          return (
            <fieldset key={line.id} aria-label={`${index + 1}-qator`} data-slot="line-card" className="mb-2.5 min-w-0 overflow-hidden rounded-[20px] bg-card">
              <div className="flex items-center">
                <div className="min-w-0 flex-1">
                  <Controller
                    control={form.control}
                    name={`items.${index}.product_id`}
                    render={({ field, fieldState }) => (
                      <ProductPicker
                        companyId={companyId}
                        used={chosen}
                        value={field.value ? { id: field.value, name: current?.product_name ?? "", unit: current?.unit ?? null, last_price: null, price: null } : null}
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
              <div className="grid grid-cols-2 border-t-[0.5px] border-border">
                <div className="min-w-0 px-4 py-2">
                  <span className="block text-sm text-muted-foreground">Tizim</span>
                  <span className="flex h-8 items-center text-base tabular-nums">
                    {current?.product_id ? formatQuantity(current.expected || "0", current.unit) : <span className="text-muted-foreground">—</span>}
                  </span>
                </div>
                <LineInput control={form.control} name={`items.${index}.counted`} label="Sanalgan" suffix={current?.unit ? unitLabel(current.unit) : undefined} disabled={pending} />
              </div>
              <p className="flex justify-between border-t-[0.5px] border-border px-4 py-2.5 text-md text-muted-foreground">
                <span>Farq</span>
                <b className={cn("font-semibold text-foreground tabular-nums", difference?.startsWith("-") && "text-destructive", difference && Number(difference) > 0 && "text-positive")}>
                  {difference === null ? "—" : signedQuantity(difference, current?.unit ?? null)}
                </b>
              </p>
            </fieldset>
          )
        })}
        <Group className="mb-3.5">
          <Row
            variant="link"
            onClick={pending ? undefined : () => append(emptyCount())}
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
      </section>

      <Group>
        <TextRow control={form.control} name="note" label="Izoh" placeholder="ixtiyoriy" autoComplete="off" />
      </Group>
      <MainBar>
        <MainButton type="submit" pending={pending}>
          {submitLabel}
        </MainButton>
      </MainBar>
    </form>
  )
}
