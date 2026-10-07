"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { PencilIcon, PlusIcon } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { iconAction } from "@/components/catalog/icon-action"
import { PendingButton } from "@/components/pending-button"
import { Refusal } from "@/components/refusal"
import { TextField } from "@/components/text-field"
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
import { FieldGroup } from "@/components/ui/field"
import { api, call } from "@/lib/api"
import { formatAmount } from "@/lib/format"
import { paymentsKey, supplierKey, suppliersKey } from "@/lib/queries"
import type { Payment } from "@/lib/types"
import { type PaymentForm, type PaymentOutput, paymentDefaults, paymentSchema, today } from "@/lib/warehouse"

// PaymentDialog enters a payment to the supplier (logic/warehouse.md,
// section 6): an amount, a day (today unless another is chosen) and a
// note; or saves the one given, entered on its own, with other fields.
export function PaymentDialog({
  companyId,
  supplierId,
  payment,
  iconOnly = false,
}: {
  companyId: number
  supplierId: number
  payment?: Payment
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const form = useForm<PaymentForm, unknown, PaymentOutput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: paymentDefaults(payment, today()),
  })
  const save = useMutation({
    mutationFn: (fields: PaymentOutput) =>
      payment
        ? call(api.PUT("/app/suppliers/{id}/payments/{paymentId}", { params: { path: { id: supplierId, paymentId: payment.id } }, body: fields }))
        : call(api.POST("/app/suppliers/{id}/payments", { params: { path: { id: supplierId } }, body: fields })),
    onSuccess: () => {
      // What is owed changes with every payment.
      queryClient.invalidateQueries({ queryKey: paymentsKey(companyId, supplierId) })
      queryClient.invalidateQueries({ queryKey: supplierKey(companyId, supplierId) })
      queryClient.invalidateQueries({ queryKey: suppliersKey(companyId) })
      toast.success(payment ? "To'lov saqlandi" : "To'lov qo'shildi")
      setOpen(false)
    },
  })

  // Every opening starts from the payment as it is now, or from an empty
  // form dated today.
  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      form.reset(paymentDefaults(payment, today()))
      save.reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {payment && iconOnly ? (
        <ActionTooltip label="Tahrirlash">
          <DialogTrigger render={<Button variant="ghost" size="icon" className={iconAction} aria-label={`Tahrirlash: ${formatAmount(payment.amount)}`} />}>
            <PencilIcon />
          </DialogTrigger>
        </ActionTooltip>
      ) : (
        <DialogTrigger render={<Button size={payment ? "sm" : "lg"} variant={payment ? "outline" : "default"} className="px-3.5" />}>
          {payment ? <PencilIcon /> : <PlusIcon />}
          {payment ? "Tahrirlash" : "To'lov qo'shish"}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{payment ? "To'lovni tahrirlash" : "To'lov qo'shish"}</DialogTitle>
          <DialogDescription>Summa va sana majburiy; izoh ixtiyoriy.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((fields) => save.mutate(fields))} noValidate className="space-y-4">
          <FieldGroup>
            <TextField control={form.control} name="amount" label="Summa" inputMode="decimal" autoComplete="off" />
            <TextField control={form.control} name="paid_on" label="Sana" type="date" />
            <TextField control={form.control} name="note" label="Izoh" autoComplete="off" />
          </FieldGroup>
          {save.isError && <Refusal>{save.error.message}</Refusal>}
          <DialogFooter>
            <PendingButton type="submit" size="lg" className="px-3.5 max-sm:h-10" pending={save.isPending}>
              {payment ? "Saqlash" : "Qo'shish"}
            </PendingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
