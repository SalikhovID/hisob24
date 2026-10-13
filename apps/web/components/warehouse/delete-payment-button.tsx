"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { PendingButton } from "@/components/pending-button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { api, call } from "@/lib/api"
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatDateTime, formatMoney } from "@/lib/format"
import { forgetParty, type Party } from "@/lib/party"
import type { PaymentFields } from "@/lib/warehouse"

// DeletePaymentDialog asks whether to delete a payment entered on its own,
// and does: the supplier's or the customer's statement opens it from the
// payment's sheet of actions. What is owed changes back by it.
export function DeletePaymentDialog({
  party = "supplier",
  companyId,
  partyId,
  payment,
  open,
  onOpenChange,
}: {
  party?: Party
  companyId: number
  partyId: number
  payment: PaymentFields
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const remove = useMutation({
    mutationFn: () =>
      party === "customer"
        ? call(api.DELETE("/app/customers/{id}/payments/{paymentId}", { params: { path: { id: partyId, paymentId: payment.id } } }))
        : call(api.DELETE("/app/suppliers/{id}/payments/{paymentId}", { params: { path: { id: partyId, paymentId: payment.id } } })),
    onSuccess: () => {
      forgetParty(queryClient, party, companyId, partyId)
      toast.success("To'lov o'chirildi")
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(error.message)
      onOpenChange(false)
    },
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>To&apos;lovni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>
            {formatDateTime(payment.at)} dagi {formatMoney(payment.amount, currencyOf(currencies, payment.currency_id))} to&apos;lov o&apos;chiriladi. Qayta tiklab bo&apos;lmaydi.
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
