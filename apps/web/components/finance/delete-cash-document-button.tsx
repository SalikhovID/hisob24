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
import { financeKindTitle, forgetFinance } from "@/lib/finance"
import { formatAmount, formatDateTime, formatMoney } from "@/lib/format"

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

// DeleteCashDocumentButton deletes a cash document after asking, from its
// row. What the accounts hold changes back by it.
export function DeleteCashDocumentButton({ companyId, document }: { companyId: number; document: CashDocument }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const amount = formatAmount(document.amount)
  const deletion = useMutation({
    mutationFn: () => remove(document),
    onSuccess: () => {
      forgetFinance(queryClient, companyId)
      toast.success("Hujjat o'chirildi")
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
