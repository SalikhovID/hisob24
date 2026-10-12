"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2Icon } from "lucide-react"
import { useState } from "react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { api, call } from "@/lib/api"
import type { OpeningStock } from "@/lib/types"
import { forgetWarehouse } from "./new-purchase-page"

// DeleteOpeningStockButton deletes an opening stock after asking: its lines
// go out of the stock; its number is never given again (logic/warehouse.md,
// 5.3). A refusal (the stock would go below zero) is told and the document
// stays. afterDelete is what follows: the page leaves for the list.
export function DeleteOpeningStockButton({ companyId, opening, afterDelete }: { companyId: number; opening: OpeningStock; afterDelete?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/opening-stock/{id}", { params: { path: { id: opening.id } } })),
    onSuccess: () => {
      forgetWarehouse(queryClient, companyId)
      toast.success("Boshlang'ich qoldiq o'chirildi")
      setConfirming(false)
      afterDelete?.()
    },
    onError: (error) => {
      toast.error(error.message)
      setConfirming(false)
    },
  })

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogTrigger render={<Button variant="outline" size="lg" className="px-3.5 hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20" />}>
        <Trash2Icon />
        O&apos;chirish
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Boshlang&apos;ich qoldiqni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>№ {opening.number} hujjati o&apos;chiriladi, qoldiq olinadi. Qayta tiklab bo&apos;lmaydi.</AlertDialogDescription>
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
  )
}
