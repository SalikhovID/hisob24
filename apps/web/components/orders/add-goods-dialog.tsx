"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Group } from "@/components/kit/group"
import { MainButton } from "@/components/kit/main-button"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LineInput } from "@/components/warehouse/lines-field"
import { ProductPicker } from "@/components/warehouse/pickers"
import { unitLabel } from "@/lib/format"
import { goodsUpdate, orderName } from "@/lib/orders"
import { moveLineSchema } from "@/lib/stock"
import type { OrderDetail, OrderType } from "@/lib/types"
import { emptyLine, type LineForm } from "@/lib/warehouse"
import { useUpdateOrder } from "./use-update-order"

const goodsSchema = z.object({ line: moveLineSchema })

// AddGoodsDialog adds one product or service to an order from its page
// (2026-11-15): picked among the live ones (one the order has is not taken
// twice), its quantity in its unit. It is saved at once with the rest of the
// order as it stands (goodsUpdate); the API's refusal (too little in stock)
// is said in the dialog.
export function AddGoodsDialog({
  companyId,
  order,
  type,
  open,
  onOpenChange,
}: {
  companyId: number
  order: OrderDetail
  type: OrderType
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const form = useForm<{ line: LineForm }, unknown, z.output<typeof goodsSchema>>({
    resolver: zodResolver(goodsSchema),
    defaultValues: { line: emptyLine() },
  })
  const line = useWatch({ control: form.control, name: "line" })
  const save = useUpdateOrder(companyId, order)
  const submit = ({ line: added }: z.output<typeof goodsSchema>) =>
    save.mutate(
      goodsUpdate(order, type, [
        ...order.items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        { product_id: added.product_id, quantity: added.quantity },
      ]),
      {
        onSuccess: () => {
          toast.success("Tovar qo'shildi")
          onOpenChange(false)
        },
      },
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tovar qo&apos;shish</DialogTitle>
          <DialogDescription>{orderName(order.number)}</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit(submit)}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <Group>
            <Controller
              control={form.control}
              name="line.product_id"
              render={({ field, fieldState }) => (
                <ProductPicker
                  companyId={companyId}
                  kinds={["product", "service"]}
                  used={order.items.map((item) => item.product_id)}
                  value={field.value ? { id: Number(field.value), name: line.product_name, unit: line.unit, last_price: null, price: null } : null}
                  onChange={(pick) => {
                    field.onChange(pick?.id ?? 0)
                    form.setValue("line.product_name", pick?.name ?? "")
                    form.setValue("line.unit", pick?.unit ?? null)
                  }}
                  error={fieldState.error?.message}
                  disabled={save.isPending}
                />
              )}
            />
            <LineInput control={form.control} name="line.quantity" label="Miqdor" suffix={line.unit ? unitLabel(line.unit) : undefined} disabled={save.isPending} />
          </Group>
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              Qo&apos;shish
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
