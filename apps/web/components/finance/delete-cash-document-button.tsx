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
import { financeKindTitle, forgetFinance } from "@/lib/finance"
import { formatDateTime, formatMoney } from "@/lib/format"

// CashDocument is what the button needs of a cash document: which one, of
// which kind (the endpoint is the kind's), its amount and moment (for the
// question).
export type CashDocument = { id: number; kind: "cash_opening" | "expense" | "income" | "money_transfer" | "conversion"; amount: string; currency_id: number; at: string }

// remove deletes the document through its kind's endpoint.
function remove(d: CashDocument) {
  const path = { params: { path: { id: d.id } } }
  switch (d.kind) {
    case "cash_opening":
      return call(api.DELETE("/app/cash-openings/{id}", path))
    case "expense":
    case "income":
      return call(api.DELETE("/app/expenses/{id}", path))
    case "money_transfer":
      return call(api.DELETE("/app/money-transfers/{id}", path))
    case "conversion":
      return call(api.DELETE("/app/conversions/{id}", path))
  }
}

// DeleteCashDocumentDialog asks whether to delete a cash document, and
// does: an account's statement and the expenses' and the transfers' lists
// open it from the document's sheet of actions. What the accounts hold
// changes back by it.
export function DeleteCashDocumentDialog({
  companyId,
  document,
  open,
  onOpenChange,
}: {
  companyId: number
  document: CashDocument
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const deletion = useMutation({
    mutationFn: () => remove(document),
    onSuccess: () => {
      forgetFinance(queryClient, companyId)
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
            {formatDateTime(document.at)} dagi {formatMoney(document.amount, currencyOf(currencies, document.currency_id))} {financeKindTitle[document.kind].toLowerCase()} o&apos;chiriladi. Qayta tiklab
            bo&apos;lmaydi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg" className="max-sm:h-10">
            Bekor qilish
          </AlertDialogCancel>
          <PendingButton variant="destructive" size="lg" className="max-sm:h-10" pending={deletion.isPending} onClick={() => deletion.mutate()}>
            O&apos;chirish
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
