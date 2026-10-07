"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { ActionTooltip } from "@/components/action-tooltip"
import { iconAction } from "@/components/catalog/icon-action"
import { PendingButton } from "@/components/pending-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import { formatAmount, formatDate } from "@/lib/format"
import { paymentsKey, supplierKey, suppliersKey } from "@/lib/queries"
import type { Payment } from "@/lib/types"

// DeletePaymentButton deletes a payment entered on its own after asking,
// from its row. What is owed grows back by it.
export function DeletePaymentButton({ companyId, payment }: { companyId: number; payment: Payment }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const amount = formatAmount(payment.amount)
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/suppliers/{id}/payments/{paymentId}", { params: { path: { id: payment.supplier_id, paymentId: payment.id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paymentsKey(companyId, payment.supplier_id) })
      queryClient.invalidateQueries({ queryKey: supplierKey(companyId, payment.supplier_id) })
      queryClient.invalidateQueries({ queryKey: suppliersKey(companyId) })
      toast.success("To'lov o'chirildi")
      setConfirming(false)
    },
    onError: (error) => {
      toast.error(error.message)
      setConfirming(false)
    },
  })

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <ActionTooltip label="O'chirish">
        <AlertDialogTrigger render={<Button variant="ghost" size="icon" className={`${iconAction} hover:text-destructive`} aria-label={`O'chirish: ${amount}`} />}>
          <Trash2Icon />
        </AlertDialogTrigger>
      </ActionTooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>To&apos;lovni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>
            {formatDate(payment.paid_on)} kungi {amount} so&apos;m to&apos;lov o&apos;chiriladi. Qayta tiklab bo&apos;lmaydi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg" className="max-sm:h-10">
            Bekor qilish
          </AlertDialogCancel>
          <PendingButton variant="destructive" size="lg" className="max-sm:h-10" pending={remove.isPending} onClick={() => remove.mutate()}>
            O&apos;chirish
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
