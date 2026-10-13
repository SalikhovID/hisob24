"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Tile } from "@/components/kit/detail-head"
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
import type { Purchase } from "@/lib/types"
import { forgetWarehouse } from "./new-purchase-page"

// DeletePurchaseButton is the danger tile of a purchase's page: it deletes
// the purchase after asking: its lines go out of
// the stock and the payment entered with it goes too; its number is never
// given again (logic/warehouse.md, 4.4). A refusal (the stock would go
// below zero) is told and the purchase stays. afterDelete is what follows:
// the page leaves for the list.
export function DeletePurchaseButton({ companyId, purchase, afterDelete }: { companyId: number; purchase: Purchase; afterDelete?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/purchases/{id}", { params: { path: { id: purchase.id } } })),
    onSuccess: () => {
      forgetWarehouse(queryClient, companyId)
      toast.success("Xarid o'chirildi")
      setConfirming(false)
      afterDelete?.()
    },
    onError: (error) => {
      toast.error(error.message)
      setConfirming(false)
    },
  })

  return (
    <>
    <Tile icon={Trash2Icon} label="O'chirish" danger onClick={() => setConfirming(true)} />
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xaridni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>№ {purchase.number} xaridi o&apos;chiriladi, qoldiq qaytariladi. Qayta tiklab bo&apos;lmaydi.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg" className="max-sm:h-10">
            Bekor qilish
          </AlertDialogCancel>
          <PendingButton
            variant="destructive"
            size="lg"
            className="max-sm:h-10"
            pending={remove.isPending || (remove.isSuccess && afterDelete !== undefined)}
            onClick={() => remove.mutate()}
          >
            O&apos;chirish
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
