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
import type { OpeningFields } from "@/lib/stock"

// DeleteOpeningDialog asks whether to delete an opening debt or advance,
// and does: the supplier's or the customer's statement opens it from the
// balance's sheet of actions. What is owed changes back by it.
export function DeleteOpeningDialog({
  party = "supplier",
  companyId,
  partyId,
  opening,
  open,
  onOpenChange,
}: {
  party?: Party
  companyId: number
  partyId: number
  opening: OpeningFields
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const remove = useMutation({
    mutationFn: () =>
      party === "customer"
        ? call(api.DELETE("/app/customers/{id}/openings/{openingId}", { params: { path: { id: partyId, openingId: opening.id } } }))
        : call(api.DELETE("/app/suppliers/{id}/openings/{openingId}", { params: { path: { id: partyId, openingId: opening.id } } })),
    onSuccess: () => {
      forgetParty(queryClient, party, companyId, partyId)
      toast.success("Hujjat o'chirildi")
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
          <AlertDialogTitle>Hujjatni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>
            {opening.kind === "debt" ? "Boshlang'ich qarz" : "Boshlang'ich avans"} {formatMoney(opening.amount, currencyOf(currencies, opening.currency_id))} ({formatDateTime(opening.at)}) o&apos;chiriladi. Qayta tiklab
            bo&apos;lmaydi.
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
