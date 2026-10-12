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
import { currencyOf, useCurrencies } from "@/lib/currencies"
import { formatAmount, formatDateTime, formatMoney } from "@/lib/format"
import { forgetParty, type Party } from "@/lib/party"
import type { PaymentFields } from "@/lib/warehouse"

// DeletePaymentButton deletes a payment entered on its own after asking,
// from its row in the supplier's or the customer's statement. What is owed
// changes back by it.
export function DeletePaymentButton({ party = "supplier", companyId, partyId, payment }: { party?: Party; companyId: number; partyId: number; payment: PaymentFields }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const amount = formatAmount(payment.amount)
  const remove = useMutation({
    mutationFn: () =>
      party === "customer"
        ? call(api.DELETE("/app/customers/{id}/payments/{paymentId}", { params: { path: { id: partyId, paymentId: payment.id } } }))
        : call(api.DELETE("/app/suppliers/{id}/payments/{paymentId}", { params: { path: { id: partyId, paymentId: payment.id } } })),
    onSuccess: () => {
      forgetParty(queryClient, party, companyId, partyId)
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
