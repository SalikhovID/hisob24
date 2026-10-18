"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { MainButton } from "@/components/kit/main-button"
import { SheetForm } from "@/components/kit/sheet-form"
import { Refusal } from "@/components/refusal"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { api, call } from "@/lib/api"
import { forgetOrderMoney } from "@/lib/order-money"
import { orderHistoryKey, orderKey, ordersKey } from "@/lib/queries"
import { type OrderForm, type OrderOutput, orderDefaults, orderSchema } from "@/lib/orders"
import type { CustomerDropdown, Member, OrderDetail, OrderStage, OrderType } from "@/lib/types"
import { FormSection, LinkedCustomerCard, MoneySection, OrderFields } from "./order-form"

// EditOrderDialog saves an order with another deadline, stage, assignee,
// answers, price and goods (its payments are entered on their own). Its type and its customer were chosen when it was entered
// and stay: the dialog says so, shows the customer and asks the fields of
// that type. An answer left empty is taken away.
export function EditOrderDialog({
  companyId,
  order,
  type,
  stages,
  members,
  dropdowns,
  canPickProducts,
  locationName,
  open: openGiven,
  onOpenChange,
}: {
  companyId: number
  order: OrderDetail
  type: OrderType
  stages: OrderStage[]
  members: Member[]
  dropdowns: CustomerDropdown[]
  // canPickProducts says whether the member may pick the goods (products.view).
  canPickProducts: boolean
  locationName?: string
  // open, with onOpenChange, opens the dialog from outside (the order's
  // «Tahrirlash» tile): it has no button then, and every mounting starts
  // from the order as it is now.
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [openOwn, setOpenOwn] = useState(false)
  const controlled = openGiven !== undefined
  const open = controlled ? openGiven : openOwn
  const setOpen = (next: boolean) => (controlled ? onOpenChange?.(next) : setOpenOwn(next))
  const queryClient = useQueryClient()
  const form = useForm<OrderForm, unknown, OrderOutput>({
    resolver: zodResolver(orderSchema(type, null, order.customer.id)),
    defaultValues: orderDefaults(type, null, null, order),
  })
  const save = useMutation({
    mutationFn: (edited: OrderOutput) =>
      call(
        api.PUT("/app/orders/{id}", {
          params: { path: { id: order.id } },
          body: {
            deadline: edited.deadline,
            stage_id: edited.stage_id,
            assignee_phone: edited.assignee_phone,
            values: edited.values,
            amount: edited.amount,
            currency_id: edited.currency_id,
            rate: edited.rate,
            items: edited.items,
          },
        }),
      ),
    onSuccess: (saved) => {
      // The page shows the answer at once; the lists and the history ask
      // again, and so does what the money touches.
      queryClient.setQueryData(orderKey(companyId, order.id), saved)
      queryClient.invalidateQueries({ queryKey: ordersKey(companyId) })
      queryClient.invalidateQueries({ queryKey: orderHistoryKey(companyId, order.id) })
      forgetOrderMoney(queryClient, companyId, order.id, order.customer.id)
      toast.success("Buyurtma saqlandi")
      setOpen(false)
    },
  })

  // Every opening starts from the order as it is now.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(orderDefaults(type, null, null, order))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {!controlled && (
        <DialogTrigger render={<Button size="lg" className="px-3.5" />}>
          <PencilIcon />
          Tahrirlash
        </DialogTrigger>
      )}
      <DialogContent tall>
        <DialogHeader>
          <DialogTitle>Buyurtmani tahrirlash</DialogTitle>
          <DialogDescription>{type.name} · mijoz va tur o&apos;zgarmaydi</DialogDescription>
        </DialogHeader>
        <SheetForm onSubmit={form.handleSubmit((edited) => save.mutate(edited))}>
          {save.isError && <Refusal className="mb-4">{save.error.message}</Refusal>}
          <FormSection legend="Mijoz">
            <LinkedCustomerCard name={order.customer.name} phone={order.customer.phone} href={`/customers/${order.customer.id}`} />
          </FormSection>
          <FormSection legend="Buyurtma">
            <OrderFields
              control={form.control}
              type={type}
              stages={stages}
              members={members}
              dropdowns={dropdowns}
              locationId={order.location_id}
              order={order}
            />
          </FormSection>
          <FormSection legend="Narx">
            <MoneySection form={form} companyId={companyId} withPayments={false} canPickProducts={canPickProducts} locationName={locationName} />
          </FormSection>
          <DialogFooter>
            <MainButton type="submit" pending={save.isPending}>
              Saqlash
            </MainButton>
          </DialogFooter>
        </SheetForm>
      </DialogContent>
    </Dialog>
  )
}
