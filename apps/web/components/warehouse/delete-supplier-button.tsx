"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import { Row } from "@/components/kit/group"
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
import { suppliersKey } from "@/lib/queries"
import type { Supplier } from "@/lib/types"

// DeleteSupplierButton is the danger row at the foot of a supplier's page:
// it deletes the supplier after asking. One with live purchases or payments
// is kept: the API's reason is told and the record stays (it may be turned
// off instead). afterDelete is what follows: the page leaves for the list.
// The page puts it in a group, under the row that turns the supplier off.
export function DeleteSupplierButton({ companyId, supplier, afterDelete }: { companyId: number; supplier: Supplier; afterDelete?: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: () => call(api.DELETE("/app/suppliers/{id}", { params: { path: { id: supplier.id } } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: suppliersKey(companyId) })
      toast.success("Ta'minotchi o'chirildi")
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
      <Row variant="danger" onClick={() => setConfirming(true)} title="Ta'minotchini o'chirish" />
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta&apos;minotchini o&apos;chirasizmi?</AlertDialogTitle>
            <AlertDialogDescription>{supplier.name} ro&apos;yxatdan olib tashlanadi. Qayta tiklab bo&apos;lmaydi.</AlertDialogDescription>
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
