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
import { forgetWarehouse } from "@/components/warehouse/new-purchase-page"
import { api, call } from "@/lib/api"
import type { Sale } from "@/lib/types"

// DeleteSaleButton deletes a sale after asking: its products come back to
// the stock and the payments entered with it go too; its number is never
// given again (logic/sales.md, 3.3). afterDelete is what follows: the page
// leaves for the list.
export function DeleteSaleButton({ companyId, sale, afterDelete }: { companyId: number; sale: Sale; afterDelete?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/sales/{id}", { params: { path: { id: sale.id } } })),
    onSuccess: () => {
      forgetWarehouse(queryClient, companyId)
      toast.success("Sotuv o'chirildi")
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
          <AlertDialogTitle>Sotuvni o&apos;chirasizmi?</AlertDialogTitle>
          <AlertDialogDescription>№ {sale.number} sotuvi o&apos;chiriladi, tovar qoldiqqa qaytadi, to&apos;lovlari yo&apos;qoladi. Qayta tiklab bo&apos;lmaydi.</AlertDialogDescription>
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
