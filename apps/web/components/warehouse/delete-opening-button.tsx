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
import { statementKey, supplierKey, suppliersKey } from "@/lib/queries"
import type { OpeningFields } from "@/lib/stock"

// DeleteOpeningButton deletes an opening debt or advance after asking, from
// its row in the statement. What is owed changes back by it.
export function DeleteOpeningButton({ companyId, opening }: { companyId: number; opening: OpeningFields }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const currencies = useCurrencies()
  const amount = formatAmount(opening.amount)
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/suppliers/{id}/openings/{openingId}", { params: { path: { id: opening.supplier_id, openingId: opening.id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: statementKey(companyId, opening.supplier_id) })
      queryClient.invalidateQueries({ queryKey: supplierKey(companyId, opening.supplier_id) })
      queryClient.invalidateQueries({ queryKey: suppliersKey(companyId) })
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
